import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldPath, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash, randomUUID } from 'node:crypto';
import { can, MODULES, ROLES } from './permissions.mjs';
import { buildAgreementPdf } from './agreement-pdf.mjs';

initializeApp();
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();
const callable = {
  region: 'us-central1',
  // Callable requests carry Firebase Auth in the callable payload. Cloud Run
  // must allow the browser's unauthenticated OPTIONS preflight to reach the
  // callable handler; authorize() still enforces verified admin identity.
  invoker: 'public',
  enforceAppCheck: false,
  maxInstances: 10,
  cors: [
    'https://agentreferrals-org.vercel.app',
    'https://agentreferrals.org',
    'https://www.agentreferrals.org',
    /^http:\/\/localhost(?::\d+)?$/,
  ],
};
const text = (value, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const fail = (code, message) => { throw new HttpsError(code, message); };
const serialize = value => {
  if (value instanceof FieldValue) return new Date().toISOString();
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
};
const safeDoc = doc => ({ id: doc.id, ...serialize(doc.data()) });
const signatureStatus = value => String(value || '').toUpperCase().replaceAll(' ', '_');
const partySnapshot = (uid, account, profile = {}, application = {}) => ({
  uid, name: text(profile.displayName || account.displayName || application.applicantName, 140) || null,
  email: text(account.email || application.applicantEmail, 254).toLowerCase() || null,
  phone: text(profile.phoneNumber || profile.phone || account.phoneNumber || application.applicantPhone, 40) || null,
  brokerage: text(profile.brokerageName || profile.brokerage || application.applicantBrokerage, 180) || null,
  brokerageId: text(profile.brokerageId, 160) || null,
  brokerageAddress: text(profile.brokerageAddress || profile.address, 300) || null,
  licenseNumber: text(profile.licenseNumber || profile.stateLicenseNumber || profile.license, 100) || null,
  licenseState: text(profile.licenseState || profile.stateLicensed, 100) || null,
});
const agreementEvent = (tx, agreementRef, eventType, actorUid, details = {}) => {
  tx.create(agreementRef.collection('events').doc(), {
    eventType, actorUid: actorUid || null, details,
    createdAt: FieldValue.serverTimestamp(),
  });
};


export const submitReferralApplication = onCall(callable, async request => {
  try {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in before applying for a referral.');
  const pitchNote = text(request.data?.pitchNote, 5000);
  const brokerName = text(request.data?.brokerName, 140);
  const brokerEmail = text(request.data?.brokerEmail, 254).toLowerCase();
  const referralId = text(request.data?.referralId, 1500);
  if (!referralId) fail('invalid-argument', 'This referral could not be identified. Refresh the marketplace and try again.');
  if (pitchNote.length < 20) fail('invalid-argument', 'Add at least 20 characters about why you are a good fit.');
  if (!brokerName) fail('invalid-argument', 'Add your managing broker’s name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brokerEmail)) fail('invalid-argument', 'Enter a valid managing broker email.');

  const [account, profileSnap] = await Promise.all([
    auth.getUser(uid), db.collection('users').doc(uid).get(),
  ]);
  if (account.disabled) fail('permission-denied', 'This account is disabled. Contact support if you think this is a mistake.');
  if (!account.emailVerified) fail('failed-precondition', 'Verify your email before applying for referrals.');
  const profile = profileSnap.data() || {};
  if (!['PROFESSIONAL', 'professional'].includes(profile.role) || String(profile.verificationStatus || '').toLowerCase() !== 'approved') {
    fail('permission-denied', 'Only approved professionals can apply to referral opportunities.');
  }
  const referralRef = db.collection('referrals').doc(referralId);
  const applicationId = createHash('sha256').update(`${uid}:${referralId}`).digest('hex');
  const applicationRef = db.collection('applications').doc(applicationId);
  // The deterministic application ID is the canonical duplicate check. Avoid
  // a compound collection query here: it can require a production composite
  // index and turn an otherwise valid application into an opaque `internal`
  // callable error when that index has not been deployed.
  const [applicationSnap, referralSnap] = await Promise.all([
    applicationRef.get(), referralRef.get(),
  ]);
  if (applicationSnap.exists) return { ok: true, alreadyApplied: true, applicationId };
  if (!referralSnap.exists) fail('not-found', 'This referral is no longer available. Refresh the marketplace.');

  const referral = referralSnap.data() || {};
  if (!['open', 'published', 'active', 'Published', 'Active'].includes(referral.status)) {
    fail('failed-precondition', 'This referral is no longer accepting applications.');
  }
  const creatorId = text(referral.creatorProfessionalId || referral.creatorId, 160);
  if (!creatorId) fail('failed-precondition', 'The referral owner could not be verified. Contact support before applying.');
  if (creatorId === uid) fail('failed-precondition', 'You cannot apply to a referral you posted.');

  const notificationRef = db.collection('notifications').doc(`application_${applicationId}`);
  const activityRef = db.collection('activity').doc(`application_submitted_${applicationId}`);
  let alreadyApplied = false;
  try {
    await db.runTransaction(async tx => {
      const [currentApplication, currentReferral] = await Promise.all([tx.get(applicationRef), tx.get(referralRef)]);
      if (currentApplication.exists) { alreadyApplied = true; return; }
      if (!currentReferral.exists || !['open', 'published', 'active', 'Published', 'Active'].includes(currentReferral.data()?.status)) {
        fail('failed-precondition', 'This referral is no longer accepting applications.');
      }
      const currentCreatorId = text(currentReferral.data()?.creatorProfessionalId || currentReferral.data()?.creatorId, 160);
      if (!currentCreatorId || currentCreatorId !== creatorId) fail('failed-precondition', 'The referral owner changed. Refresh and try again.');

      const applicantName = text(profile.displayName || account.displayName, 140) || account.email?.split('@')[0] || 'Professional';
      const application = {
        referralId, referralTitle: text(referral.title, 240) || null,
        referralCity: text(referral.city, 120) || null, referralState: text(referral.state, 120) || null,
        referralCreatorId: creatorId, applicantProfessionalId: uid, applicantName,
        applicantEmail: account.email || null,
        applicantPhone: text(profile.phoneNumber || profile.phone || account.phoneNumber, 40) || null,
        applicantBrokerage: text(profile.brokerageName || profile.brokerage, 160) || null,
        applicantBrokerName: brokerName, applicantBrokerEmail: brokerEmail,
        applicantExp: text(profile.yearsExperience, 80) || null,
        pitchNote, status: 'PENDING', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      };
      if (referral.feePercent !== undefined && referral.feePercent !== null) application.referralFeePercent = referral.feePercent;
      tx.create(applicationRef, application);
      tx.set(notificationRef, {
        userId: creatorId, category: 'Applications', title: 'New application',
        message: `${applicantName} applied for your referral${application.referralTitle ? `: ${application.referralTitle}` : '.'}`,
        body: `${applicantName} applied for your referral${application.referralTitle ? `: ${application.referralTitle}` : '.'}`,
        referralId, applicationId, unread: true, createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(activityRef, {
        userId: uid, targetUserId: creatorId, type: 'APPLICATION_SUBMITTED',
        title: 'Application submitted', description: `Applied for ${application.referralTitle || 'a referral opportunity'}.`,
        referralId, applicationId, createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const errorReference = randomUUID();
    console.error('submitReferralApplication failed during transactional save', {
      errorReference, uid, referralId, code: error?.code || 'unknown', message: error?.message || String(error), stack: error?.stack,
    });
    throw new HttpsError('internal', 'The application could not be saved. Please try again and share the support reference if it continues.', { errorReference });
  }
  return { ok: true, alreadyApplied, applicationId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    const errorReference = randomUUID();
    console.error('submitReferralApplication failed before completing request', {
      errorReference, uid: request.auth?.uid || null,
      code: error?.code || 'unknown', message: error?.message || String(error), stack: error?.stack,
    });
    throw new HttpsError('internal', 'The application could not be saved. Please try again and share the support reference if it continues.', { errorReference });
  }
});

export const decideReferralApplication = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in before reviewing applications.');
  const account = await auth.getUser(uid);
  if (account.disabled || !account.emailVerified) fail('permission-denied', 'A verified professional account is required.');
  const applicationId = text(request.data?.applicationId, 256);
  const status = text(request.data?.status, 24).toUpperCase();
  if (!applicationId || !['SHORTLISTED', 'ACCEPTED', 'REJECTED'].includes(status)) fail('invalid-argument', 'Choose a valid application decision.');

  const applicationRef = db.collection('applications').doc(applicationId);
  const applicationSnap = await applicationRef.get();
  if (!applicationSnap.exists) fail('not-found', 'This application no longer exists.');
  const initial = applicationSnap.data() || {};
  const referralRef = db.collection('referrals').doc(text(initial.referralId, 1500));
  const agreementRef = db.collection('agreements').doc(`application_${applicationId}`);
  const notificationRef = db.collection('notifications').doc(`application_decision_${applicationId}_${status.toLowerCase()}`);
  const activityRef = db.collection('activity').doc(`application_decision_${applicationId}_${status.toLowerCase()}`);
  const applicantUid = text(initial.applicantProfessionalId, 160);
  const [profileSnap, applicantProfileSnap, templateSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    status === 'ACCEPTED' ? db.collection('users').doc(applicantUid).get() : Promise.resolve(null),
    status === 'ACCEPTED' ? db.doc('system_settings/active_agreement_template').get() : Promise.resolve(null),
  ]);
  const applicantAccount = status === 'ACCEPTED' ? await auth.getUser(applicantUid).catch(() => null) : null;
  const profile = profileSnap.data() || {};
  const applicantProfile = applicantProfileSnap?.data() || {};
  if (!['PROFESSIONAL', 'professional'].includes(profile.role) || String(profile.verificationStatus || '').toLowerCase() !== 'approved') {
    fail('permission-denied', 'Only approved professionals can review referral applications.');
  }
  let result = { ok: true, status };
  const counterRef = db.doc('system_settings/agreement_number_counter');

  await db.runTransaction(async tx => {
    const [currentApplication, currentReferral, currentAgreement, counterSnap] = await Promise.all([
      tx.get(applicationRef), tx.get(referralRef), tx.get(agreementRef), tx.get(counterRef),
    ]);
    if (!currentApplication.exists || !currentReferral.exists) fail('not-found', 'The referral or application could not be found.');
    const application = currentApplication.data() || {};
    const referral = currentReferral.data() || {};
    const ownerUid = text(referral.creatorProfessionalId || referral.creatorId, 160);
    if (ownerUid !== uid || application.referralCreatorId !== uid) fail('permission-denied', 'Only the professional who posted this referral can review its applications.');
    const currentStatus = text(application.status, 24).toUpperCase();
    if (currentStatus === status) { result.alreadyApplied = true; return; }
    if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(currentStatus)) fail('failed-precondition', 'This application has already reached a final status.');
    if (!['PENDING', 'SUBMITTED', 'SHORTLISTED', 'APPLIED', 'RECEIVED'].includes(currentStatus)) fail('failed-precondition', 'This application cannot be updated from its current status.');

    tx.update(applicationRef, { status, updatedAt: FieldValue.serverTimestamp() });
    const timestamp = FieldValue.serverTimestamp();
    if (status === 'ACCEPTED') {
      if (currentAgreement.exists) {
        result.agreementId = agreementRef.id;
        result.agreementNumber = currentAgreement.data()?.agreementNumber || null;
      } else {
        if (!applicantUid || applicantUid === uid || !applicantAccount || applicantAccount.disabled) fail('failed-precondition', 'The applicant account could not be verified.');
        const acceptedFee = Number(application.referralFeePercent ?? referral.feePercent);
        if (!Number.isFinite(acceptedFee) || acceptedFee < 0 || acceptedFee > 100) fail('failed-precondition', 'The referral fee must be set between 0 and 100 before accepting this applicant.');
        const sequence = Number(counterSnap.data()?.sequence || 0) + 1;
        const year = new Date().getUTCFullYear();
        const agreementNumber = `AGR-${year}-${String(sequence).padStart(6, '0')}`;
        const referringParty = partySnapshot(uid, account, profile);
        const receivingParty = partySnapshot(applicantUid, applicantAccount, applicantProfile, application);
        const feePercent = acceptedFee;
        const template = templateSnap.exists && templateSnap.data()?.status === 'PUBLISHED' ? templateSnap.data() : null;
        const referralSnapshot = {
          id: referralRef.id, title: text(referral.title || application.referralTitle, 240),
          referralType: text(referral.type || referral.clientType || referral.category, 80) || null,
          clientType: text(referral.clientType, 80) || null, city: text(referral.city, 120) || null,
          state: text(referral.state, 120) || null, zip: text(referral.zip, 20) || null,
          propertyType: text(referral.propertyType, 100) || null,
          minPrice: referral.minValue ?? null, maxPrice: referral.maxValue ?? null,
          priceRange: [referral.minValue, referral.maxValue].filter(v => v != null && v !== '').join(' – ') || null,
          referralFee: { percent: Number.isFinite(feePercent) ? feePercent : null,
            basis: text(referral.feeBasis, 160) || null, paymentCondition: text(referral.paymentCondition, 240) || null,
            paymentTiming: text(referral.paymentTiming, 240) || null },
          description: text(referral.description, 10000) || null,
          preferences: text(referral.preferences, 5000) || null,
          originalCreatedAt: serialize(referral.createdAt) || null,
        };
        const agreement = {
          agreementNumber, agreementVersion: 1, agreementTemplateId: template?.id || template?.templateId || null,
          agreementTemplateVersion: template?.version || null,
          templateMissing: !template, termsSnapshot: template ? { name: template.name || 'Referral Agreement', version: template.version, sections: template.sections || [] } : { name: null, version: null, sections: [] },
          referralId: referralRef.id, applicationId, referringProfessionalId: uid, receivingProfessionalId: applicantUid,
          referringBrokerageId: referringParty.brokerageId, receivingBrokerageId: receivingParty.brokerageId,
          referringParty, receivingParty, referringName: referringParty.name, referringEmail: referringParty.email, referringPhone: referringParty.phone,
          referringBrokerage: referringParty.brokerage, referringLicenseNumber: referringParty.licenseNumber, referringLicenseState: referringParty.licenseState,
          receivingName: receivingParty.name, receivingEmail: receivingParty.email, receivingPhone: receivingParty.phone,
          receivingBrokerage: receivingParty.brokerage, receivingLicenseNumber: receivingParty.licenseNumber, receivingLicenseState: receivingParty.licenseState,
          referralTitle: referralSnapshot.title, referralSnapshot,
          termsSnapshotArrangement: { feePercent: referralSnapshot.referralFee.percent, feeBasis: referralSnapshot.referralFee.basis,
            paymentCondition: referralSnapshot.referralFee.paymentCondition, paymentTiming: referralSnapshot.referralFee.paymentTiming },
          status: 'DRAFT', stage: 'AGREEMENT', isImmutable: false,
          referrerSignature: { status: 'PENDING' }, receiverSignature: { status: 'PENDING' },
          signedByReferring: false, signedByReceiving: false, privacyPolicyVersion: template?.privacyPolicyVersion || null,
          termsOfServiceVersion: template?.termsOfServiceVersion || null, privacyPolicyUrl: template?.privacyPolicyUrl || null,
          termsOfServiceUrl: template?.termsOfServiceUrl || null,
          document: null, createdAt: timestamp, updatedAt: timestamp,
        };
        tx.create(agreementRef, agreement);
        tx.set(counterRef, { sequence, updatedAt: timestamp }, { merge: true });
        agreementEvent(tx, agreementRef, 'APPLICATION_ACCEPTED', uid, { applicationId, referralId: referralRef.id });
        agreementEvent(tx, agreementRef, 'AGREEMENT_CREATED', uid, { agreementNumber, applicationId, referralId: referralRef.id, agreementTemplateVersion: template?.version || null });
        result.agreementId = agreementRef.id;
        result.agreementNumber = agreementNumber;
      }
    }
    tx.set(notificationRef, {
      userId: application.applicantProfessionalId,
      category: 'Applications', title: `Application ${status.toLowerCase()}`,
      message: `Your application for ${text(application.referralTitle || referral.title, 200) || 'a referral'} was ${status.toLowerCase()}.`,
      referralId: application.referralId, applicationId, unread: true, createdAt: timestamp,
    });
    tx.set(activityRef, {
      userId: uid, targetUserId: application.applicantProfessionalId, type: `APPLICATION_${status}`,
      title: `Application ${status.toLowerCase()}`,
      description: `${text(application.applicantName, 140) || 'Applicant'} · ${text(application.referralTitle || referral.title, 200) || 'Referral'}`,
      referralId: application.referralId, applicationId, createdAt: timestamp,
    });
  });
  return result;
});

export const notifyOnApplication = onDocumentCreated('applications/{applicationId}', async event => {
  const item = event.data?.data();
  if (!item?.referralCreatorId || item.referralCreatorId === item.applicantProfessionalId) return;
  const notificationRef = db.collection('notifications').doc(`application_${event.params.applicationId}`);
  await db.runTransaction(async tx => {
    const existing = await tx.get(notificationRef);
    if (existing.exists) return;
    tx.create(notificationRef, { userId: item.referralCreatorId, category: 'Applications',
      title: 'New application', message: `${text(item.applicantName, 100) || 'A professional'} applied for your referral.`,
      referralId: item.referralId, applicationId: event.params.applicationId, unread: true,
      createdAt: FieldValue.serverTimestamp() });
  });
});

async function authorize(request, permission) {
  if (!request.auth?.uid) fail('unauthenticated', 'Sign in first.');
  const account = await auth.getUser(request.auth.uid);
  if (account.disabled) fail('permission-denied', 'This account is disabled.');
  if (!account.emailVerified) fail('permission-denied', 'Verify your email before using platform administration.');
  // Keep the verified platform-owner fallback aligned with firestore.rules and
  // the client route guard. This is an exact address check after Firebase Auth
  // confirms both identity and email verification; it does not trust request data.
  let role = account.customClaims?.platformRole || account.customClaims?.role ||
    (account.email?.toLowerCase() === 'support@agentreferrals.org' && account.emailVerified ? ROLES.SUPER_ADMIN : null);
  // Some existing administrator accounts were provisioned in Firestore before
  // custom claims were added. Their protected profile role is the trusted
  // compatibility source; regular users cannot change role fields in rules.
  if (!can(role, permission)) {
    const profile = await db.collection('users').doc(account.uid).get();
    const storedRole = profile.data()?.platformRole || profile.data()?.role;
    if (can(storedRole, permission)) role = storedRole;
  }
  if (!can(role, permission)) fail('permission-denied', 'You do not have permission for this action.');
  return { uid: account.uid, role, email: account.email || null };
}

function moduleFor(path) {
  const module = MODULES.find(item => item.path === path);
  if (!module) fail('invalid-argument', 'Unknown module.');
  return module;
}

async function audit(actor, action, collection, targetId, before, after, reason) {
  await db.collection('audit_logs').add({
    actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email,
    action, collection, targetId, before: serialize(before || null), after: serialize(after || null),
    reason: text(reason, 1000), createdAt: FieldValue.serverTimestamp(),
  });
}

const VERIFICATION_ITEMS = Object.freeze({
  EMAIL: { label: 'Email verification', required: true },
  IDENTITY: { label: 'Professional identity', required: true },
  LICENSE: { label: 'Real estate license', required: true },
  BROKERAGE: { label: 'Brokerage relationship', required: true },
  DECLARATIONS: { label: 'Compliance declarations', required: true },
  CONSENTS: { label: 'Terms and consents', required: true },
  GOVERNMENT_ID: { label: 'Government ID', requirement: 'governmentIdRequired', document: true },
  LICENSE_DOCUMENT: { label: 'License document', requirement: 'licenseDocumentRequired', document: true },
  BROKERAGE_DOCUMENT: { label: 'Brokerage proof', requirement: 'brokerageDocumentRequired', document: true },
  PROOF_OF_ADDRESS: { label: 'Proof of address', requirement: 'proofOfAddressRequired', document: true },
  BACKGROUND_CHECK: { label: 'Background check', requirement: 'backgroundCheckRequired', document: true },
  LICENSE_EXPIRATION: { label: 'License expiration', requirement: 'licenseExpirationRequired' },
  BROKER_LICENSE: { label: 'Responsible broker license', requirement: 'brokerLicenseRequired' },
});
const configuredVerificationItems = (policy = {}, documents = [], emailVerified = false, prior = {}) => {
  const requirements = policy.requirements || {};
  const items = {
    EMAIL: { ...VERIFICATION_ITEMS.EMAIL, status: emailVerified ? 'VERIFIED' : 'PENDING', sourceType: 'FIREBASE_AUTH' },
    IDENTITY: { ...VERIFICATION_ITEMS.IDENTITY, status: 'PENDING' },
    LICENSE: { ...VERIFICATION_ITEMS.LICENSE, status: 'PENDING' },
    BROKERAGE: { ...VERIFICATION_ITEMS.BROKERAGE, status: 'PENDING' },
    DECLARATIONS: { ...VERIFICATION_ITEMS.DECLARATIONS, status: 'VERIFIED' },
    CONSENTS: { ...VERIFICATION_ITEMS.CONSENTS, status: 'VERIFIED' },
  };
  for (const [itemId, definition] of Object.entries(VERIFICATION_ITEMS)) {
    if (!definition.requirement) continue;
    const required = requirements[definition.requirement] === true;
    const matchingDocuments = documents.filter(document => document.documentType === itemId);
    const priorItem = prior[itemId];
    items[itemId] = {
      label: definition.label, required,
      status: !required ? 'NOT_REQUIRED' : matchingDocuments.length ? (priorItem?.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING') : 'PENDING',
      documentIds: matchingDocuments.map(document => document.id),
    };
  }
  return items;
};
const verificationAggregate = (items, policyConfigured) => {
  const required = Object.values(items).filter(item => item.required);
  if (required.some(item => item.status === 'REJECTED')) return 'REJECTED';
  if (required.some(item => item.status === 'CHANGES_REQUESTED')) return 'REQUIRES_CHANGES';
  if (policyConfigured && required.length && required.every(item => item.status === 'VERIFIED' || item.status === 'NOT_REQUIRED')) return 'APPROVED';
  return 'PENDING_REVIEW';
};

export const submitProfessionalVerification = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in to submit professional verification.');
  const account = await auth.getUser(uid);
  if (account.disabled) fail('permission-denied', 'This account is disabled.');
  if (!account.emailVerified) fail('failed-precondition', 'Verify your email before submitting professional verification.');
  const licenseStateCode = text(request.data?.licenseStateCode, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(licenseStateCode)) fail('invalid-argument', 'Choose the state where this license was issued.');
  const userRef = db.collection('users').doc(uid);
  const submissionRef = db.collection('verification_submissions').doc(uid);
  const policyRef = db.collection('verificationPolicies').doc(licenseStateCode);
  const incomingDocuments = Array.isArray(request.data?.documents) ? request.data.documents.slice(0, 12) : [];
  const documents = [];
  for (const input of incomingDocuments) {
    const path = text(input.storagePath, 500);
    const documentType = text(input.documentType, 40).toUpperCase();
    if (!Object.hasOwn(VERIFICATION_ITEMS, documentType) || !VERIFICATION_ITEMS[documentType].requirement) fail('invalid-argument', 'A document type is invalid.');
    if (!path.startsWith(`verification-documents/${uid}/`)) fail('permission-denied', 'A verification file does not belong to this account.');
    const [exists] = await storage.bucket().file(path).exists();
    if (!exists) fail('not-found', 'A verification file could not be found. Upload it again.');
    documents.push({ id: text(input.id, 100) || randomUUID(), storagePath: path, documentType,
      fileName: text(input.fileName, 180) || 'Verification document', mimeType: text(input.mimeType, 100),
      size: Math.max(0, Math.min(Number(input.size) || 0, 8 * 1024 * 1024)), status: 'PENDING', uploadedBy: uid,
      uploadedAt: FieldValue.serverTimestamp() });
  }

  const declarationIds = ['accurateInformation', 'licenseBelongsToMe', 'keepInformationCurrent', 'reportLicenseChanges'];
  const consentIds = ['terms', 'privacy', 'electronicCommunications', 'professionalVerification'];
  const declarations = request.data?.declarations || {};
  const consents = request.data?.consents || {};
  if (declarationIds.some(id => declarations[id] !== true)) fail('failed-precondition', 'Complete each professional compliance declaration.');
  if (consentIds.some(id => consents[id] !== true)) fail('failed-precondition', 'Accept each required verification consent.');

  const result = await db.runTransaction(async tx => {
    const [profileSnap, priorSnap, policySnap, legalSnap] = await Promise.all([
      tx.get(userRef), tx.get(submissionRef), tx.get(policyRef), tx.get(db.doc('system_settings/active_agreement_template')),
    ]);
    if (!profileSnap.exists) fail('failed-precondition', 'Complete the professional profile before submitting.');
    const profile = profileSnap.data();
    if (!['PROFESSIONAL', 'professional'].includes(profile.role)) fail('permission-denied', 'Only professional accounts can submit verification.');
    if (profile.verificationStatus === 'approved') fail('failed-precondition', 'This professional account is already verified.');
    if (priorSnap.exists && !['REQUIRES_CHANGES', 'REJECTED'].includes(priorSnap.data().status)) fail('failed-precondition', 'A verification submission is already being reviewed.');
    if (!text(profile.firstName, 80) || !text(profile.lastName, 80) || !text(profile.phoneNumber, 40)) fail('invalid-argument', 'Add your legal name and phone number to your profile.');
    if (!text(profile.licenseNumber, 100) || !text(profile.licenseType, 80) || !text(profile.brokerageRelationship, 40)) fail('invalid-argument', 'Complete your license and brokerage details.');
    if (!['AFFILIATED', 'INDEPENDENT', 'OTHER'].includes(profile.brokerageRelationship)) fail('invalid-argument', 'Choose a valid brokerage relationship.');
    if (profile.brokerageRelationship !== 'INDEPENDENT' && !text(profile.brokerageName, 180)) fail('invalid-argument', 'Add your brokerage name or select Independent Broker.');
    const policy = policySnap.exists ? policySnap.data() : null;
    const legalTemplate = legalSnap.exists && legalSnap.data()?.status === 'PUBLISHED' ? legalSnap.data() : null;
    if (!legalTemplate?.termsOfServiceUrl || !legalTemplate?.privacyPolicyUrl) fail('failed-precondition', 'The current Terms of Service and Privacy Policy must be published before verification can be submitted.');
    const requirements = policy?.requirements || {};
    for (const [itemId, definition] of Object.entries(VERIFICATION_ITEMS)) {
      if (definition.requirement && definition.document && requirements[definition.requirement] === true && !documents.some(document => document.documentType === itemId)) {
        fail('failed-precondition', `Upload the required ${definition.label.toLowerCase()} before submitting.`);
      }
    }
    if (requirements.licenseExpirationRequired === true && !text(profile.licenseExpirationDate, 20)) fail('failed-precondition', 'Add the license expiration date required by the jurisdiction policy.');
    if (requirements.brokerLicenseRequired === true && !text(profile.brokerLicenseNumber, 100)) fail('failed-precondition', 'Add the responsible broker license number required by the jurisdiction policy.');
    const items = configuredVerificationItems(policy || {}, documents, account.emailVerified);
    const version = (priorSnap.data()?.version || 0) + 1;
    const submission = {
      userId: uid, version, status: 'PENDING_REVIEW', policyStateCode: licenseStateCode,
      policyVersion: policy?.version || null, policyStatus: policy ? 'CONFIGURED' : 'MANUAL_POLICY_CONFIGURATION_REQUIRED',
      professionalType: text(profile.professionalType, 60), items, documents,
      identity: { firstName: text(profile.firstName, 80), middleName: text(profile.middleName, 80) || null, lastName: text(profile.lastName, 80), displayName: text(profile.displayName, 140), phoneNumber: text(profile.phoneNumber, 40) },
      license: { stateCode: licenseStateCode, licenseNumber: text(profile.licenseNumber, 100), licenseType: text(profile.licenseType, 80), expirationDate: text(profile.licenseExpirationDate, 20) || null },
      brokerage: { relationship: text(profile.brokerageRelationship, 40), name: text(profile.brokerageName, 180) || null, responsibleBroker: text(profile.responsibleBroker, 140) || null, brokerLicenseNumber: text(profile.brokerLicenseNumber, 100) || null, address: text(profile.brokerageAddress, 300) || null },
      declarations: Object.fromEntries(declarationIds.map(id => [id, { accepted: true, version: '2026-01', acceptedBy: uid, acceptedAt: FieldValue.serverTimestamp() }])),
      consents: Object.fromEntries(consentIds.map(id => [id, { accepted: true,
        version: id === 'terms' ? legalTemplate.termsOfServiceVersion || legalTemplate.version || 'current' : id === 'privacy' ? legalTemplate.privacyPolicyVersion || legalTemplate.version || 'current' : '2026-01',
        documentUrl: id === 'terms' ? legalTemplate.termsOfServiceUrl : id === 'privacy' ? legalTemplate.privacyPolicyUrl : null,
        acceptedBy: uid, acceptedAt: FieldValue.serverTimestamp() }])),
      submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    };
    const eventRef = submissionRef.collection('events').doc();
    const immutableVersionRef = submissionRef.collection('versions').doc(String(version));
    const notificationRef = db.collection('notifications').doc(`verification_${uid}_${version}_submitted`);
    tx.set(submissionRef, submission);
    tx.create(immutableVersionRef, submission);
    tx.set(userRef, {
      verificationStatus: 'pending', professionalVerificationStatus: 'PENDING_REVIEW',
      verificationSubmissionId: uid, verificationItems: items, verificationDocuments: documents,
      verificationPolicyId: licenseStateCode, verificationPolicyVersion: policy?.version || null,
      verificationSource: policy?.verificationSource || null,
      verificationPolicyConfigurationRequired: !policy, verificationSubmittedAt: FieldValue.serverTimestamp(),
      onboardingStatus: priorSnap.exists ? 'RESUBMITTED' : 'SUBMITTED', updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.create(eventRef, { eventType: priorSnap.exists ? 'VERIFICATION_RESUBMITTED' : 'VERIFICATION_SUBMITTED', actorId: uid, actorRole: 'PROFESSIONAL', userId: uid, submissionVersion: version, timestamp: FieldValue.serverTimestamp(), metadata: { policyStateCode: licenseStateCode, policyVersion: policy?.version || null, documentCount: documents.length } });
    tx.set(notificationRef, { userId: uid, category: 'Verification', title: 'Verification submitted', message: policy ? 'Your professional verification is in the review queue.' : 'Your information was received. An administrator must configure this state policy before review can proceed.', unread: true, createdAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('audit_logs').doc(), { actorUid: uid, actorRole: 'PROFESSIONAL', action: 'VERIFICATION_SUBMITTED', collection: 'verification_submissions', targetId: uid, reason: '', after: { version, stateCode: licenseStateCode, policyVersion: policy?.version || null }, createdAt: FieldValue.serverTimestamp() });
    return { ok: true, version, policyConfigured: Boolean(policy), status: 'PENDING_REVIEW' };
  });
  return result;
});

export const saveVerificationPolicy = onCall(callable, async request => {
  const actor = await authorize(request, 'SYSTEM_SETTINGS_MANAGE');
  if (actor.role !== ROLES.SUPER_ADMIN) fail('permission-denied', 'Only a Super Admin can manage jurisdiction policies.');
  const stateCode = text(request.data?.stateCode, 2).toUpperCase();
  const version = text(request.data?.version, 40);
  const requirementsInput = request.data?.requirements || {};
  if (!/^[A-Z]{2}$/.test(stateCode) || !version) fail('invalid-argument', 'A valid state code and policy version are required.');
  const requirements = {};
  for (const field of ['governmentIdRequired', 'licenseDocumentRequired', 'brokerageDocumentRequired', 'proofOfAddressRequired', 'backgroundCheckRequired', 'licenseExpirationRequired', 'brokerLicenseRequired']) requirements[field] = requirementsInput[field] === true;
  const sourceName = text(request.data?.sourceName, 160);
  const sourceUrl = text(request.data?.sourceUrl, 500);
  if (!sourceName || !/^https:\/\//i.test(sourceUrl)) fail('invalid-argument', 'Add the state licensing authority and its official HTTPS URL.');
  const currentRef = db.collection('verificationPolicies').doc(stateCode);
  const versionId = version.replaceAll('/', '-').replaceAll('.', '-');
  const versionRef = currentRef.collection('versions').doc(versionId);
  await db.runTransaction(async tx => {
    const existing = await tx.get(versionRef);
    if (existing.exists) fail('already-exists', 'That policy version already exists. Use a new version to preserve review history.');
    const policy = { stateCode, version, status: 'ACTIVE', effectiveFrom: text(request.data?.effectiveFrom, 20) || new Date().toISOString().slice(0, 10), requirements, verificationSource: { sourceType: 'STATE_REGULATOR', sourceName, sourceUrl }, managedBy: actor.uid, createdAt: FieldValue.serverTimestamp() };
    tx.create(versionRef, policy);
    tx.set(currentRef, { ...policy, activeVersionId: versionId, updatedAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('audit_logs').doc(), { actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: 'VERIFICATION_POLICY_PUBLISHED', collection: 'verificationPolicies', targetId: stateCode, reason: '', after: { stateCode, version, requirements, sourceName, sourceUrl }, createdAt: FieldValue.serverTimestamp() });
  });
  let reconciled = 0;
  const pendingSubmissions = await db.collection('verification_submissions').where('policyStateCode', '==', stateCode).where('status', 'in', ['PENDING_REVIEW', 'REQUIRES_CHANGES']).get();
  for (let offset = 0; offset < pendingSubmissions.docs.length; offset += 150) {
    const batch = db.batch();
    const docs = pendingSubmissions.docs.slice(offset, offset + 150);
    for (const submissionSnap of docs) {
      const submission = submissionSnap.data();
      const profileRef = db.collection('users').doc(submission.userId);
      const profile = (await profileRef.get()).data() || {};
      const items = configuredVerificationItems({ requirements, version, verificationSource: { sourceType: 'STATE_REGULATOR', sourceName, sourceUrl } }, submission.documents || [], profile.emailVerified === true, submission.items || {});
      batch.update(submissionSnap.ref, { items, policyVersion: version, policyStatus: 'CONFIGURED', updatedAt: FieldValue.serverTimestamp() });
      batch.update(profileRef, { verificationItems: items, verificationPolicyVersion: version, verificationPolicyConfigurationRequired: false, verificationSource: { sourceType: 'STATE_REGULATOR', sourceName, sourceUrl }, updatedAt: FieldValue.serverTimestamp() });
      batch.create(submissionSnap.ref.collection('events').doc(), { eventType: 'POLICY_CONFIGURATION_UPDATED', actorId: actor.uid, actorRole: actor.role, userId: submission.userId, timestamp: FieldValue.serverTimestamp(), metadata: { stateCode, version } });
      reconciled += 1;
    }
    await batch.commit();
  }
  return { ok: true, stateCode, version, reconciled };
});

export const reviewProfessionalVerificationItem = onCall(callable, async request => {
  const uid = text(request.data?.userId, 150);
  const itemId = text(request.data?.itemId, 40).toUpperCase();
  const decision = text(request.data?.decision, 40).toUpperCase();
  const reason = text(request.data?.reason, 1000);
  const permission = decision === 'VERIFY' ? 'VERIFICATION_APPROVE' : decision === 'REJECT' ? 'VERIFICATION_REJECT' : 'VERIFICATION_REVIEW';
  if (!uid || !Object.hasOwn(VERIFICATION_ITEMS, itemId) || !['VERIFY', 'REQUEST_CHANGES', 'REJECT'].includes(decision)) fail('invalid-argument', 'Choose a verification item and review decision.');
  if (decision !== 'VERIFY' && !reason) fail('invalid-argument', 'A reason is required for change requests and rejections.');
  const actor = await authorize(request, permission);
  const userRef = db.collection('users').doc(uid);
  const submissionRef = db.collection('verification_submissions').doc(uid);
  const account = await auth.getUser(uid);
  const sourceName = text(request.data?.sourceName, 160);
  const sourceUrl = text(request.data?.sourceUrl, 500);
  if (decision === 'VERIFY' && ['LICENSE', 'BROKERAGE'].includes(itemId) && (!sourceName || !/^https:\/\//i.test(sourceUrl))) {
    fail('invalid-argument', itemId === 'LICENSE' ? 'Record the official licensing source used to verify this license.' : 'Record the source used to verify this brokerage relationship.');
  }
  const result = await db.runTransaction(async tx => {
    const [userSnap, submissionSnap] = await Promise.all([tx.get(userRef), tx.get(submissionRef)]);
    if (!userSnap.exists || !submissionSnap.exists) fail('not-found', 'Verification submission not found.');
    const user = userSnap.data();
    const submission = submissionSnap.data();
    if (!['PENDING_REVIEW', 'REQUIRES_CHANGES'].includes(submission.status)) fail('failed-precondition', 'This submission is not open for review.');
    const policySnap = await tx.get(db.collection('verificationPolicies').doc(submission.policyStateCode));
    if (!policySnap.exists) fail('failed-precondition', `Configure the ${submission.policyStateCode} jurisdiction policy before approving this submission.`);
    const items = configuredVerificationItems(policySnap.data(), submission.documents || [], account.emailVerified, submission.items || {});
    if (!items[itemId]) fail('failed-precondition', 'This item is not part of the configured verification policy.');
    const prior = items[itemId];
    if (decision === 'VERIFY' && VERIFICATION_ITEMS[itemId].document && prior.required && !prior.documentIds?.length) fail('failed-precondition', `No required ${prior.label.toLowerCase()} is attached to this submission.`);
    const status = decision === 'VERIFY' ? 'VERIFIED' : decision === 'REJECT' ? 'REJECTED' : 'CHANGES_REQUESTED';
    items[itemId] = { ...prior, status, reviewerId: actor.uid, reviewedAt: FieldValue.serverTimestamp(), reason: reason || null,
      ...(['LICENSE', 'BROKERAGE'].includes(itemId) && decision === 'VERIFY' ? { verificationSource: { sourceType: itemId === 'LICENSE' ? 'STATE_REGULATOR' : 'BROKERAGE_SOURCE', sourceName, sourceUrl, verifiedAt: FieldValue.serverTimestamp(), verifiedBy: actor.uid, sourceReference: text(request.data?.sourceReference, 180) || null } } : {}) };
    const aggregate = verificationAggregate(items, true);
    const profileStatus = aggregate === 'APPROVED' ? 'approved' : aggregate === 'REQUIRES_CHANGES' ? 'requires_changes' : aggregate === 'REJECTED' ? 'rejected' : 'pending';
    const eventRef = submissionRef.collection('events').doc();
    const notificationRef = db.collection('notifications').doc();
    tx.update(submissionRef, { items, status: aggregate, updatedAt: FieldValue.serverTimestamp(), reviewedBy: actor.uid, reviewedAt: FieldValue.serverTimestamp() });
    tx.update(userRef, { verificationItems: items, verificationStatus: profileStatus, professionalVerificationStatus: aggregate, verificationReviewedBy: actor.uid, verificationReviewedAt: FieldValue.serverTimestamp(), verificationReason: reason || null, accountStatus: aggregate === 'APPROVED' ? 'ACTIVE' : user.accountStatus || 'PENDING', verificationPolicyVersion: policySnap.data().version, verificationPolicyConfigurationRequired: false, updatedAt: FieldValue.serverTimestamp() });
    tx.create(eventRef, { eventType: status === 'VERIFIED' ? 'ITEM_VERIFIED' : status, actorId: actor.uid, actorRole: actor.role, userId: uid, itemId, reason: reason || null, metadata: { sourceName: sourceName || null, sourceUrl: sourceUrl || null, sourceReference: text(request.data?.sourceReference, 180) || null }, timestamp: FieldValue.serverTimestamp() });
    tx.set(notificationRef, { userId: uid, category: 'Verification', title: aggregate === 'APPROVED' ? 'Professional verification approved' : status === 'CHANGES_REQUESTED' ? 'Action required for verification' : status === 'REJECTED' ? 'Verification item rejected' : `${prior.label} verified`, message: aggregate === 'APPROVED' ? 'All required verification checks passed. Marketplace access is now available.' : `${prior.label}: ${status.toLowerCase().replaceAll('_', ' ')}${reason ? ` — ${reason}` : ''}`, itemId, unread: true, createdAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('audit_logs').doc(), { actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: status === 'VERIFIED' ? 'VERIFICATION_ITEM_VERIFIED' : status, collection: 'verification_submissions', targetId: uid, reason, before: { itemId, status: prior.status, overallStatus: submission.status }, after: { itemId, status, overallStatus: aggregate }, createdAt: FieldValue.serverTimestamp() });
    return { ok: true, itemId, itemStatus: status, status: aggregate, verificationStatus: profileStatus, items };
  });
  return result;
});

export const approveProfessionalVerification = onCall(callable, async request => {
  const uid = text(request.data?.userId, 150);
  if (!uid) fail('invalid-argument', 'A professional account ID is required.');
  const actor = await authorize(request, 'VERIFICATION_APPROVE');
  const userRef = db.collection('users').doc(uid);
  const submissionRef = db.collection('verification_submissions').doc(uid);
  const notificationRef = db.collection('notifications').doc();
  const eventRef = submissionRef.collection('events').doc();

  const result = await db.runTransaction(async tx => {
    const [userSnap, submissionSnap] = await Promise.all([tx.get(userRef), tx.get(submissionRef)]);
    if (!userSnap.exists) fail('not-found', 'Professional user not found.');
    const user = userSnap.data();
    if (String(user.verificationStatus || '').toLowerCase() === 'approved') return { ok: true, status: 'approved', alreadyApproved: true };
    if (submissionSnap.exists && !['PENDING_REVIEW', 'REQUIRES_CHANGES'].includes(String(submissionSnap.data()?.status || '').toUpperCase())) {
      fail('failed-precondition', 'This verification submission is no longer awaiting a decision. Refresh the directory and review its current status.');
    }

    tx.update(userRef, {
      verificationStatus: 'approved',
      professionalVerificationStatus: 'approved',
      accountStatus: 'ACTIVE',
      verificationReviewedBy: actor.uid,
      verificationReviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    if (submissionSnap.exists) {
      tx.update(submissionRef, {
        status: 'APPROVED',
        reviewedBy: actor.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.create(eventRef, {
        eventType: 'SUBMISSION_APPROVED',
        actorId: actor.uid,
        actorRole: actor.role,
        userId: uid,
        timestamp: FieldValue.serverTimestamp()
      });
    }

    tx.set(notificationRef, {
      userId: uid,
      category: 'Verification',
      title: 'Professional verification approved',
      message: 'Your credentials have been verified and approved. You now have full access to marketplace opportunities and contracts.',
      unread: true,
      createdAt: FieldValue.serverTimestamp()
    });

    tx.create(db.collection('audit_logs').doc(), {
      actorUid: actor.uid,
      actorRole: actor.role,
      actorEmail: actor.email,
      action: 'PROFESSIONAL_VERIFICATION_APPROVED',
      collection: 'users',
      targetId: uid,
      createdAt: FieldValue.serverTimestamp()
    });
    return { ok: true, status: 'approved', alreadyApproved: false };
  });

  return result;
});

export const rejectProfessionalVerificationSubmission = onCall(callable, async request => {
  const uid = text(request.data?.userId, 150);
  const reason = text(request.data?.reason, 1000);
  if (!uid || !reason) fail('invalid-argument', 'A professional account and a rejection reason are required.');
  const actor = await authorize(request, 'VERIFICATION_REJECT');
  const userRef = db.collection('users').doc(uid);
  const submissionRef = db.collection('verification_submissions').doc(uid);
  const notificationRef = db.collection('notifications').doc();
  const result = await db.runTransaction(async tx => {
    const [userSnap, submissionSnap] = await Promise.all([tx.get(userRef), tx.get(submissionRef)]);
    if (!userSnap.exists || !submissionSnap.exists) fail('not-found', 'Verification submission not found.');
    const user = userSnap.data();
    const submission = submissionSnap.data();
    if (!['PENDING_REVIEW', 'REQUIRES_CHANGES'].includes(submission.status)) fail('failed-precondition', 'Only an open verification submission can be rejected.');
    const items = Object.fromEntries(Object.entries(submission.items || {}).map(([itemId, item]) => [itemId, item.required ? {
      ...item, status: 'REJECTED', reviewerId: actor.uid, reviewedAt: FieldValue.serverTimestamp(), reason,
    } : item]));
    tx.update(submissionRef, { items, status: 'REJECTED', rejectionReason: reason, rejectedBy: actor.uid, rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(userRef, { verificationItems: items, verificationStatus: 'rejected', professionalVerificationStatus: 'REJECTED', verificationReason: reason, verificationRestartRequired: true, verificationReviewedBy: actor.uid, verificationReviewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.create(submissionRef.collection('events').doc(), { eventType: 'SUBMISSION_REJECTED', actorId: actor.uid, actorRole: actor.role, userId: uid, reason, timestamp: FieldValue.serverTimestamp(), metadata: { requiresFullResubmission: true } });
    tx.set(notificationRef, { userId: uid, category: 'Verification', title: 'Verification needs to be restarted', message: `Your verification submission was rejected. Complete and submit the full verification process again. Reason: ${reason}`, unread: true, createdAt: FieldValue.serverTimestamp() });
    tx.create(db.collection('audit_logs').doc(), { actorUid: actor.uid, actorRole: actor.role, actorEmail: actor.email, action: 'VERIFICATION_SUBMISSION_REJECTED', collection: 'verification_submissions', targetId: uid, reason, before: { overallStatus: submission.status }, after: { overallStatus: 'REJECTED', requiresFullResubmission: true }, createdAt: FieldValue.serverTimestamp() });
    return { ok: true, status: 'REJECTED', requiresFullResubmission: true };
  });
  return result;
});

export const adminDashboard = onCall(callable, async request => {
  await authorize(request, 'USERS_VIEW');
  const count = async (collection, field, op, value) => {
    let query = db.collection(collection);
    if (field) query = query.where(field, op, value);
    return (await query.count().get()).data().count;
  };
  const [totalProfessionals, pendingVerification, verifiedProfessionals, activeReferrals, pendingApplications,
    activeAgreements, completedReferrals, openSupportRequests, recentActivity] = await Promise.all([
      count('users', 'role', '==', ROLES.PROFESSIONAL),
      count('users', 'verificationStatus', '==', 'pending'),
      count('users', 'verificationStatus', '==', 'approved'),
      count('referrals', 'status', 'in', ['open', 'Published', 'Active', 'published', 'active']),
      count('applications', 'status', 'in', ['PENDING', 'pending', 'SUBMITTED']),
      count('agreements', 'status', 'in', ['ACTIVE', 'active', 'PENDING_SIGNATURES']),
      count('referrals', 'status', 'in', ['COMPLETED', 'completed']),
      count('support_requests', 'status', 'in', ['open', 'OPEN', 'pending']),
      db.collection('activity').orderBy('createdAt', 'desc').limit(12).get(),
    ]);
  return { metrics: { totalProfessionals, pendingVerification, verifiedProfessionals, activeReferrals, pendingApplications,
    activeAgreements, completedReferrals, openSupportRequests }, activity: recentActivity.docs.map(safeDoc) };
});

export const adminList = onCall(callable, async request => {
  const module = moduleFor(text(request.data?.module, 40));
  const actor = await authorize(request, module.permission);
  if (!module.collection) fail('invalid-argument', 'This module has no record list.');
  const pageSize = Math.min(Math.max(Number(request.data?.pageSize) || 25, 1), 50);
  let query = db.collection(module.collection);
  if (module.path === 'professionals') query = query.where('role', 'in', ['PROFESSIONAL', 'professional']);
  if (module.path === 'verification') query = query.where('verificationStatus', 'in', ['pending', 'requires_changes', 'rejected', 'approved']);
  if (module.path === 'admin-users') query = query.where('role', 'in', ['ADMIN', 'SUPER_ADMIN']);
  if (module.path === 'security') query = query.where('action', 'in', ['ROLE_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED']);
  if (module.path === 'notifications' && actor.role !== ROLES.SUPER_ADMIN) query = query.where('userId', '==', actor.uid);
  query = query.orderBy(FieldPath.documentId()).limit(pageSize + 1);
  const cursor = text(request.data?.cursor, 256);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  const docs = snapshot.docs.slice(0, pageSize).map(safeDoc);
  return { rows: docs, nextCursor: snapshot.docs.length > pageSize ? snapshot.docs[pageSize - 1].id : null };
});

export const adminAction = onCall(callable, async request => {
  const action = text(request.data?.action, 40);
  const targetId = text(request.data?.targetId, 256);
  const reason = text(request.data?.reason, 1000);
  if (!targetId || !reason) fail('invalid-argument', 'Target and reason are required.');
  const permissions = {
    MODERATE_REFERRAL: 'REFERRALS_MODERATE', CANCEL_REFERRAL: 'REFERRALS_CANCEL',
    SUSPEND_USER: 'USERS_SUSPEND', REACTIVATE_USER: 'USERS_REACTIVATE',
    MANAGE_ADMIN_ROLE: 'ADMINS_MANAGE', RESOLVE_SUPPORT: 'SUPPORT_MANAGE',
  };
  if (!permissions[action]) fail('invalid-argument', 'Unknown action.');
  const actor = await authorize(request, permissions[action]);
  if (action === 'MANAGE_ADMIN_ROLE') return changeAdminRole(actor, targetId, request.data?.role, reason);
  if (['SUSPEND_USER', 'REACTIVATE_USER'].includes(action)) return changeUserStatus(actor, action, targetId, reason);
  const collection = action.includes('REFERRAL') ? 'referrals' : 'support_requests';
  const ref = db.collection(collection).doc(targetId);
  const before = await ref.get();
  if (!before.exists) fail('not-found', 'Record not found.');
  const old = before.data();
  let patch;
  if (action === 'MODERATE_REFERRAL' || action === 'CANCEL_REFERRAL') {
    patch = { status: action === 'CANCEL_REFERRAL' ? 'cancelled' : 'under_review', moderatedBy: actor.uid,
      moderatedAt: FieldValue.serverTimestamp(), moderationReason: reason };
  } else {
    patch = { status: 'resolved', resolvedBy: actor.uid, resolvedAt: FieldValue.serverTimestamp(), resolution: reason };
  }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists || current.updateTime.toMillis() !== before.updateTime.toMillis()) fail('aborted', 'Record changed. Refresh and retry.');
    tx.update(ref, patch);
  });
  await audit(actor, action, collection, targetId, old, { ...old, ...patch }, reason);
  return { ok: true };
});

async function changeUserStatus(actor, action, uid, reason) {
  if (uid === actor.uid) fail('failed-precondition', 'You cannot change your own account status.');
  const target = await auth.getUser(uid);
  if (target.customClaims?.platformRole === ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) fail('permission-denied', 'Only Super Admin can change an admin account.');
  if (target.customClaims?.platformRole === ROLES.SUPER_ADMIN) fail('permission-denied', 'Super Admin accounts require a separate recovery process.');
  const disabled = action === 'SUSPEND_USER';
  await auth.updateUser(uid, { disabled });
  const ref = db.collection('users').doc(uid);
  const before = (await ref.get()).data() || null;
  await ref.set({ accountStatus: disabled ? 'suspended' : 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await audit(actor, action === 'SUSPEND_USER' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', 'users', uid, before,
    { ...before, accountStatus: disabled ? 'suspended' : 'active' }, reason);
  return { ok: true };
}

async function changeAdminRole(actor, uid, role, reason) {
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.PROFESSIONAL].includes(role)) fail('invalid-argument', 'Invalid role.');
  if (uid === actor.uid) fail('failed-precondition', 'You cannot change your own role.');
  const target = await auth.getUser(uid);
  const oldRole = target.customClaims?.platformRole || ROLES.PROFESSIONAL;
  if (oldRole === role) return { ok: true };
  const lock = db.doc('system/admin-role-lock');
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async tx => {
    await tx.get(lock);
    const superAdmins = await tx.get(db.collection('users').where('role', '==', ROLES.SUPER_ADMIN));
    if (oldRole === ROLES.SUPER_ADMIN && superAdmins.size <= 1) fail('failed-precondition', 'The last Super Admin cannot be removed.');
    tx.set(lock, { updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(ref, { role, platformRole: role, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  try {
    const { role: _legacyRole, admin: _legacyAdmin, ...existingClaims } = target.customClaims || {};
    await auth.setCustomUserClaims(uid, { ...existingClaims, platformRole: role });
    await auth.revokeRefreshTokens(uid);
  } catch (error) {
    await ref.set({ role: oldRole, platformRole: oldRole, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
  await audit(actor, 'ROLE_CHANGED', 'users', uid, { role: oldRole }, { role }, reason);
  return { ok: true };
}

const REQUIRED_PARTY_FIELDS = ['name', 'email', 'phone', 'brokerage', 'brokerageAddress', 'licenseNumber', 'licenseState'];
const missingPartyFields = party => REQUIRED_PARTY_FIELDS.filter(field => !text(party?.[field], 300));

export const saveAgreementTemplate = onCall(callable, async request => {
  const actor = await authorize(request, 'AGREEMENTS_MANAGE');
  const name = text(request.data?.name, 120);
  const sections = Array.isArray(request.data?.sections) ? request.data.sections.slice(0, 24).map((section, index) => ({
    id: text(section?.id, 80) || `section-${index + 1}`, title: text(section?.title, 160), body: text(section?.body, 12000),
  })) : [];
  const action = text(request.data?.action, 20).toUpperCase();
  const privacyPolicyUrl = text(request.data?.privacyPolicyUrl, 1000);
  const termsOfServiceUrl = text(request.data?.termsOfServiceUrl, 1000);
  for (const url of [privacyPolicyUrl, termsOfServiceUrl].filter(Boolean)) {
    try { if (!['http:', 'https:'].includes(new URL(url).protocol)) fail('invalid-argument', 'Policy links must use HTTPS.'); }
    catch (error) { if (error instanceof HttpsError) throw error; fail('invalid-argument', 'Enter a valid HTTPS policy link.'); }
  }
  if (!name || sections.length < 1 || sections.some(section => !section.title) || (action === 'PUBLISH' && sections.some(section => !section.body))) fail('invalid-argument', 'Add a title and approved text for every section before publishing.');
  if (!['SAVE_DRAFT', 'PUBLISH'].includes(action)) fail('invalid-argument', 'Choose whether to save a draft or publish the template.');
  if (action === 'PUBLISH' && (!privacyPolicyUrl || !termsOfServiceUrl)) fail('failed-precondition', 'Add both the Privacy Policy and Terms of Service HTTPS URLs before publishing.');
  const activeRef = db.doc('system_settings/active_agreement_template');
  const draftRef = db.doc('system_settings/agreement_template_draft');
  const versionRef = db.doc('system_settings/agreement_template_version');
  let version = 1;
  const templateId = `referral-${randomUUID()}`;
  const templateRef = db.collection('agreement_templates').doc(templateId);
  await db.runTransaction(async tx => {
    const current = await tx.get(versionRef);
    version = Number(current.data()?.version || 0) + 1;
    const template = { templateId, name, version, sections, status: action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT',
      privacyPolicyVersion: text(request.data?.privacyPolicyVersion, 40) || 'current',
      termsOfServiceVersion: text(request.data?.termsOfServiceVersion, 40) || 'current', privacyPolicyUrl, termsOfServiceUrl,
      captureSignerIp: request.data?.captureSignerIp === true,
      publishedBy: action === 'PUBLISH' ? actor.uid : null, createdBy: actor.uid,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    tx.create(templateRef, template);
    tx.set(versionRef, { version, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (action === 'PUBLISH') { tx.set(activeRef, template, { merge: false }); tx.delete(draftRef); }
    else tx.set(draftRef, template, { merge: false });
  });
  await audit(actor, action === 'PUBLISH' ? 'AGREEMENT_TEMPLATE_PUBLISHED' : 'AGREEMENT_TEMPLATE_DRAFT_SAVED', 'agreement_templates', templateId, null,
    { templateId, version, status: action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT' }, 'Agreement template configuration');
  return { ok: true, templateId, version, status: action === 'PUBLISH' ? 'PUBLISHED' : 'DRAFT' };
});

export const prepareAgreementDraft = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.email_verified !== true) fail('unauthenticated', 'Sign in with a verified email first.');
  const id = text(request.data?.agreementId, 150);
  if (!id || id.includes('/')) fail('invalid-argument', 'Agreement ID is required.');
  const ref = db.collection('agreements').doc(id);
  const initialSnap = await ref.get();
  if (!initialSnap.exists) fail('not-found', 'Agreement not found.');
  const initial = initialSnap.data();
  if (initial.referringProfessionalId !== uid) fail('permission-denied', 'Only the referring professional may prepare agreement terms.');
  const initialStatus = signatureStatus(initial.status);
  const legacyDraft = ['READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(initialStatus) && !initial.signedByReferring && !initial.signedByReceiving;
  if (!(initialStatus === 'DRAFT' || legacyDraft) || initial.referrerSignature?.signedAt || initial.receiverSignature?.signedAt || initial.isImmutable) fail('failed-precondition', 'Only an unsigned draft can be prepared.');
  const applicationId = text(initial.applicationId || id.replace(/^application_/, ''), 256);
  const [templateSnap, referrerProfileSnap, receiverProfileSnap, referrerAccount, receiverAccount, referralSnap] = await Promise.all([
    db.doc('system_settings/active_agreement_template').get(),
    db.collection('users').doc(initial.referringProfessionalId).get(), db.collection('users').doc(initial.receivingProfessionalId).get(),
    auth.getUser(initial.referringProfessionalId), auth.getUser(initial.receivingProfessionalId),
    initial.referralId ? db.collection('referrals').doc(initial.referralId).get() : Promise.resolve(null),
  ]);
  if (!templateSnap.exists || templateSnap.data()?.status !== 'PUBLISHED' || !templateSnap.data()?.sections?.length) fail('failed-precondition', 'An administrator must publish the approved agreement terms first.');
  const mergeMissing = (existing, current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, existing?.[key] || value]));
  const referrer = mergeMissing(initial.referringParty || { name: initial.referringName, email: initial.referringEmail, phone: initial.referringPhone, brokerage: initial.referringBrokerage, brokerageAddress: initial.referringBrokerageAddress, licenseNumber: initial.referringLicenseNumber, licenseState: initial.referringLicenseState }, partySnapshot(initial.referringProfessionalId, referrerAccount, referrerProfileSnap.data() || {}));
  const receiver = mergeMissing(initial.receivingParty || { name: initial.receivingName, email: initial.receivingEmail, phone: initial.receivingPhone, brokerage: initial.receivingBrokerage, brokerageAddress: initial.receivingBrokerageAddress, licenseNumber: initial.receivingLicenseNumber, licenseState: initial.receivingLicenseState }, partySnapshot(initial.receivingProfessionalId, receiverAccount, receiverProfileSnap.data() || {}));
  const referral = referralSnap?.data() || {};
  const referralSnapshot = initial.referralSnapshot || {
    id: initial.referralId || null, title: text(referral.title || initial.referralTitle, 240),
    referralType: text(referral.type || referral.clientType || referral.category, 80) || null,
    clientType: text(referral.clientType, 80) || null, city: text(referral.city, 120) || null,
    state: text(referral.state, 120) || null, zip: text(referral.zip, 20) || null,
    propertyType: text(referral.propertyType, 100) || null, minPrice: referral.minValue ?? null, maxPrice: referral.maxValue ?? null,
    priceRange: [referral.minValue, referral.maxValue].filter(v => v != null && v !== '').join(' – ') || null,
    referralFee: { percent: Number(initial.feePercent ?? referral.feePercent), basis: text(referral.feeBasis, 160) || null,
      paymentCondition: text(referral.paymentCondition, 240) || null, paymentTiming: text(referral.paymentTiming, 240) || null },
    description: text(referral.description, 10000) || null, preferences: text(referral.preferences, 5000) || null,
    originalCreatedAt: serialize(referral.createdAt) || null,
  };
  const template = templateSnap.data();
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    const currentStatus = signatureStatus(current.data()?.status);
    const canPrepareCurrent = currentStatus === 'DRAFT' || (['READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(currentStatus) && !current.data()?.signedByReferring && !current.data()?.signedByReceiving);
    if (!current.exists || !canPrepareCurrent || current.data()?.referringProfessionalId !== uid || current.data()?.isImmutable) fail('failed-precondition', 'The agreement changed and can no longer be prepared as a draft.');
    tx.update(ref, { referringParty: referrer, receivingParty: receiver,
      referringName: referrer.name, referringEmail: referrer.email, referringPhone: referrer.phone, referringBrokerage: referrer.brokerage, referringBrokerageAddress: referrer.brokerageAddress, referringLicenseNumber: referrer.licenseNumber, referringLicenseState: referrer.licenseState,
      receivingName: receiver.name, receivingEmail: receiver.email, receivingPhone: receiver.phone, receivingBrokerage: receiver.brokerage, receivingBrokerageAddress: receiver.brokerageAddress, receivingLicenseNumber: receiver.licenseNumber, receivingLicenseState: receiver.licenseState,
      referralTitle: referralSnapshot.title || initial.referralTitle || null, referralSnapshot,
      termsSnapshotArrangement: { feePercent: referralSnapshot.referralFee?.percent ?? initial.feePercent ?? null, feeBasis: referralSnapshot.referralFee?.basis || null, paymentCondition: referralSnapshot.referralFee?.paymentCondition || null, paymentTiming: referralSnapshot.referralFee?.paymentTiming || null },
      applicationId, agreementVersion: Number(initial.agreementVersion || 1),
      agreementTemplateId: template.templateId, agreementTemplateVersion: template.version,
      termsSnapshot: { name: template.name || 'Referral Agreement', version: template.version, sections: template.sections },
      privacyPolicyVersion: template.privacyPolicyVersion || 'current', termsOfServiceVersion: template.termsOfServiceVersion || 'current',
      privacyPolicyUrl: template.privacyPolicyUrl || null, termsOfServiceUrl: template.termsOfServiceUrl || null,
      captureSignerIp: template.captureSignerIp === true, status: 'DRAFT', isImmutable: false,
      templateMissing: false, updatedAt: FieldValue.serverTimestamp() });
    agreementEvent(tx, ref, 'AGREEMENT_DRAFT_PREPARED', uid, { agreementTemplateVersion: template.version });
  });
  return { ok: true, agreementTemplateVersion: template.version };
});

export const createAgreementAmendment = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.email_verified !== true) fail('unauthenticated', 'Sign in with a verified email first.');
  const parentId = text(request.data?.agreementId, 150);
  const summary = text(request.data?.summary, 5000);
  if (!parentId || parentId.includes('/') || summary.length < 20) fail('invalid-argument', 'Describe the amendment in at least 20 characters.');
  const parentRef = db.collection('agreements').doc(parentId);
  const parentSnap = await parentRef.get();
  if (!parentSnap.exists) fail('not-found', 'The original agreement could not be found.');
  const parent = parentSnap.data();
  if (uid !== parent.referringProfessionalId && uid !== parent.receivingProfessionalId) fail('permission-denied', 'Only an agreement party can propose an amendment.');
  if (parent.status !== 'ACTIVE' || !parent.isImmutable || !parent.document?.storagePath) fail('failed-precondition', 'Only an active, finalized agreement can be amended.');
  const account = await auth.getUser(uid);
  if (account.disabled || !account.emailVerified) fail('permission-denied', 'A verified account is required to propose an amendment.');
  const counterRef = db.doc('system_settings/agreement_number_counter');
  const versionCounterRef = db.collection('agreement_amendment_counters').doc(parentId);
  const amendmentRef = db.collection('agreements').doc(`amendment_${parentId}_${randomUUID()}`);
  let agreementNumber;
  let nextVersion;
  await db.runTransaction(async tx => {
    const [currentParent, counterSnap, versionCounterSnap] = await Promise.all([tx.get(parentRef), tx.get(counterRef), tx.get(versionCounterRef)]);
    if (!currentParent.exists || currentParent.data()?.status !== 'ACTIVE' || !currentParent.data()?.isImmutable) fail('failed-precondition', 'The original agreement changed and cannot be amended.');
    const sequence = Number(counterSnap.data()?.sequence || 0) + 1;
    nextVersion = Math.max(Number(parent.agreementVersion || 1), Number(versionCounterSnap.data()?.lastVersion || parent.agreementVersion || 1)) + 1;
    agreementNumber = `AGR-${new Date().getUTCFullYear()}-${String(sequence).padStart(6, '0')}`;
    const timestamp = FieldValue.serverTimestamp();
    const sections = [...(parent.termsSnapshot?.sections || []), { id: `amendment-${nextVersion}`, title: 'Amendment details', body: summary }];
    tx.create(amendmentRef, { agreementNumber, agreementVersion: nextVersion,
      parentAgreementId: parentId, amendmentSummary: summary, agreementTemplateId: parent.agreementTemplateId,
      agreementTemplateVersion: parent.agreementTemplateVersion, termsSnapshot: { ...parent.termsSnapshot, sections },
      privacyPolicyVersion: parent.privacyPolicyVersion, termsOfServiceVersion: parent.termsOfServiceVersion,
      privacyPolicyUrl: parent.privacyPolicyUrl, termsOfServiceUrl: parent.termsOfServiceUrl, captureSignerIp: parent.captureSignerIp === true,
      referralId: parent.referralId, applicationId: parent.applicationId,
      referringProfessionalId: parent.referringProfessionalId, receivingProfessionalId: parent.receivingProfessionalId,
      referringBrokerageId: parent.referringBrokerageId || null, receivingBrokerageId: parent.receivingBrokerageId || null,
      referringParty: parent.referringParty, receivingParty: parent.receivingParty,
      referringName: parent.referringName, referringEmail: parent.referringEmail, referringPhone: parent.referringPhone, referringBrokerage: parent.referringBrokerage, referringLicenseNumber: parent.referringLicenseNumber, referringLicenseState: parent.referringLicenseState,
      receivingName: parent.receivingName, receivingEmail: parent.receivingEmail, receivingPhone: parent.receivingPhone, receivingBrokerage: parent.receivingBrokerage, receivingLicenseNumber: parent.receivingLicenseNumber, receivingLicenseState: parent.receivingLicenseState,
      referralTitle: parent.referralTitle, referralSnapshot: parent.referralSnapshot, termsSnapshotArrangement: parent.termsSnapshotArrangement,
      status: 'DRAFT', stage: 'AGREEMENT', isImmutable: false,
      referrerSignature: { status: 'PENDING' }, receiverSignature: { status: 'PENDING' },
      signedByReferring: false, signedByReceiving: false, document: null, createdAt: timestamp, updatedAt: timestamp });
    tx.set(counterRef, { sequence, updatedAt: timestamp }, { merge: true });
    tx.set(versionCounterRef, { lastVersion: nextVersion, updatedAt: timestamp }, { merge: true });
    agreementEvent(tx, amendmentRef, 'AMENDMENT_CREATED', uid, { parentAgreementId: parentId, agreementVersion: nextVersion, summary });
    agreementEvent(tx, parentRef, 'AMENDMENT_CREATED', uid, { childAgreementId: amendmentRef.id, agreementVersion: nextVersion });
  });
  return { ok: true, agreementId: amendmentRef.id, agreementNumber };
});

async function finalizeAgreementPdf(agreementId) {
  const ref = db.collection('agreements').doc(agreementId);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'Agreement not found.');
  const ag = { id: snap.id, ...snap.data() };
  if (ag.status === 'ACTIVE' && ag.document?.storagePath) return { active: true, pdfReady: true };
  if (ag.status !== 'SIGNED' || !ag.referrerSignature?.signedAt || !ag.receiverSignature?.signedAt) fail('failed-precondition', 'Both parties must sign before finalizing the agreement.');
  const canonical = JSON.stringify({ agreementNumber: ag.agreementNumber, agreementVersion: ag.agreementVersion,
    agreementTemplateId: ag.agreementTemplateId, agreementTemplateVersion: ag.agreementTemplateVersion,
    parentAgreementId: ag.parentAgreementId || null, amendmentSummary: ag.amendmentSummary || null,
    referringParty: ag.referringParty, receivingParty: ag.receivingParty, referralSnapshot: ag.referralSnapshot,
    termsSnapshot: ag.termsSnapshot, referrerSignature: serialize(ag.referrerSignature), receiverSignature: serialize(ag.receiverSignature),
    effectiveDate: serialize(ag.effectiveDate),
    privacyPolicyVersion: ag.privacyPolicyVersion, termsOfServiceVersion: ag.termsOfServiceVersion,
    privacyPolicyUrl: ag.privacyPolicyUrl, termsOfServiceUrl: ag.termsOfServiceUrl });
  const documentHash = createHash('sha256').update(canonical).digest('hex');
  const finalAgreement = { ...ag, document: { ...(ag.document || {}), hash: documentHash } };
  const bytes = buildAgreementPdf(finalAgreement);
  const pdfHash = createHash('sha256').update(bytes).digest('hex');
  const storagePath = `executed-agreements/${agreementId}/v${ag.agreementVersion || 1}.pdf`;
  const file = storage.bucket().file(storagePath);
  try {
    await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: 'application/pdf', cacheControl: 'private, max-age=0, no-transform', metadata: { agreementId, agreementNumber: ag.agreementNumber || '', sha256: pdfHash } } });
  } catch (error) {
    if (Number(error?.code) !== 412) throw error;
    const [metadata] = await file.getMetadata();
    if (metadata.metadata?.sha256 !== pdfHash) fail('already-exists', 'An executed PDF already exists with different contents. Contact support.');
  }
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) fail('not-found', 'Agreement not found.');
    const data = current.data();
    if (data.status === 'ACTIVE' && data.document?.storagePath) return;
    if (data.status !== 'SIGNED' || !data.referrerSignature?.signedAt || !data.receiverSignature?.signedAt) fail('aborted', 'The agreement changed while the PDF was being generated.');
    const timestamp = FieldValue.serverTimestamp();
    tx.update(ref, { status: 'ACTIVE', stage: 'AGREEMENT', isImmutable: true,
      document: { storagePath, fileName: `${ag.agreementNumber || agreementId}.pdf`, contentType: 'application/pdf', hash: documentHash, pdfHash, generatedAt: timestamp },
      activatedAt: timestamp, updatedAt: timestamp });
    agreementEvent(tx, ref, 'AGREEMENT_ACTIVATED', null, { documentHash, pdfHash, storagePath });
    agreementEvent(tx, ref, 'PDF_GENERATED', null, { documentHash, pdfHash, storagePath });
    for (const participant of [data.referringProfessionalId, data.receivingProfessionalId]) {
      const notificationRef = db.collection('notifications').doc(`agreement_active_${agreementId}_${participant}`);
      tx.set(notificationRef, { userId: participant, category: 'Agreement', title: 'Agreement activated',
        message: `Referral agreement ${data.agreementNumber || ''} is active. The executed PDF is ready to view and download.`,
        agreementId, unread: true, createdAt: timestamp });
    }
  });
  return { active: true, pdfReady: true };
}

// Electronic signatures are server recorded, sequential, and tied to a versioned term snapshot.
export const signReferralAgreement = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.email_verified !== true) fail('unauthenticated', 'Sign in with a verified email before signing.');
  const account = await auth.getUser(uid);
  if (account.disabled) fail('permission-denied', 'This account is disabled.');
  const id = text(request.data?.agreementId, 150);
  const signatureName = text(request.data?.signatureName, 140);
  const signatureMethod = text(request.data?.signatureMethod, 20).toLowerCase();
  if (!id || id.includes('/') || signatureName.length < 2 || !['typed', 'drawn'].includes(signatureMethod)
    || request.data?.acceptedTerms !== true || request.data?.acceptedPrivacy !== true || request.data?.acceptedElectronicSignature !== true) {
    fail('invalid-argument', 'Review the terms, accept all required consents, and enter your full legal name.');
  }
  const profileSnap = await db.collection('users').doc(uid).get();
  const profile = profileSnap.data() || {};
  if (!['PROFESSIONAL', 'professional'].includes(profile.role) || String(profile.verificationStatus || '').toLowerCase() !== 'approved') {
    fail('permission-denied', 'Only approved professionals may sign a referral agreement.');
  }
  const ref = db.collection('agreements').doc(id);
  let shouldFinalize = false;
  let response = { active: false, pdfReady: false };
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail('not-found', 'Agreement not found.');
    const ag = snap.data();
    if (ag.isImmutable || ['ACTIVE', 'COMPLETED'].includes(signatureStatus(ag.status))) fail('failed-precondition', 'This agreement is finalized and cannot be changed.');
    const isReferrer = ag.referringProfessionalId === uid;
    const isReceiver = ag.receivingProfessionalId === uid;
    if (!isReferrer && !isReceiver) fail('permission-denied', 'Only an agreement participant can sign.');
    if (!ag.agreementTemplateId || !ag.agreementTemplateVersion || !ag.termsSnapshot?.sections?.length) fail('failed-precondition', 'An administrator must publish approved agreement terms before signatures can be collected.');
    const party = isReferrer ? ag.referringParty : ag.receivingParty;
    const missing = missingPartyFields(party);
    if (missing.length) fail('failed-precondition', `Complete these profile details before signing: ${missing.join(', ')}.`);
    const feePercent = Number(ag.referralSnapshot?.referralFee?.percent ?? ag.feePercent);
    if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) fail('failed-precondition', 'The referral fee is missing or invalid. Have the referral owner correct the draft before signing.');
    if (signatureName.toLowerCase() !== String(party.name).trim().toLowerCase()) fail('failed-precondition', 'Enter the full name saved in your professional profile. Update your profile first if it is incorrect.');
    const otherSignature = isReferrer ? ag.receiverSignature : ag.referrerSignature;
    const ownSignature = isReferrer ? ag.referrerSignature : ag.receiverSignature;
    if (ownSignature?.signedAt) { response = { active: ag.status === 'ACTIVE', pdfReady: !!ag.document?.storagePath, alreadySigned: true }; return; }
    if (isReceiver && !ag.referrerSignature?.signedAt) fail('failed-precondition', 'The referring professional must review and sign first.');
    if (isReferrer && otherSignature?.signedAt) fail('failed-precondition', 'The receiver already signed; this agreement needs administrator review.');
    const timestamp = FieldValue.serverTimestamp();
    const requestMeta = request.rawRequest;
    const signature = {
      status: 'SIGNED', signerId: uid, signerName: signatureName, signerEmail: account.email || request.auth.token.email || '',
      signatureMethod, signedAt: timestamp, acceptedTerms: true, acceptedPrivacy: true, acceptedElectronicSignature: true,
      privacyPolicyVersion: ag.privacyPolicyVersion || 'current', termsOfServiceVersion: ag.termsOfServiceVersion || 'current', agreementTemplateVersion: ag.agreementTemplateVersion,
      termsConsentAt: timestamp, privacyAcceptedAt: timestamp, electronicSignatureConsentAt: timestamp,
      userAgent: text(requestMeta?.headers?.['user-agent'], 500) || null,
      ...(ag.captureSignerIp ? { ipAddress: text(requestMeta?.ip, 80) || null } : {}),
    };
    if (signatureMethod === 'drawn') {
      const path = text(request.data?.drawnSignaturePath, 12000);
      const points = [...path.matchAll(/[ML][0-9.]+,[0-9.]+/g)];
      if (!/^M[0-9., ML-]+$/.test(path) || points.length < 2 || (path.match(/M/g) || []).length > 20) fail('invalid-argument', 'Draw your signature in the signature box before continuing.');
      signature.drawnSignaturePath = path;
    }
    const nextStatus = isReferrer ? 'PENDING_RECEIVER_SIGNATURE' : 'SIGNED';
    tx.update(ref, { [isReferrer ? 'referrerSignature' : 'receiverSignature']: signature,
      [isReferrer ? 'signedByReferring' : 'signedByReceiving']: true, status: nextStatus,
      ...(isReceiver ? { effectiveDate: timestamp } : {}),
      ...(isReferrer ? { privacyPolicyVersion: ag.privacyPolicyVersion || 'current' } : {}), updatedAt: timestamp });
    agreementEvent(tx, ref, isReferrer ? 'REFERRER_SIGNED' : 'RECEIVER_SIGNED', uid, {
      agreementTemplateVersion: ag.agreementTemplateVersion, signatureMethod,
      privacyPolicyVersion: ag.privacyPolicyVersion || 'current', termsOfServiceVersion: ag.termsOfServiceVersion || 'current', acceptedTerms: true,
      acceptedPrivacy: true, acceptedElectronicSignature: true, userAgent: signature.userAgent, ipAddress: signature.ipAddress,
    });
    if (isReceiver) {
      agreementEvent(tx, ref, 'AGREEMENT_SIGNED', uid, { agreementTemplateVersion: ag.agreementTemplateVersion });
      shouldFinalize = true;
    } else {
      agreementEvent(tx, ref, 'RECEIVER_NOTIFIED', uid, { receivingProfessionalId: ag.receivingProfessionalId });
    }
    const otherUid = isReferrer ? ag.receivingProfessionalId : ag.referringProfessionalId;
    const noticeRef = db.collection('notifications').doc(`${isReferrer ? 'agreement_ready' : 'agreement_finalized'}_${id}_${otherUid}`);
    tx.set(noticeRef, { userId: otherUid, category: 'Agreement',
      title: isReferrer ? 'Agreement ready for your signature' : 'Agreement signed by both parties',
      message: isReferrer ? `${signatureName} signed ${ag.agreementNumber || 'a referral agreement'}. Review the agreement and sign to activate it.` : `Both parties signed ${ag.agreementNumber || 'the referral agreement'}. The final PDF is being prepared.`,
      agreementId: id, unread: true, createdAt: timestamp });
    tx.set(db.collection('activity').doc(`agreement_signature_${id}_${uid}`), { userId: uid, targetUserId: otherUid,
      type: isReferrer ? 'REFERRER_SIGNED' : 'RECEIVER_SIGNED', title: 'Referral agreement signature recorded', agreementId: id, createdAt: timestamp });
  });
  if (shouldFinalize) {
    try { response = await finalizeAgreementPdf(id); }
    catch (error) {
      console.error('Agreement PDF finalization failed', { agreementId: id, code: error?.code || 'unknown', message: error?.message || String(error) });
      response = { active: false, pdfReady: false, pdfPending: true };
    }
  }
  return response;
});

export const retryAgreementFinalization = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.email_verified !== true) fail('unauthenticated', 'Sign in with a verified email first.');
  const id = text(request.data?.agreementId, 150);
  if (!id || id.includes('/')) fail('invalid-argument', 'Agreement ID is required.');
  const snap = await db.collection('agreements').doc(id).get();
  if (!snap.exists) fail('not-found', 'Agreement not found.');
  const ag = snap.data();
  if (uid !== ag.referringProfessionalId && uid !== ag.receivingProfessionalId) fail('permission-denied', 'Only agreement participants can request finalization.');
  return finalizeAgreementPdf(id);
});

export const recordAgreementView = onCall(callable, async request => {
  const uid = request.auth?.uid;
  if (!uid || request.auth.token.email_verified !== true) fail('unauthenticated', 'Sign in with a verified email first.');
  const id = text(request.data?.agreementId, 150);
  if (!id || id.includes('/')) fail('invalid-argument', 'Agreement ID is required.');
  const ref = db.collection('agreements').doc(id);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'Agreement not found.');
  const ag = snap.data();
  if (uid !== ag.referringProfessionalId && uid !== ag.receivingProfessionalId) fail('permission-denied', 'Only agreement participants can view this agreement.');
  const eventType = uid === ag.referringProfessionalId ? 'REFERRER_VIEWED' : 'RECEIVER_VIEWED';
  await ref.collection('events').add({ eventType, actorUid: uid, createdAt: FieldValue.serverTimestamp() });
  return { ok: true };
});
