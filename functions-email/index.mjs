import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';

initializeApp();
const db = getFirestore();
const auth = getAuth();
const callable = { region: 'us-central1', enforceAppCheck: false, maxInstances: 10 };
const smtpUser = defineSecret('SMTP_USER');
const smtpPassword = defineSecret('SMTP_APP_PASSWORD');
const otpHashKey = defineSecret('EMAIL_OTP_HMAC_KEY');
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

const otpDigest = (uid, code) => createHmac('sha256', otpHashKey.value()).update(`${uid}:${code}`).digest('hex');
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''), 'hex');
  const right = Buffer.from(String(b || ''), 'hex');
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
};

export const sendProfessionalEmailOtp = onCall({ ...callable, secrets: [smtpUser, smtpPassword, otpHashKey] }, async request => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in to verify your email.');
  const account = await auth.getUser(uid);
  if (account.disabled || !account.email) fail('failed-precondition', 'This account cannot receive a verification email.');
  if (account.emailVerified) fail('failed-precondition', 'This email is already verified. Refresh the page to continue.');

  const now = Date.now();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeId = randomUUID();
  const codeRef = db.collection('email_verification_codes').doc(uid);
  const ip = String(request.rawRequest?.ip || '').slice(0, 128);
  const ipRef = ip ? db.collection('email_otp_rate_limits').doc(createHmac('sha256', otpHashKey.value()).update(ip).digest('hex')) : null;
  await db.runTransaction(async tx => {
    const [codeSnap, ipSnap] = await Promise.all([tx.get(codeRef), ipRef ? tx.get(ipRef) : Promise.resolve(null)]);
    const prior = codeSnap.data() || {};
    if (prior.lastSentAt && now - prior.lastSentAt < 60_000) fail('resource-exhausted', 'Wait 60 seconds before requesting another code.');
    const windowStart = Number(prior.sendWindowStart || 0);
    const sends = windowStart && now - windowStart < 60 * 60_000 ? Number(prior.sendsInWindow || 0) : 0;
    if (sends >= 5) fail('resource-exhausted', 'You have requested several codes. Try again in an hour.');
    if (ipSnap) {
      const ipData = ipSnap.data() || {};
      const ipWindow = Number(ipData.windowStart || 0);
      const ipSends = ipWindow && now - ipWindow < 60 * 60_000 ? Number(ipData.sends || 0) : 0;
      if (ipSends >= 20) fail('resource-exhausted', 'Too many verification emails from this network. Try again later.');
      tx.set(ipRef, { windowStart: ipSends ? ipWindow : now, sends: ipSends + 1, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.set(codeRef, { email: account.email.toLowerCase(), codeHash: otpDigest(uid, code), codeId, expiresAt: now + 10 * 60_000,
      attempts: 0, lastSentAt: now, sendWindowStart: sends ? windowStart : now, sendsInWindow: sends + 1,
      consumed: false, updatedAt: FieldValue.serverTimestamp() });
  });

  const mailer = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true,
    auth: { user: smtpUser.value(), pass: smtpPassword.value() }, connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  try {
    await mailer.sendMail({ from: { name: 'AgentReferrals.org', address: smtpUser.value() }, to: account.email,
      subject: 'Your AgentReferrals verification code',
      text: `Your AgentReferrals verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#142746"><p style="color:#2176f3;font-weight:bold">AGENTREFERRALS.ORG</p><h1 style="font-size:24px">Verify your email</h1><p>Enter this one-time code to finish setting up your account:</p><p style="font-size:34px;letter-spacing:10px;font-weight:bold;background:#f1f6ff;padding:18px;border-radius:12px;text-align:center">${code}</p><p>This code expires in 10 minutes and can only be used once.</p><p style="color:#667892;font-size:13px">If you did not request this code, you can ignore this email.</p></div>` });
  } catch (error) {
    await codeRef.set({ codeHash: FieldValue.delete(), consumed: true, mailFailedAt: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
    console.error('Email OTP delivery failed', { uid, code: error?.code || 'smtp-error' });
    fail('unavailable', 'The verification email could not be sent. Check the mail service configuration and try again.');
  }
  return { ok: true, expiresInSeconds: 600, retryAfterSeconds: 60 };
});

export const verifyProfessionalEmailOtp = onCall({ ...callable, secrets: [otpHashKey] }, async request => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in to verify your email.');
  const code = text(request.data?.code, 6);
  if (!/^\d{6}$/.test(code)) fail('invalid-argument', 'Enter the 6-digit code from your email.');
  const account = await auth.getUser(uid);
  if (account.disabled || !account.email) fail('failed-precondition', 'This account cannot be verified.');
  if (account.emailVerified) return { ok: true, verified: true };
  const codeRef = db.collection('email_verification_codes').doc(uid);
  const codeId = randomUUID();
  let accepted = false;
  await db.runTransaction(async tx => {
    const snap = await tx.get(codeRef);
    const record = snap.data();
    if (!record || record.consumed || !record.codeHash || Date.now() > Number(record.expiresAt || 0)) {
      fail('deadline-exceeded', 'This code has expired. Request a new one.');
    }
    if (record.email !== account.email.toLowerCase()) fail('failed-precondition', 'The account email changed. Request a new code for the current address.');
    if (Number(record.attempts || 0) >= 5) fail('resource-exhausted', 'Too many incorrect codes. Request a new one.');
    if (!safeEqual(record.codeHash, otpDigest(uid, code))) {
      tx.update(codeRef, { attempts: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
      return;
    }
    accepted = true;
    tx.update(codeRef, { consumed: true, consumedId: codeId, codeHash: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
  });
  if (!accepted) fail('permission-denied', 'That code is incorrect. Check the email and try again.');

  await auth.updateUser(uid, { emailVerified: true });
  const profileRef = db.collection('users').doc(uid);
  await profileRef.set({ emailVerified: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true, verified: true };
});
