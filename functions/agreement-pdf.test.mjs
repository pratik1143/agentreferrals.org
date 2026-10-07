import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgreementPdf } from './agreement-pdf.mjs';

test('agreement PDF contains the versioned referral and signature record', () => {
  const pdf = buildAgreementPdf({
    id: 'agreement-1', agreementNumber: 'AGR-2026-000001', agreementVersion: 1,
    referringParty: { name: 'Referrer Agent', email: 'referrer@example.com', brokerage: 'North Realty' },
    receivingParty: { name: 'Receiving Agent', email: 'receiver@example.com', brokerage: 'South Realty' },
    referralId: 'referral-1', referralSnapshot: { title: 'Austin Buyer Referral', city: 'Austin', state: 'TX', referralFee: { percent: 30, basis: 'Commission' } },
    termsSnapshot: { sections: [{ title: 'Approved terms', body: 'Example approved template wording.' }] },
    referrerSignature: { signerName: 'Referrer Agent', signerEmail: 'referrer@example.com', signedAt: '2026-09-30', drawnSignaturePath: 'M1,1 L9,9' },
    receiverSignature: { signerName: 'Receiving Agent', signerEmail: 'receiver@example.com', signedAt: '2026-09-30' },
    privacyPolicyVersion: '2026.09', termsOfServiceVersion: '2026.09', document: { hash: 'abc123' },
  });
  const text = pdf.toString('ascii');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('AGR-2026-000001'));
  assert.ok(text.includes('Austin Buyer Referral'));
  assert.ok(text.includes('Example approved template wording.'));
  assert.ok(text.includes('Referrer Agent'));
  assert.ok(text.includes(' m'));
  assert.ok(text.endsWith('%%EOF'));
});
