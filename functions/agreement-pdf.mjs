const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = PAGE_WIDTH - 48;
const BODY_WIDTH = RIGHT - LEFT;
const BLUE = '0.09 0.35 0.76';
const DARK = '0.08 0.16 0.29';
const MUTED = '0.34 0.42 0.54';
const LINE = '0.83 0.88 0.94';
const LIGHT_BLUE = '0.94 0.97 1';

const ascii = value => String(value ?? '').normalize('NFKD')
  .replace(/[\u2010-\u2015\u2212]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u00b7\u2022]/g, '-')
  .replace(/[^\x20-\x7e]/g, '?');
const escapePdf = value => ascii(value).replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const dateText = value => {
  const date = value?.toDate?.() || (value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null);
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
};

function wrap(value, maxChars) {
  const words = ascii(value).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      line = '';
      for (let index = 0; index < word.length; index += maxChars) lines.push(word.slice(index, index + maxChars));
      continue;
    }
    if (line && `${line} ${word}`.length > maxChars) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function buildAgreementPdf(agreement) {
  const pageContents = [[]];
  let pageIndex = 0;
  let y = 718;
  const content = () => pageContents[pageIndex];
  const newPage = () => { pageContents.push([]); pageIndex += 1; y = 756; };
  const ensureRoom = height => { if (y - height < 62) newPage(); };
  const op = value => content().push(value);
  const text = (value, x = LEFT, size = 10, color = DARK, bold = false, atY = y) => {
    op(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${atY.toFixed(2)} Tm (${escapePdf(value)}) Tj ET`);
  };
  const rule = (x1, y1, x2, y2, color = LINE, width = 0.8) => {
    op(`q ${color} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  };
  const rect = (x, y0, width, height, fill, stroke = LINE, radius = 8) => {
    // Keep cards vector-based and printer-safe; use square corners for the PDF.
    const _radius = radius;
    void _radius;
    op(`q ${fill} rg ${stroke} RG 0.7 w ${x.toFixed(2)} ${y0.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re B Q`);
  };
  const paragraph = (value, { x = LEFT, maxChars = 88, size = 10, color = MUTED, leading = 14, bold = false } = {}) => {
    const lines = wrap(value, maxChars);
    ensureRoom(lines.length * leading + 2);
    for (const line of lines) { text(line, x, size, color, bold); y -= leading; }
  };
  const section = title => {
    ensureRoom(34);
    y -= 7;
    text(title.toUpperCase(), LEFT, 9, BLUE, true);
    y -= 7;
    rule(LEFT, y, RIGHT, y);
    y -= 16;
  };
  const field = (label, value, x = LEFT, width = BODY_WIDTH) => {
    const valueLines = wrap(value || 'Not provided', Math.max(16, Math.floor(width / 5.25)));
    const consumed = 23 + Math.max(0, valueLines.length - 1) * 12;
    if (width === BODY_WIDTH) ensureRoom(consumed);
    text(label.toUpperCase(), x, 7.5, MUTED, true);
    y -= 13;
    for (const line of valueLines) { text(line, x, 9.4, DARK, false); y -= 12; }
    y -= 5;
    return consumed;
  };
  const partyCard = (label, party, x, width) => {
    const details = [
      party?.email || 'Email not provided',
      party?.phone || 'Phone not provided',
      party?.brokerage || 'Brokerage not provided',
      [party?.licenseNumber, party?.licenseState].filter(Boolean).join(' · ') || 'License not provided',
      party?.brokerageAddress || 'Brokerage address not provided',
    ];
    const wrappedDetails = details.flatMap(line => wrap(line, Math.max(20, Math.floor((width - 28) / 5.1))));
    const cardHeight = 62 + wrappedDetails.length * 12;
    ensureRoom(cardHeight + 10);
    const top = y;
    rect(x, top - cardHeight, width, cardHeight, LIGHT_BLUE, LINE);
    text(label.toUpperCase(), x + 13, 7.5, BLUE, true, top - 17);
    text(party?.name || 'Details to be completed', x + 13, 11, DARK, true, top - 35);
    let detailY = top - 50;
    for (const line of wrappedDetails) { text(line, x + 13, 8.2, MUTED, false, detailY); detailY -= 12; }
    return cardHeight;
  };
  const signatureCard = (label, signature, party, x, width) => {
    const signer = signature?.signerName || party?.name || 'Not signed';
    const email = signature?.signerEmail || party?.email || 'Email not provided';
    const signedAt = dateText(signature?.signedAt) || 'Awaiting signature';
    const method = signature?.signatureMethod ? `Method: ${signature.signatureMethod}` : 'Signature method not recorded';
    const details = [email, `Signed: ${signedAt}`, method];
    const wrappedDetails = details.flatMap(line => wrap(line, Math.max(20, Math.floor((width - 28) / 5.1))));
    const hasDrawn = Boolean(signature?.drawnSignaturePath);
    const cardHeight = 70 + wrappedDetails.length * 12 + (hasDrawn ? 35 : 0);
    ensureRoom(cardHeight + 10);
    const top = y;
    rect(x, top - cardHeight, width, cardHeight, '1 1 1', LINE);
    text(label.toUpperCase(), x + 13, 7.5, BLUE, true, top - 17);
    text(signer, x + 13, 10, DARK, true, top - 34);
    let detailY = top - 49;
    for (const line of wrappedDetails) { text(line, x + 13, 8, MUTED, false, detailY); detailY -= 12; }
    if (hasDrawn) {
      const sigBaseY = top - cardHeight + 12;
      op(`q ${BLUE} RG 1.2 w 1 J 1 j`);
      let started = false;
      for (const [, command, rawX, rawY] of String(signature.drawnSignaturePath).matchAll(/([ML])([0-9.]+),([0-9.]+)/g)) {
        const px = x + 14 + Number(rawX) / 720 * (width - 28);
        const py = sigBaseY + Number(rawY) / 150 * 25;
        op(`${px.toFixed(2)} ${py.toFixed(2)} ${command === 'M' || !started ? 'm' : 'l'}`);
        if (command === 'M') started = true;
      }
      op('S Q');
    }
    return cardHeight;
  };

  const agreementNumber = agreement.agreementNumber || agreement.id || 'Agreement';
  const snapshot = agreement.referralSnapshot || {};
  const referrer = agreement.referringParty || {};
  const receiver = agreement.receivingParty || {};
  const referringSignature = agreement.referrerSignature || {};
  const receivingSignature = agreement.receiverSignature || {};

  // Premium, compact masthead with metadata and stable pagination area.
  op(`q ${BLUE} rg 0 ${PAGE_HEIGHT - 92} ${PAGE_WIDTH} 92 re f Q`);
  text('AGENTREFERRALS', LEFT, 9, '1 1 1', true, PAGE_HEIGHT - 29);
  text('PROFESSIONAL NETWORK', RIGHT - 130, 7.5, '0.83 0.9 1', true, PAGE_HEIGHT - 29);
  text('Referral Agreement', LEFT, 21, '1 1 1', true, PAGE_HEIGHT - 57);
  text(`${agreementNumber}  ·  Version ${agreement.agreementVersion || 1}`, LEFT, 9, '0.88 0.93 1', false, PAGE_HEIGHT - 75);
  text('EXECUTED COPY', RIGHT - 82, 8, '1 1 1', true, PAGE_HEIGHT - 57);

  section('Agreement overview');
  field('Status', 'ACTIVE · Fully executed');
  field('Effective date', dateText(agreement.effectiveDate) || dateText(agreement.activatedAt) || dateText(agreement.createdAt) || 'Not recorded');
  field('Created', dateText(agreement.createdAt) || 'Not recorded');
  if (agreement.parentAgreementId) {
    field('Amendment', `${agreement.parentAgreementId} · ${agreement.amendmentSummary || 'Amendment details not provided'}`);
  }

  ensureRoom(190);
  section('Agreement parties');
  const partyGap = 12;
  const partyWidth = (BODY_WIDTH - partyGap) / 2;
  const partyTop = y;
  const leftPartyHeight = partyCard('Referring professional', referrer, LEFT, partyWidth);
  y = partyTop;
  const rightPartyHeight = partyCard('Receiving professional', receiver, LEFT + partyWidth + partyGap, partyWidth);
  y = partyTop - Math.max(leftPartyHeight, rightPartyHeight) - 16;

  section('Referral details');
  const fee = snapshot.referralFee?.percent ?? agreement.feePercent;
  const location = [snapshot.city, snapshot.state, snapshot.zip].filter(Boolean).join(', ');
  const referralFields = [
    ['Opportunity', snapshot.title || agreement.referralTitle || 'Referral opportunity'],
    ['Referral ID', agreement.referralId || 'Not provided'],
    ['Referral type', snapshot.referralType || snapshot.clientType || 'Not provided'],
    ['Location', location || 'Not provided'],
    ['Property type', snapshot.propertyType || 'Not provided'],
    ['Estimated price', snapshot.priceRange || [snapshot.minPrice, snapshot.maxPrice].filter(Boolean).join(' – ') || 'Not provided'],
    ['Original post date', snapshot.originalCreatedAt || 'Not provided'],
    ['Referral fee', fee == null ? 'Not provided' : `${fee}%`],
    ['Fee basis', snapshot.referralFee?.basis || 'Not specified'],
    ['Payment condition', snapshot.referralFee?.paymentCondition || 'Not specified'],
    ['Payment timing', snapshot.referralFee?.paymentTiming || 'Not specified'],
    ['Client requirements', snapshot.preferences || 'Not provided'],
  ];
  const fieldGap = 18;
  const fieldWidth = (BODY_WIDTH - fieldGap) / 2;
  for (let index = 0; index < referralFields.length; index += 2) {
    const leftLines = wrap(referralFields[index][1] || 'Not provided', Math.max(16, Math.floor(fieldWidth / 5.25))).length;
    const rightLines = referralFields[index + 1]
      ? wrap(referralFields[index + 1][1] || 'Not provided', Math.max(16, Math.floor(fieldWidth / 5.25))).length
      : 1;
    ensureRoom(23 + (Math.max(leftLines, rightLines) - 1) * 12 + 4);
    const rowTop = y;
    const leftHeight = field(referralFields[index][0], referralFields[index][1], LEFT, fieldWidth);
    y = rowTop;
    const rightHeight = referralFields[index + 1]
      ? field(referralFields[index + 1][0], referralFields[index + 1][1], LEFT + fieldWidth + fieldGap, fieldWidth)
      : 0;
    y = rowTop - Math.max(leftHeight, rightHeight) - 4;
  }

  section(`Approved terms${agreement.agreementTemplateVersion ? ` · Version ${agreement.agreementTemplateVersion}` : ''}`);
  const termsSections = agreement.termsSnapshot?.sections || [];
  if (!termsSections.length) {
    paragraph('No approved terms were captured in this agreement snapshot.', { size: 9.5, color: MUTED });
  } else {
    termsSections.forEach((item, index) => {
      ensureRoom(42);
      text(`${index + 1}. ${item.title || 'Agreement term'}`, LEFT, 10, DARK, true);
      y -= 16;
      paragraph(item.body || '', { maxChars: 88, size: 9.2, color: MUTED, leading: 13 });
      y -= 5;
    });
  }

  ensureRoom(210);
  section('Electronic signature record');
  const sigGap = 12;
  const sigWidth = (BODY_WIDTH - sigGap) / 2;
  const sigTop = y;
  const refHeight = signatureCard('Referring professional', referringSignature, referrer, LEFT, sigWidth);
  y = sigTop;
  const receiveHeight = signatureCard('Receiving professional', receivingSignature, receiver, LEFT + sigWidth + sigGap, sigWidth);
  y = sigTop - Math.max(refHeight, receiveHeight) - 16;

  section('Consent and document integrity');
  [
    `Terms of Service version: ${agreement.termsOfServiceVersion || 'Not recorded'}`,
    `Privacy Policy version: ${agreement.privacyPolicyVersion || 'Not recorded'}`,
    `Terms accepted: Referring ${referringSignature.acceptedTerms === true ? 'Yes' : 'No'} · Receiving ${receivingSignature.acceptedTerms === true ? 'Yes' : 'No'}`,
    `Terms accepted at: Referring ${dateText(referringSignature.termsAcceptedAt) || 'Not recorded'} · Receiving ${dateText(receivingSignature.termsAcceptedAt) || 'Not recorded'}`,
    `Privacy acknowledged: Referring ${referringSignature.acceptedPrivacy === true ? 'Yes' : 'No'} · Receiving ${receivingSignature.acceptedPrivacy === true ? 'Yes' : 'No'}`,
    `Privacy acknowledged at: Referring ${dateText(referringSignature.privacyAcceptedAt) || 'Not recorded'} · Receiving ${dateText(receivingSignature.privacyAcceptedAt) || 'Not recorded'}`,
    `Electronic signature consent: Referring ${referringSignature.acceptedElectronicSignature === true ? 'Yes' : 'No'} · Receiving ${receivingSignature.acceptedElectronicSignature === true ? 'Yes' : 'No'}`,
    `Signer account IDs: Referring ${referringSignature.signerId || 'Not recorded'} · Receiving ${receivingSignature.signerId || 'Not recorded'}`,
    `Referring signer device: ${referringSignature.userAgent || 'Not recorded'}${referringSignature.ipAddress ? ` · IP ${referringSignature.ipAddress}` : ''}`,
    `Receiving signer device: ${receivingSignature.userAgent || 'Not recorded'}${receivingSignature.ipAddress ? ` · IP ${receivingSignature.ipAddress}` : ''}`,
    `Document SHA-256: ${agreement.document?.hash || 'Not available'}`,
    `PDF SHA-256: ${agreement.document?.pdfHash || 'Recorded in document storage metadata'}`,
  ].forEach(line => paragraph(line, { maxChars: 88, size: 8.4, color: MUTED, leading: 12 }));

  const objects = [];
  const add = value => { objects.push(value); return objects.length; };
  const catalogId = add('');
  const pagesId = add('');
  const regularFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds = [];

  pageContents.forEach((commands, index) => {
    const pageNumber = index + 1;
    const totalPages = pageContents.length;
    if (index > 0) {
      commands.unshift(
        `q ${LIGHT_BLUE} rg 0 ${PAGE_HEIGHT - 54} ${PAGE_WIDTH} 54 re f Q`,
        `BT /F2 8.5 Tf ${BLUE} rg 1 0 0 1 ${LEFT} ${(PAGE_HEIGHT - 25).toFixed(2)} Tm (AGENTREFERRALS) Tj ET`,
        `BT /F1 8.5 Tf ${MUTED} rg 1 0 0 1 ${LEFT} ${(PAGE_HEIGHT - 41).toFixed(2)} Tm (${escapePdf(`Referral Agreement - ${agreementNumber}`)}) Tj ET`,
        `q ${LINE} RG 0.7 w ${LEFT} ${(PAGE_HEIGHT - 54).toFixed(2)} m ${RIGHT} ${(PAGE_HEIGHT - 54).toFixed(2)} l S Q`,
      );
    }
    commands.push(`q ${LINE} RG 0.7 w ${LEFT} 43 m ${RIGHT} 43 l S Q`);
    commands.push(`BT /F1 7.5 Tf ${MUTED} rg 1 0 0 1 ${LEFT} 29 Tm (${escapePdf(`AgentReferrals · ${agreementNumber} · Confidential agreement record`)}) Tj ET`);
    const pageLabel = `Page ${pageNumber} of ${totalPages}`;
    const labelWidth = pageLabel.length * 4.2;
    commands.push(`BT /F2 7.5 Tf ${MUTED} rg 1 0 0 1 ${(RIGHT - labelWidth).toFixed(2)} 29 Tm (${escapePdf(pageLabel)}) Tj ET`);
    const stream = commands.join('\n');
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, 'ascii')); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}
