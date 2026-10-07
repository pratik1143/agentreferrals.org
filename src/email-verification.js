import { httpsCallable } from 'firebase/functions';
import { reload } from 'firebase/auth';
import { functions } from './firebase';

// Delivery state is local UX only. Generation, storage and validation stay in Cloud Functions.
const states = new Map();
const listeners = new Set();
const idle = Object.freeze({ status: 'idle', sentAt: 0, retryAt: 0, message: '', code: '' });
export const verificationSnapshot = uid => states.get(uid) || idle;
export const subscribeVerification = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const publish = (uid, state) => { states.set(uid, state); listeners.forEach(listener => listener()); };
const callable = name => {
  if (!functions) throw Object.assign(new Error('Firebase Cloud Functions is not configured.'), { code: 'functions/unavailable' });
  return httpsCallable(functions, name);
};

export async function requestVerificationEmail(user) {
  const uid = user?.uid;
  if (!uid) throw new Error('Sign in again to request an email code.');
  const current = verificationSnapshot(uid);
  if (current.status === 'sending') return;
  publish(uid, { ...current, status: 'sending', message: '', code: '' });
  try {
    const result = await callable('sendProfessionalEmailOtp')({});
    const now = Date.now();
    publish(uid, { status: 'sent', sentAt: now, retryAt: now + 60_000,
      message: 'A 6-digit verification code was sent. It expires in 10 minutes.', code: '' });
    return result.data;
  } catch (error) {
    const message = error?.code === 'functions/resource-exhausted'
      ? error.message || 'Too many requests. Wait a moment before trying again.'
      : error?.code === 'functions/failed-precondition'
        ? error.message || 'This email is already verified. Refresh the page to continue.'
        : 'We couldn’t send the code. Please try again in a moment.';
    publish(uid, { ...current, status: 'failed', message, code: error?.code || '' });
    throw error;
  }
}

export async function confirmEmailOtp(user, otp) {
  const uid = user?.uid;
  if (!uid) throw new Error('Sign in again to verify your email.');
  const code = String(otp || '').replace(/\D/g, '').slice(0, 6);
  if (code.length !== 6) throw new Error('Enter the 6-digit code from your email.');
  const result = await callable('verifyProfessionalEmailOtp')({ code });
  await user.getIdToken(true);
  await reload(user);
  publish(uid, { ...verificationSnapshot(uid), status: 'verified', message: 'Email verified successfully.', code: '' });
  return result.data;
}
