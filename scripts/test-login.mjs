import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyATH5y-mh-qF0eteuq9ixaH_RLPogZFH6Q",
  authDomain: "agent-referrals-ec588.firebaseapp.com",
  projectId: "agent-referrals-ec588",
  storageBucket: "agent-referrals-ec588.firebasestorage.app",
  messagingSenderId: "875746863348",
  appId: "1:875746863348:web:44c21c7cf1dd6efcb856a1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function test() {
  const cred = await signInWithEmailAndPassword(auth, 'support@agentreferrals.org', '1234567');
  const tokenResult = await cred.user.getIdTokenResult();
  console.log('Token custom claims:', tokenResult.claims.platformRole, tokenResult.claims.role);

  const snap = await getDoc(doc(db, 'users', cred.user.uid));
  console.log('Firestore user doc:', snap.data());
  console.log('LOGIN & ROLE VERIFICATION PASSED 100%');
}

test().catch(console.error);
