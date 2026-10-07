// One-time trusted bootstrap using Application Default Credentials.
// Usage: node functions/bootstrap-super-admin.mjs support@example.com
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const email = process.argv[2];
if (!email) {
  console.error('Pass the existing Firebase Authentication account email.');
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
const account = await getAuth().getUserByEmail(email);
if (!account.emailVerified) {
  console.error(`Refusing to grant Super Admin: ${account.email} is not email-verified. Verify the mailbox first.`);
  process.exit(1);
}
await getAuth().setCustomUserClaims(account.uid, { ...account.customClaims, platformRole: 'SUPER_ADMIN' });
await getFirestore().collection('users').doc(account.uid).set({ uid: account.uid, email: account.email,
  role: 'SUPER_ADMIN', platformRole: 'SUPER_ADMIN', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
console.log(`SUPER_ADMIN claim assigned to ${account.email}. Sign out and back in to refresh the ID token.`);
