import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  Compass,
  Eye,
  EyeOff,
  Flame,
  Globe,
  Handshake,
  Layers,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  X,
  Loader2
} from 'lucide-react';
import { auth, db, functions, storage } from './firebase';
import { requestVerificationEmail } from './email-verification';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref as storageRef, uploadBytes } from 'firebase/storage';
import { PLATFORM_ROLES } from './roles';

const EXPERTISE_OPTIONS = [
  'STR-Friendly',
  'Investor-Friendly',
  'Novations Experience',
  'Veteran',
  'Land Specialist',
  'First-Time Buyer Experience',
  'Bilingual',
  'Broker',
  '5+ Years Experience',
  '10+ Years Experience',
  'Full-Time Agent',
  'Solo Agent',
  'Team Agent',
  'Team Leader',
  'Luxury'
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];
const US_STATE_CODES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const STATE_CODE = state => { const index = US_STATES.indexOf(state); return index >= 0 ? US_STATE_CODES[index] : ''; };
const DECLARATIONS = [
  ['accurateInformation', 'I certify that the professional information I provided is accurate.'],
  ['licenseBelongsToMe', 'I certify that the license information submitted belongs to me.'],
  ['keepInformationCurrent', 'I agree to keep my professional information current.'],
  ['reportLicenseChanges', 'I agree to notify AgentReferrals if my license status changes.'],
];
const CONSENTS = [
  ['terms', 'I agree to the Terms of Service.'],
  ['privacy', 'I acknowledge the Privacy Policy.'],
  ['electronicCommunications', 'I consent to electronic communications about this verification.'],
  ['professionalVerification', 'I consent to professional license and brokerage verification.'],
];

const authErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => ({
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/invalid-email': 'Enter a valid professional email address.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
  'auth/user-not-found': 'No account was found for that email. Create an account to get started.',
  'auth/invalid-credential': 'That email and password combination was not recognized.',
  'auth/wrong-password': 'That email and password combination was not recognized.',
  'auth/requires-recent-login': 'For security, sign in again and retry this action.',
  'auth/unauthorized-domain': 'This website domain is not authorized in the Firebase project yet.',
  'permission-denied': 'Your profile could not be saved because of account permissions. Refresh the page and try again; if it continues, sign out and sign in again.',
  'functions/permission-denied': 'Your account does not have permission to complete this step. Sign out and sign in again, then retry.',
  'unavailable': 'The service is temporarily unavailable. Check your connection and try again.',
}[error?.code] || fallback);

export default function OnboardingFlow({ onCancel, onComplete, initialEmail = '', initialMode = 'signup', initialStep = 1, initialProfile = null }) {
  // Mode: 'signin' | 'signup' | 'reset'
  const [authMode, setAuthMode] = useState(initialMode);
  // Step for signup: 1 = Email Input & OTP, 2 = Verify Account (Name & Password), 3 = Complete Profile Form
  const [step, setStep] = useState(initialEmail && initialStep === 1 ? 2 : initialStep);
  const [email, setEmail] = useState(initialEmail);

  // Sign In credentials
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up Step 2 state
  const profileName = initialProfile?.displayName || '';
  const nameParts = profileName.split(' ');
  const [firstName, setFirstName] = useState(initialProfile?.firstName || nameParts[0] || '');
  const [lastName, setLastName] = useState(initialProfile?.lastName || nameParts.slice(1).join(' '));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 3 state (Complete Profile)
  const [brokerage, setBrokerage] = useState(initialProfile?.brokerageName || '');
  const [selectedStates, setSelectedStates] = useState(initialProfile?.licenseStates || (initialProfile?.licenseState ? String(initialProfile.licenseState).split(',').map(value => value.trim()).filter(Boolean) : []));
  const [stateInput, setStateInput] = useState('');
  const [city, setCity] = useState('');
  const [licenseNumber, setLicenseNumber] = useState(initialProfile?.licenseNumber || '');
  const [licenseType, setLicenseType] = useState(initialProfile?.licenseType || 'SALESPERSON');
  const [professionalType, setProfessionalType] = useState(initialProfile?.professionalType || 'SALESPERSON');
  const [licenseExpirationDate, setLicenseExpirationDate] = useState(initialProfile?.licenseExpirationDate || '');
  const [brokerageRelationship, setBrokerageRelationship] = useState(initialProfile?.brokerageRelationship || 'AFFILIATED');
  const [responsibleBroker, setResponsibleBroker] = useState(initialProfile?.responsibleBroker || '');
  const [brokerLicenseNumber, setBrokerLicenseNumber] = useState(initialProfile?.brokerLicenseNumber || '');
  const [brokerageAddress, setBrokerageAddress] = useState(initialProfile?.brokerageAddress || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [phone, setPhone] = useState(initialProfile?.phoneNumber || '');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [declarations, setDeclarations] = useState({});
  const [consents, setConsents] = useState({});
  const [documentFiles, setDocumentFiles] = useState({});
  const [verificationPolicy, setVerificationPolicy] = useState(null);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [legalPolicy, setLegalPolicy] = useState(null);

  const primaryStateCode = STATE_CODE(selectedStates[0]);
  useEffect(() => {
    let active = true;
    if (!db || !primaryStateCode) { setVerificationPolicy(null); return () => { active = false; }; }
    setPolicyLoading(true);
    getDoc(doc(db, 'verificationPolicies', primaryStateCode)).then(snapshot => {
      if (active) setVerificationPolicy(snapshot.exists() ? snapshot.data() : null);
    }).catch(() => { if (active) setVerificationPolicy(null); }).finally(() => { if (active) setPolicyLoading(false); });
    return () => { active = false; };
  }, [primaryStateCode]);

  useEffect(() => {
    let active = true;
    if (!db) return () => { active = false; };
    getDoc(doc(db, 'system_settings', 'active_agreement_template')).then(snapshot => {
      const data = snapshot.exists() ? snapshot.data() : null;
      if (active) setLegalPolicy(data?.status === 'PUBLISHED' ? data : null);
    }).catch(() => { if (active) setLegalPolicy(null); });
    return () => { active = false; };
  }, []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Handle Sign In with Email & Password
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !signInPassword) {
      setError('Enter a valid email address and your password.');
      return;
    }

    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), signInPassword);
      if (onComplete) onComplete(cred.user);
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password combination. If you do not have an account, click Create an account below.');
      } else {
        setError(authErrorMessage(err, 'Failed to sign in.'));
      }
    } finally {
      setBusy(false);
    }
  };

  // Handle Password Reset
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setNotice('Password reset link sent! Check your inbox.');
    } catch (err) {
      setError(authErrorMessage(err, 'Failed to send password reset email.'));
    } finally {
      setBusy(false);
    }
  };

  // Step 1: Send / Verify Email for Registration
  const handleVerifyEmail = (e) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid real estate professional email address.');
      return;
    }
    // Continue to account details; a one-time code is sent after account creation.
    setStep(2);
  };

  // Step 2: Create Account / Verify Account Details
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    setError('');
    if (firstName.trim().length < 2 || firstName.trim().length > 80 || lastName.trim().length < 2 || lastName.trim().length > 80) {
      setError('First and last name must each be between 2 and 80 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address before creating your account.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) {
      setError('Enter a valid phone number with 7 to 15 digits.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must have at least 8 characters, including uppercase, lowercase and a number.');
      return;
    }

    setBusy(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const currentAuthUser = credential.user;
      await updateProfile(currentAuthUser, { displayName: fullName });
      const userRef = doc(db, 'users', currentAuthUser.uid);
      await setDoc(userRef, {
        uid: currentAuthUser.uid,
        email: currentAuthUser.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: fullName,
        phoneNumber: phone.trim(),
        role: PLATFORM_ROLES.PROFESSIONAL,
        accountStatus: 'PENDING',
        emailVerified: false,
        onboardingStatus: 'NOT_STARTED',
        professionalVerificationStatus: 'PENDING_REVIEW',
        verificationStatus: 'pending',
        termsAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      // Profile exists before the protected mail request starts.
      void requestVerificationEmail(currentAuthUser).catch(() => {});
      window.history.replaceState({}, '', '/verify-email');
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Sign in instead.'
        : err.code === 'auth/invalid-email'
          ? 'Enter a valid professional email address.'
          : err.code === 'auth/weak-password'
            ? 'Choose a password with at least 6 characters.'
            : err.code === 'auth/too-many-requests'
              ? 'Too many attempts. Please wait a moment and try again.'
              : err.code === 'auth/network-request-failed'
                ? 'Network connection failed. Check your connection and try again.'
                : authErrorMessage(err, 'Failed to create account.'));
    } finally {
      setBusy(false);
    }
  };

  // Toggle expertise tag
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Add state to selected states
  const addState = (st) => {
    if (st && !selectedStates.includes(st)) {
      setSelectedStates([...selectedStates, st]);
      setStateInput('');
    }
  };

  const removeState = (st) => {
    setSelectedStates(selectedStates.filter(s => s !== st));
  };

  // Step 3: Complete Profile & Submit for Super Admin Verification
  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setError('');

    const phoneDigits = phone.replace(/\D/g, '');
    const cleanCity = city.trim();
    const cleanLicense = licenseNumber.trim();
    const cleanBrokerage = brokerage.trim();
    if (selectedStates.length === 0 || cleanCity.length < 2 || cleanCity.length > 100 || cleanLicense.length < 2 || cleanLicense.length > 80 || !licenseType || !professionalType || phoneDigits.length < 7 || phoneDigits.length > 15
      || (brokerageRelationship !== 'INDEPENDENT' && (cleanBrokerage.length < 2 || cleanBrokerage.length > 120))) {
      setError(`Check your identity details: add a valid city, 7–15 digit phone number, license number, license type, professional type${selectedStates.length === 0 ? ', licensed state' : ''}${brokerageRelationship !== 'INDEPENDENT' ? ', and brokerage name' : ''}.`);
      return;
    }
    if (DECLARATIONS.some(([id]) => declarations[id] !== true) || CONSENTS.some(([id]) => consents[id] !== true)) {
      setError('Complete all professional declarations and required consents before submitting.');
      return;
    }

    setBusy(true);
    try {
      const u = auth.currentUser;
      if (!u) throw new Error('User session not found.');
      if (!functions || !storage) throw new Error('Secure verification services are not available. Please try again later.');
      if (!primaryStateCode) throw new Error('Choose a valid U.S. license state.');

      if (!legalPolicy?.termsOfServiceUrl || !legalPolicy?.privacyPolicyUrl) throw new Error('The platform is preparing its current Terms and Privacy Policy. Please contact support before submitting verification.');
      const policyRequirements = verificationPolicy?.requirements || {};
      const requiredDocumentTypes = [
        ['GOVERNMENT_ID', 'governmentIdRequired'], ['LICENSE_DOCUMENT', 'licenseDocumentRequired'],
        ['BROKERAGE_DOCUMENT', 'brokerageDocumentRequired'], ['PROOF_OF_ADDRESS', 'proofOfAddressRequired'],
        ['BACKGROUND_CHECK', 'backgroundCheckRequired'],
      ].filter(([, key]) => policyRequirements[key] === true).map(([type]) => type);
      const missingRequiredDocument = requiredDocumentTypes.find(type => !documentFiles[type]);
      if (missingRequiredDocument) throw new Error(`Upload the required ${missingRequiredDocument.replaceAll('_', ' ').toLowerCase()} for the configured ${primaryStateCode} policy.`);
      for (const [type, file] of Object.entries(documentFiles)) {
        if (file && (file.size > 8 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type))) {
          throw new Error('Verification files must be PDF, JPG, or PNG and no larger than 8 MB.');
        }
      }

      const fullName = firstName && lastName ? `${firstName.trim()} ${lastName.trim()}` : u.displayName || 'Professional';

      const profilePayload = {
        uid: u.uid,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: fullName,
        email: u.email || email,
        phoneNumber: phone.trim(),
        brokerageName: brokerageRelationship === 'INDEPENDENT' ? 'Independent Broker' : brokerage.trim(),
        brokerageRelationship,
        responsibleBroker: responsibleBroker.trim() || null,
        brokerLicenseNumber: brokerLicenseNumber.trim() || null,
        brokerageAddress: brokerageAddress.trim() || null,
        licenseNumber: licenseNumber.trim(),
        licenseState: selectedStates[0],
        licenseStates: selectedStates,
        licenseStateCode: primaryStateCode,
        licenseType,
        professionalType,
        licenseExpirationDate: licenseExpirationDate || null,
        serviceAreas: [city.trim()],
        city: city.trim(),
        bio: bio.trim(),
        specialties: selectedTags,
        emailVerified: u.emailVerified === true,
        termsVersion: legalPolicy.termsOfServiceVersion || legalPolicy.version || 'current',
        privacyPolicyVersion: legalPolicy.privacyPolicyVersion || legalPolicy.version || 'current',
        verificationDeclarations: Object.fromEntries(DECLARATIONS.map(([id]) => [id, true])),
        verificationConsents: Object.fromEntries(CONSENTS.map(([id]) => [id, true])),
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'users', u.uid), profilePayload, { merge: true });

      const uploadedDocuments = [];
      for (const [documentType, file] of Object.entries(documentFiles)) {
        if (!file) continue;
        const documentId = crypto.randomUUID();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
        const path = `verification-documents/${u.uid}/${documentId}_${safeName}`;
        await uploadBytes(storageRef(storage, path), file, { contentType: file.type, customMetadata: { ownerUid: u.uid, documentType } });
        uploadedDocuments.push({ id: documentId, documentType, storagePath: path, fileName: file.name, mimeType: file.type, size: file.size });
      }
      const submitVerification = httpsCallable(functions, 'submitProfessionalVerification');
      await submitVerification({ licenseStateCode: primaryStateCode, declarations: Object.fromEntries(DECLARATIONS.map(([id]) => [id, declarations[id] === true])), consents: Object.fromEntries(CONSENTS.map(([id]) => [id, consents[id] === true])), documents: uploadedDocuments });

      if (onComplete) onComplete(u);
    } catch (err) {
      setError(authErrorMessage(err, 'Failed to save professional profile.'));
      window.setTimeout(() => document.querySelector('.rm-alert.error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
    } finally {
      setBusy(false);
    }
  };

  // Check for missing fields in step 3
  const missingStep3 = [];
  if (brokerageRelationship !== 'INDEPENDENT' && !brokerage.trim()) missingStep3.push('Brokerage');
  if (selectedStates.length === 0) missingStep3.push('License State');
  if (!city.trim()) missingStep3.push('City');
  if (!licenseNumber.trim()) missingStep3.push('License Number');
  if (!licenseType || !professionalType) missingStep3.push('Professional Role');
  if (!phone.trim()) missingStep3.push('Phone Number');
  if (DECLARATIONS.some(([id]) => !declarations[id])) missingStep3.push('Declarations');
  if (CONSENTS.some(([id]) => !consents[id])) missingStep3.push('Consents');

  // Should we show split-screen hero? (For Sign In, Password Reset, and Signup Steps 1 & 2)
  const isSplitLayout = authMode === 'signin' || authMode === 'reset' || (authMode === 'signup' && (step === 1 || step === 2));

  return (
    <div className="rm-onboarding-shell">
      {/* -------------------------------------------------------------
          SPLIT SCREEN (BLUE BRANDING LEFT + FORM RIGHT)
          ------------------------------------------------------------- */}
      {isSplitLayout && (
        <div className="rm-split-auth-container">
          {/* Left Hero Pane (Royal Blue) */}
          <div className="rm-split-hero">
            <div className="rm-split-brand" onClick={onCancel} style={{ cursor: onCancel ? 'pointer' : 'default' }}>
              <img src="/agentreferrals-mark.svg" alt="" className="rm-brand-mark" />
              <span>Agent<strong className="rm-brand-highlight">Referrals</strong></span>
            </div>

            <div className="rm-split-hero-body">
              <h1>Where Real Estate Agents Exchange Referrals</h1>
              <p>Join 12,000+ of Agents growing their business through Agent-to-Agent referrals</p>

              <div className="rm-hero-perks">
                <div className="rm-hero-perk">
                  <span className="rm-perk-icon"><Users size={18} /></span>
                  <span>Connect with vetted agents</span>
                </div>
                <div className="rm-hero-perk">
                  <span className="rm-perk-icon"><TrendingUp size={18} /></span>
                  <span>Grow your referral network</span>
                </div>
                <div className="rm-hero-perk">
                  <span className="rm-perk-icon"><ShieldCheck size={18} /></span>
                  <span>Secure and trusted platform</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Pane */}
          <div className="rm-split-form-pane">
            {/* 1. SIGN IN MODE */}
            {authMode === 'signin' && (
              <div className="rm-auth-form-card">
                {onCancel && (
                  <button type="button" className="rm-back-step-btn" onClick={onCancel}>
                    <ChevronLeft size={16} /> Back to Website
                  </button>
                )}

                <div className="rm-form-intro">
                  <h2>Sign In</h2>
                  <p>Enter your credentials to access your account.</p>
                </div>

                <form onSubmit={handleSignIn} className="rm-form-fields">
                  <div className="rm-input-wrap">
                    <label>Work Email</label>
                    <div className="rm-field-row">
                      <Mail size={16} className="rm-field-icon" />
                      <input
                        type="email"
                        required
                        autoFocus
                        placeholder="you@brokerage.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="rm-input-wrap">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label>Password</label>
                      <button
                        type="button"
                        className="rm-link-btn"
                        style={{ fontSize: 11 }}
                        onClick={() => {
                          setError('');
                          setNotice('');
                          setAuthMode('reset');
                        }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="rm-password-row">
                      <input
                        type={showSignInPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter your password"
                        value={signInPassword}
                        onChange={e => setSignInPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rm-eye-btn"
                        onClick={() => setShowSignInPassword(!showSignInPassword)}
                      >
                        {showSignInPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && <div className="rm-alert error">{error}</div>}
                  {notice && <div className="rm-alert success">{notice}</div>}

                  <button type="submit" className="rm-btn-primary rm-btn-lg rm-btn-full" disabled={busy}>
                    {busy ? <Loader2 size={16} className="rm-spin" /> : 'Sign In'}
                  </button>
                </form>

                <div className="rm-auth-switch-bar">
                  <span>New to AgentReferrals?</span>{' '}
                  <button
                    type="button"
                    className="rm-link-btn"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setAuthMode('signup');
                      setStep(1);
                    }}
                  >
                    Create an account
                  </button>
                </div>
              </div>
            )}

            {/* 2. RESET PASSWORD MODE */}
            {authMode === 'reset' && (
              <div className="rm-auth-form-card">
                <button
                  type="button"
                  className="rm-back-step-btn"
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setAuthMode('signin');
                  }}
                >
                  <ChevronLeft size={16} /> Back to Sign In
                </button>

                <div className="rm-form-intro">
                  <h2>Reset Password</h2>
                  <p>We’ll email you a secure link to reset your account password.</p>
                </div>

                <form onSubmit={handleResetPassword} className="rm-form-fields">
                  <div className="rm-input-wrap">
                    <label>Work Email</label>
                    <div className="rm-field-row">
                      <Mail size={16} className="rm-field-icon" />
                      <input
                        type="email"
                        required
                        autoFocus
                        placeholder="you@brokerage.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {error && <div className="rm-alert error">{error}</div>}
                  {notice && <div className="rm-alert success">{notice}</div>}

                  <button type="submit" className="rm-btn-primary rm-btn-lg rm-btn-full" disabled={busy}>
                    {busy ? <Loader2 size={16} className="rm-spin" /> : 'Send Reset Link'}
                  </button>
                </form>

                <div className="rm-auth-switch-bar">
                  <button
                    type="button"
                    className="rm-link-btn"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setAuthMode('signin');
                    }}
                  >
                    ← Remember your password? Sign In
                  </button>
                </div>
              </div>
            )}

            {/* 3. SIGN UP STEP 1: VERIFY EMAIL */}
            {authMode === 'signup' && step === 1 && (
              <div className="rm-auth-form-card">
                <button
                  type="button"
                  className="rm-back-step-btn"
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setAuthMode('signin');
                  }}
                >
                  <ChevronLeft size={16} /> Back to Sign In
                </button>

                <div className="rm-form-intro">
                  <h2>Create your account</h2>
                  <p>Start with your professional email. We’ll verify it with a secure Firebase email link.</p>
                </div>

                <form onSubmit={handleVerifyEmail} className="rm-form-fields">
                  <div className="rm-input-wrap">
                    <label>Work Email</label>
                    <div className="rm-field-row">
                      <Mail size={16} className="rm-field-icon" />
                      <input
                        type="email"
                        required
                        autoFocus
                        placeholder="you@brokerage.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {error && <div className="rm-alert error">{error}</div>}
                  {notice && <div className="rm-alert success">{notice}</div>}

                  <button type="submit" className="rm-btn-primary rm-btn-lg rm-btn-full" disabled={busy}>
                    {busy ? <Loader2 size={16} className="rm-spin" /> : 'Continue to account details'}
                  </button>
                </form>

                <div className="rm-auth-switch-bar">
                  <span>Already have an account?</span>{' '}
                  <button
                    type="button"
                    className="rm-link-btn"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setAuthMode('signin');
                    }}
                  >
                    Sign in
                  </button>
                </div>
              </div>
            )}

            {/* 4. SIGN UP STEP 2: CREATE ACCOUNT */}
            {authMode === 'signup' && step === 2 && (
              <div className="rm-auth-form-card">
                <button type="button" className="rm-back-step-btn" onClick={() => setStep(1)}>
                  <ChevronLeft size={16} /> Change Email
                </button>

                <div className="rm-form-intro">
                  <h2>Your professional details</h2>
                  <p>We’ll email you a one-time verification code after you create your account.</p>
                </div>

                <form onSubmit={handleCreateAccount} className="rm-form-fields">
                  <div className="rm-readonly-email-box">
                    <div>
                      <small>Email</small>
                      <b>{email || 'agent@brokerage.com'}</b>
                    </div>
                    <button type="button" onClick={() => setStep(1)} className="rm-link-btn">
                      Change
                    </button>
                  </div>

                  <div className="rm-input-wrap">
                    <label>First Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your first name"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                    />
                  </div>

                  <div className="rm-input-wrap">
                    <label>Last Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your last name"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                    />
                  </div>

                  <div className="rm-input-wrap">
                    <label>Direct Phone *</label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      required
                      placeholder="+1 512 555 0123"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>

                  <div className="rm-input-wrap">
                    <label>Password *</label>
                    <div className="rm-password-row">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        placeholder="8+ characters, uppercase, lowercase and number"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rm-eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <label className="rm-terms-check">
                    <input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} required />
                    <span>I agree to the <b>Terms of Service</b> and <b>Privacy Policy</b>.</span>
                  </label>

                  {error && <div className="rm-alert error">{error}</div>}

                  <button type="submit" className="rm-btn-primary rm-btn-lg rm-btn-full" disabled={busy}>
                    {busy ? <Loader2 size={16} className="rm-spin" /> : 'Create Account & Continue'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          STEP 3: COMPLETE YOUR PROFILE (SCREENSHOT 3)
          ------------------------------------------------------------- */}
      {authMode === 'signup' && step === 3 && (
        <div className="rm-onboarding-full-page">
            <div className="rm-onboarding-page-header">
              <span className="rm-welcome-kicker">Welcome to AgentReferrals!</span>
            <h1>Professional Verification</h1>
            <p>Complete your identity, license, brokerage, declarations and consent to submit for review.</p>
          </div>

          <ol className="rm-verification-progress" aria-label="Verification steps">
            {['Identity', 'License', 'Brokerage', 'Documents', 'Compliance', 'Review'].map((label, index) => <li key={label}><span>{String(index + 1).padStart(2, '0')}</span>{label}</li>)}
          </ol>

          <form onSubmit={handleCompleteProfile} className="rm-onboarding-form-container">
            {/* CARD 1: PROFESSIONAL INFORMATION */}
            <div className="rm-onboarding-card">
              <div className="rm-card-header">
                <h3>Professional Information</h3>
                <small>All fields in this section are required</small>
              </div>

              <div className="rm-card-body">
                <div className="rm-form-field">
                  <label>Professional role *</label>
                  <select value={professionalType} onChange={e => setProfessionalType(e.target.value)} required>
                    <option value="SALESPERSON">Salesperson / Sales Associate</option><option value="BROKER">Broker</option><option value="ASSOCIATE_BROKER">Associate Broker</option><option value="OTHER">Other</option>
                  </select>
                </div>

                <div className="rm-form-field">
                  <label>Licensed States *</label>
                  <div className="rm-states-picker-wrap">
                    <input
                      type="text"
                      placeholder="Search and add states (e.g. Texas, Florida)..."
                      value={stateInput}
                      onChange={e => setStateInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addState(stateInput.trim());
                        }
                      }}
                    />
                    {stateInput && (
                      <div className="rm-states-dropdown">
                        {US_STATES.filter(s => s.toLowerCase().includes(stateInput.toLowerCase())).slice(0, 5).map(s => (
                          <div key={s} className="rm-state-opt" onClick={() => addState(s)}>
                            + {s}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedStates.length > 0 && (
                    <div className="rm-selected-states-chips">
                      {selectedStates.map(s => (
                        <span key={s} className="rm-state-chip">
                          {s} <button type="button" onClick={() => removeState(s)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rm-form-field">
                  <label>Location (City) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Austin, TX"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                  />
                </div>

                <div className="rm-form-field">
                  <label>License Type *</label>
                  <select value={licenseType} onChange={e => setLicenseType(e.target.value)} required>
                    <option value="SALESPERSON">Salesperson</option><option value="BROKER">Broker</option><option value="ASSOCIATE_BROKER">Associate Broker</option><option value="OTHER">Other / configured type</option>
                  </select>
                </div>

                <div className="rm-form-field">
                  <label>License Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 0987654"
                    value={licenseNumber}
                    onChange={e => setLicenseNumber(e.target.value)}
                  />
                </div>
                <div className="rm-form-field">
                  <label>License expiration date <small>(only needed when your state policy requires it)</small></label>
                  <input type="date" value={licenseExpirationDate} onChange={e => setLicenseExpirationDate(e.target.value)} />
                </div>
                <div className="rm-form-field">
                  <label>Brokerage relationship *</label>
                  <select value={brokerageRelationship} onChange={e => setBrokerageRelationship(e.target.value)} required>
                    <option value="AFFILIATED">Affiliated with a brokerage</option><option value="INDEPENDENT">Independent broker</option><option value="OTHER">Other relationship</option>
                  </select>
                </div>
                {brokerageRelationship !== 'INDEPENDENT' && <div className="rm-form-field">
                  <label>Brokerage legal name *</label>
                  <input type="text" required placeholder="Brokerage legal name" value={brokerage} onChange={e => setBrokerage(e.target.value)} />
                </div>}
                <div className="rm-form-field">
                  <label>Responsible / supervising broker</label>
                  <input type="text" placeholder="Broker name, if applicable" value={responsibleBroker} onChange={e => setResponsibleBroker(e.target.value)} />
                </div>
                <div className="rm-form-field">
                  <label>Broker license number</label>
                  <input type="text" placeholder="Broker license number, if applicable" value={brokerLicenseNumber} onChange={e => setBrokerLicenseNumber(e.target.value)} />
                </div>
                <div className="rm-form-field">
                  <label>Brokerage address</label>
                  <input type="text" placeholder="Street, city, state and ZIP" value={brokerageAddress} onChange={e => setBrokerageAddress(e.target.value)} />
                </div>
                {policyLoading && <div className="rm-verification-policy-note">Loading requirements for {selectedStates[0] || 'your state'}…</div>}
                {!policyLoading && primaryStateCode && !verificationPolicy && <div className="rm-verification-policy-note warning"><ShieldAlert size={16}/> No verified policy template is configured for {selectedStates[0]} yet. Your details can be submitted, but an administrator must configure the jurisdiction policy before approval. Government ID and SSN are not requested by default.</div>}
                {!policyLoading && verificationPolicy && <div className="rm-verification-policy-note"><ShieldCheck size={16}/><span><b>{selectedStates[0]} requirements · policy {verificationPolicy.version || 'current'}</b><small>{verificationPolicy.verificationSource?.sourceName ? <>Manual license verification uses <a href={verificationPolicy.verificationSource.sourceUrl} target="_blank" rel="noreferrer">{verificationPolicy.verificationSource.sourceName}</a>.</> : 'Manual license verification is required; no official source URL is configured.'} Government ID is only collected when this policy requires it.</small></span></div>}
              </div>
            </div>

            {/* CARD 2: ABOUT YOU */}
            <div className="rm-onboarding-card">
              <div className="rm-card-header">
                <h3>About You</h3>
                <small>All fields in this section are required</small>
              </div>

              <div className="rm-card-body">
                <div className="rm-form-field">
                  <label>Bio *</label>
                  <textarea
                    rows={4}
                    required
                    maxLength={10000}
                    placeholder="Tell us about yourself and your experience..."
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                  />
                  <div className="rm-textarea-foot">
                    <span>{bio.length}/10,000</span>
                  </div>
                </div>

                <div className="rm-form-field">
                  <label>Phone Number *</label>
                  <div className="rm-phone-input-row">
                    <span className="rm-country-prefix">US +1</span>
                    <input
                      type="tel"
                      required
                      placeholder="(201) 555-0123"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: YOUR EXPERTISE */}
            <div className="rm-onboarding-card">
              <div className="rm-card-header">
                <h3>Your Expertise</h3>
                <small>Select tags that describe your expertise (optional)</small>
              </div>

              <div className="rm-card-body">
                <div className="rm-tags-cloud">
                  {EXPERTISE_OPTIONS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className={`rm-tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {verificationPolicy && <div className="rm-onboarding-card">
              <div className="rm-card-header"><h3>Documents required by {selectedStates[0]} policy</h3><small>Only configured documents are requested. Government ID is not a default requirement.</small></div>
              <div className="rm-card-body rm-verification-documents">
                {[
                  ['GOVERNMENT_ID', 'governmentIdRequired', 'Government-issued photo ID'],
                  ['LICENSE_DOCUMENT', 'licenseDocumentRequired', 'Real estate license certificate'],
                  ['BROKERAGE_DOCUMENT', 'brokerageDocumentRequired', 'Brokerage proof'],
                  ['PROOF_OF_ADDRESS', 'proofOfAddressRequired', 'Proof of address'],
                  ['BACKGROUND_CHECK', 'backgroundCheckRequired', 'Background check evidence'],
                ].filter(([, requirement]) => verificationPolicy.requirements?.[requirement] === true).map(([type, , label]) => <label className="rm-form-field" key={type}>{label} *<input type="file" accept="application/pdf,image/jpeg,image/png" required={!documentFiles[type]} onChange={event => setDocumentFiles(current => ({ ...current, [type]: event.target.files?.[0] || null }))}/><small>Private upload · PDF, JPG or PNG · up to 8 MB</small></label>)}
                {!Object.values(verificationPolicy.requirements || {}).some(Boolean) && <p>No additional identity documents are configured for this jurisdiction.</p>}
              </div>
            </div>}

            <div className="rm-onboarding-card">
              <div className="rm-card-header"><h3>Compliance declarations &amp; consent</h3><small>Review each statement before submitting.</small></div>
              <div className="rm-card-body rm-verification-checks">
                <h4>Professional declarations</h4>
                {DECLARATIONS.map(([id, label]) => <label key={id}><input type="checkbox" checked={declarations[id] === true} onChange={event => setDeclarations(current => ({ ...current, [id]: event.target.checked }))}/><span>{label}</span></label>)}
                <h4>Terms &amp; privacy consent</h4>
                {CONSENTS.map(([id, label]) => <label key={id}><input type="checkbox" checked={consents[id] === true} onChange={event => setConsents(current => ({ ...current, [id]: event.target.checked }))}/><span>{label}</span></label>)}
                <p>Consent versions and timestamps are recorded with this submission. Do not enter your Social Security number.</p>
                {legalPolicy ? <p className="rm-verification-legal-links"><a href={legalPolicy.termsOfServiceUrl} target="_blank" rel="noreferrer">Review Terms of Service · {legalPolicy.termsOfServiceVersion || legalPolicy.version || 'current'}</a><a href={legalPolicy.privacyPolicyUrl} target="_blank" rel="noreferrer">Review Privacy Policy · {legalPolicy.privacyPolicyVersion || legalPolicy.version || 'current'}</a></p> : <p className="rm-verification-policy-note warning"><ShieldAlert size={16}/> Verification cannot be submitted until the current Terms of Service and Privacy Policy are published.</p>}
              </div>
            </div>

            {/* ERROR & SUBMIT BUTTON */}
            {error && <div className="rm-alert error">{error}</div>}

            <div className="rm-onboarding-footer">
              <button
                type="submit"
                className={`rm-btn-primary rm-btn-lg rm-btn-full ${missingStep3.length > 0 ? 'disabled' : ''}`}
                disabled={busy || policyLoading || !legalPolicy?.termsOfServiceUrl || !legalPolicy?.privacyPolicyUrl}
              >
                {busy ? <Loader2 size={16} className="rm-spin" /> : 'Submit for Verification'}
              </button>

              {missingStep3.length > 0 && (
                <p className="rm-missing-fields-warning">
                  Missing: {missingStep3.join(', ')}
                </p>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
