import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, CheckCircle2, ChevronLeft, Eye, EyeOff, Globe2, ImagePlus, LoaderCircle, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, Sparkles, UploadCloud, UserRound, X } from 'lucide-react';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { deleteObject, getBlob, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, storage } from './firebase';
import { PLATFORM_ROLES } from './roles';
import { LEGAL_POLICY_VERSION } from './legal-policy';
import './professional-onboarding.css';

const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
const PROPERTY_TYPES = ['Residential','Condominium','Commercial','Land','Multi-family','Other'];
const CLIENT_TYPES = ['Buyer','Seller','Investor','Relocation'];
const ROLES = ['Real Estate Agent','Associate Broker','Broker','Other'];
const PHONE_COUNTRIES = [
  {name:'United States',code:'+1',min:10,max:10},{name:'Canada',code:'+1',min:10,max:10},{name:'United Kingdom',code:'+44',min:10,max:10},{name:'India',code:'+91',min:10,max:10},{name:'Australia',code:'+61',min:9,max:9},{name:'New Zealand',code:'+64',min:8,max:10},{name:'Mexico',code:'+52',min:10,max:10},{name:'Brazil',code:'+55',min:10,max:11},{name:'France',code:'+33',min:9,max:9},{name:'Germany',code:'+49',min:7,max:12},{name:'Spain',code:'+34',min:9,max:9},{name:'Italy',code:'+39',min:6,max:11},{name:'Netherlands',code:'+31',min:9,max:9},{name:'Ireland',code:'+353',min:9,max:9},{name:'South Africa',code:'+27',min:9,max:9},{name:'Nigeria',code:'+234',min:7,max:10},{name:'Pakistan',code:'+92',min:10,max:10},{name:'Bangladesh',code:'+880',min:10,max:10},{name:'Philippines',code:'+63',min:10,max:10},{name:'Singapore',code:'+65',min:8,max:8},{name:'United Arab Emirates',code:'+971',min:9,max:9},{name:'Saudi Arabia',code:'+966',min:9,max:9},{name:'Japan',code:'+81',min:10,max:10},{name:'South Korea',code:'+82',min:9,max:10},{name:'China',code:'+86',min:11,max:11},{name:'Turkey',code:'+90',min:10,max:10},{name:'Switzerland',code:'+41',min:9,max:9},{name:'Sweden',code:'+46',min:7,max:10},{name:'Norway',code:'+47',min:8,max:8},{name:'Denmark',code:'+45',min:8,max:8},{name:'Argentina',code:'+54',min:10,max:11},{name:'Colombia',code:'+57',min:10,max:10},
];
const digitsOnly = value => String(value||'').replace(/\D/g,'');
const withTimeout = (promise, milliseconds, message) => new Promise((resolve,reject)=>{const timer=window.setTimeout(()=>reject(Object.assign(new Error(message),{code:'profile/timeout'})),milliseconds);promise.then(value=>{window.clearTimeout(timer);resolve(value);},error=>{window.clearTimeout(timer);reject(error);});});
const uploadPhotoFile = (fileRef,file,onProgress) => new Promise((resolve,reject)=>{const task=uploadBytesResumable(fileRef,file,{contentType:file.type});let idleTimer;const clearTimers=()=>{window.clearTimeout(idleTimer);window.clearTimeout(hardTimer);};const fail=message=>{clearTimers();task.cancel();reject(Object.assign(new Error(message),{code:'profile/upload-timeout'}));};const armIdle=()=>{window.clearTimeout(idleTimer);idleTimer=window.setTimeout(()=>fail('Photo storage did not respond. Check your connection and Firebase Storage setup, then retry.'),20000);};const hardTimer=window.setTimeout(()=>fail('The photo is taking too long to upload. Check your connection and retry.'),90000);armIdle();task.on('state_changed',snapshot=>{onProgress(Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100));if(snapshot.bytesTransferred>0)armIdle();},error=>{clearTimers();reject(error);},()=>{clearTimers();resolve(task.snapshot);});});
const phoneCountryFor = value => {const digits=digitsOnly(value);return PHONE_COUNTRIES.find(country=>digits.startsWith(digitsOnly(country.code))&&digits.length>digitsOnly(country.code).length)||PHONE_COUNTRIES[0];};
const validatePhone = (value,country) => {const all=digitsOnly(value),prefix=digitsOnly(country.code),national=all.startsWith(prefix)?all.slice(prefix.length):all;if(national.length<country.min||national.length>country.max)return `Enter a valid ${country.name} number (${country.min===country.max?country.min:`${country.min}–${country.max}`} digits after ${country.code}).`;if(/^(\d)\1+$/.test(national))return 'Enter a real phone number, not repeated digits.';if(country.code==='+1'&&!/^[2-9]\d{2}[2-9]\d{6}$/.test(national))return 'Enter a valid 10-digit North American number.';return '';};
const INITIAL = { firstName:'', lastName:'', displayName:'', phoneNumber:'', professionalHeadline:'', country:'United States', state:'', city:'', zipCode:'', serviceAreas:[], brokerageAffiliated:true, brokerageName:'', brokerageAddress:'', brokerageCity:'', brokerageState:'', brokerageZipCode:'', brokerageWebsite:'', professionalRelationship:'Real Estate Agent', propertyTypes:[], clientTypes:[], yearsExperience:'', languages:[], specialties:[], bio:'', professionalWebsite:'', photoStoragePath:'' };
const readableError = error => ({
  'auth/email-already-in-use':'An account with this email already exists. Sign in instead.',
  'auth/invalid-email':'Enter a valid email address.',
  'auth/weak-password':'Choose a stronger password with at least 8 characters, including a number and a capital letter.',
  'auth/too-many-requests':'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':'Network connection failed. Check your connection and try again.',
  'auth/unauthorized-domain':'This website domain is not authorized for this Firebase project yet.',
  'permission-denied':'The database rejected this profile save. This does not by itself mean an administrator blocked your account. Refresh and retry; if it persists, the Firebase access rules may need an update.',
  'unauthenticated':'Your session expired. Sign in again, then retry saving your profile.',
  'unavailable':'The profile service is temporarily unavailable. Check your connection and retry.',
  'unauthorized':'Photo upload was denied. Please verify your email, then refresh and try again.',
  'no-default-bucket':'Photo storage is not configured for this Firebase project.',
  'bucket-not-found':'The Firebase Storage bucket could not be found. Check the project Storage setup.',
  'project-not-found':'Firebase Storage could not find this project. Check the app configuration.',
  'canceled':'Photo upload was cancelled. Please try again.',
  'retry-limit-exceeded':'The photo could not upload after several attempts. Check your connection and retry.',
  'unknown':'Photo upload failed. Check your connection and Firebase Storage setup, then retry.',
}[String(error?.code||'').split('/').pop()] || error?.message || 'We couldn’t save that yet. Check your connection and try again.');
const displayName = profile => profile.displayName?.trim() || [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
const splitList = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 12);
const asProfile = profile => ({ ...INITIAL, ...(profile || {}), state: profile?.state || profile?.licenseState || '', serviceAreas: Array.isArray(profile?.serviceAreas) ? profile.serviceAreas : splitList(profile?.serviceAreas), propertyTypes: Array.isArray(profile?.propertyTypes) ? profile.propertyTypes : [], clientTypes: Array.isArray(profile?.clientTypes) ? profile.clientTypes : [], languages: Array.isArray(profile?.languages) ? profile.languages : splitList(profile?.languages), specialties: Array.isArray(profile?.specialties) ? profile.specialties : splitList(profile?.specialties), brokerageAffiliated: profile?.brokerageAffiliated !== false });
const completionFor = profile => {
  const checks = [profile.firstName,profile.lastName,profile.displayName,profile.phoneNumber,profile.professionalHeadline,profile.city,profile.state,profile.zipCode,profile.serviceAreas?.length,profile.brokerageAffiliated ? profile.brokerageName : true,profile.propertyTypes?.length,profile.clientTypes?.length,profile.yearsExperience,profile.languages?.length,profile.specialties?.length,profile.bio,profile.professionalWebsite,profile.photoStoragePath];
  return Math.round(checks.filter(value => value === true || (value !== undefined && value !== null && value !== '' && value !== false)).length / checks.length * 100);
};

function Brand(){return <a className="po-brand" href="/" aria-label="AgentReferrals home"><img src="/agentreferrals-mark.svg" alt=""/><span>Agent<b>Referrals</b></span></a>}
function TextField({label,value,onChange,placeholder,type='text',required=false,autoComplete,helper,wide=false}){const id=`po-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;return <label className={`po-field ${wide?'wide':''}`} htmlFor={id}><span>{label}{required&&<i> *</i>}</span><input id={id} type={type} value={value||''} onChange={event=>onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete}/>{helper&&<small>{helper}</small>}</label>}
function ChoiceChips({label,options,selected,onChange}){return <fieldset className="po-choice-group"><legend>{label}</legend><div>{options.map(option=>{const active=selected.includes(option);return <button type="button" key={option} className={active?'selected':''} aria-pressed={active} onClick={()=>onChange(active?selected.filter(value=>value!==option):[...selected,option])}>{active&&<Check size={14}/>} {option}</button>})}</div></fieldset>}

export default function ProfessionalOnboarding({ initialMode='register', initialEmail='', initialProfile=null, onCancel, onSignIn, onComplete }) {
  const isRegister = initialMode === 'register';
  const [screen,setScreen]=useState(isRegister?'register':'onboarding');
  const [step,setStep]=useState(()=>isRegister?0:Math.max(0,Math.min(6,Number(initialProfile?.currentOnboardingStep)||0)));
  const [profile,setProfile]=useState(()=>asProfile(initialProfile));
  const [phoneCountry,setPhoneCountry]=useState(()=>phoneCountryFor(initialProfile?.phoneNumber||''));
  const [email,setEmail]=useState(initialEmail||initialProfile?.email||'');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [terms,setTerms]=useState(false);
  const [privacy,setPrivacy]=useState(false);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [photoError,setPhotoError]=useState('');
  const [photoUploadProgress,setPhotoUploadProgress]=useState(0);
  const [error,setError]=useState('');
  const [fieldErrors,setFieldErrors]=useState({});
  const [photoPreview,setPhotoPreview]=useState('');
  const [saveState,setSaveState]=useState('saved');
  const [saveError,setSaveError]=useState('');
  const photoInput=useRef(null);
  const dirty=useRef(false);
  const uploadPreview=useRef('');
  const name=displayName(profile);
  const progress=completionFor(profile);
  const passwordStrength=useMemo(()=>{const tests=[password.length>=8,/\p{Lu}/u.test(password),/\p{Ll}/u.test(password),/\d/.test(password),/[^A-Za-z0-9]/.test(password)];return tests.filter(Boolean).length;},[password]);
  const passwordValid=password.length>=8&&/\p{Lu}/u.test(password)&&/\p{Ll}/u.test(password)&&/\d/.test(password);

  useEffect(()=>{if(initialProfile&&!dirty.current){setProfile(asProfile(initialProfile));setPhoneCountry(phoneCountryFor(initialProfile.phoneNumber||''));setEmail(initialProfile.email||initialEmail||'');if(initialMode!=='register'&&initialProfile.currentOnboardingStep!==undefined)setStep(Number(initialProfile.currentOnboardingStep)||0);}},[initialProfile,initialEmail,initialMode]);
  useEffect(()=>{let active=true;let objectUrl='';const path=profile.photoStoragePath;if(!path||!storage){setPhotoPreview(uploadPreview.current||'');return undefined;}getBlob(storageRef(storage,path)).then(blob=>{if(!active)return;objectUrl=URL.createObjectURL(blob);if(uploadPreview.current){URL.revokeObjectURL(uploadPreview.current);uploadPreview.current='';}setPhotoPreview(objectUrl);}).catch(()=>{if(active)setPhotoPreview(uploadPreview.current||'');});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};},[profile.photoStoragePath]);
  useEffect(()=>()=>{if(uploadPreview.current)URL.revokeObjectURL(uploadPreview.current);},[]);

  const update = (key,value) => {dirty.current=true;setProfile(current=>({...current,[key]:value}));setFieldErrors(current=>({...current,[key]:''}));setSaveState('saving');};
  const userRef = () => {const user=auth?.currentUser;if(!user||!db)throw new Error('Your session expired. Sign in again to continue.');return {user,ref:doc(db,'users',user.uid)};};
  const saveProgress = async (nextProfile=profile,nextStep=step,complete=false) => {
    const {user,ref}=userRef();
    const token=await user.getIdTokenResult();
    if(user.emailVerified===true&&token.claims.email_verified!==true)await user.getIdToken(true);
    const clean={
      firstName:String(nextProfile.firstName||'').trim(),lastName:String(nextProfile.lastName||'').trim(),displayName:displayName(nextProfile),phoneNumber:String(nextProfile.phoneNumber||'').trim(),professionalHeadline:String(nextProfile.professionalHeadline||'').trim(),
      country:nextProfile.country||'United States',state:String(nextProfile.state||''),city:String(nextProfile.city||'').trim(),zipCode:String(nextProfile.zipCode||'').trim(),serviceAreas:Array.isArray(nextProfile.serviceAreas)?nextProfile.serviceAreas:splitList(nextProfile.serviceAreas),
      brokerageAffiliated:nextProfile.brokerageAffiliated!==false,brokerageName:nextProfile.brokerageAffiliated===false?'Independent':String(nextProfile.brokerageName||'').trim(),brokerageAddress:String(nextProfile.brokerageAddress||'').trim(),brokerageCity:String(nextProfile.brokerageCity||'').trim(),brokerageState:String(nextProfile.brokerageState||'').trim(),brokerageZipCode:String(nextProfile.brokerageZipCode||'').trim(),brokerageWebsite:String(nextProfile.brokerageWebsite||'').trim(),professionalRelationship:nextProfile.professionalRelationship||'Real Estate Agent',
      propertyTypes:nextProfile.propertyTypes||[],clientTypes:nextProfile.clientTypes||[],yearsExperience:String(nextProfile.yearsExperience||'').trim(),languages:nextProfile.languages||[],specialties:nextProfile.specialties||[],bio:String(nextProfile.bio||'').trim(),professionalWebsite:String(nextProfile.professionalWebsite||'').trim(),photoStoragePath:nextProfile.photoStoragePath||'',
      email:user.email||email.trim(),emailVerified:user.emailVerified===true,onboardingStatus:complete?'COMPLETED':'IN_PROGRESS',currentOnboardingStep:nextStep,onboardingCompleted:complete,completedSteps:complete?[1,2,3,4,5,6]:[1,2,3,4,5].filter(value=>value<nextStep),profileCompletion:completionFor(nextProfile),updatedAt:serverTimestamp(),...(complete?{completedAt:serverTimestamp()}:{})
    };
    const existing=await getDoc(ref);
    if(existing.exists()){
      await setDoc(ref,clean,{merge:true});
    }else{
      await setDoc(ref,{
        uid:user.uid,role:PLATFORM_ROLES.PROFESSIONAL,accountStatus:'PENDING',
        termsAccepted:true,termsVersion:LEGAL_POLICY_VERSION,termsAcceptedAt:serverTimestamp(),
        privacyAcknowledged:true,privacyPolicyVersion:LEGAL_POLICY_VERSION,privacyAcknowledgedAt:serverTimestamp(),
        createdAt:serverTimestamp(),...clean,
      });
    }
    setSaveError('');setSaveState('saved');return clean;
  };

  useEffect(()=>{
    if(screen!=='onboarding'||step<1||step>5||!auth?.currentUser||!db||!dirty.current)return undefined;
    const timer=window.setTimeout(()=>{saveProgress(profile,step).catch(cause=>{setSaveState('error');setSaveError(readableError(cause));});},900);
    return()=>window.clearTimeout(timer);
  },[profile,step,screen]);

  const createAccount=async event=>{
    event.preventDefault();setError('');setFieldErrors({});
    const errors={};
    if(profile.firstName.trim().length<2||profile.firstName.trim().length>80)errors.firstName='First name must be between 2 and 80 characters.';
    if(profile.lastName.trim().length<2||profile.lastName.trim().length>80)errors.lastName='Last name must be between 2 and 80 characters.';
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))errors.email='Enter a valid email address.';
    if(!passwordValid)errors.password='Use at least 8 characters with uppercase, lowercase and a number.';
    if(password!==confirmPassword)errors.confirmPassword='Passwords do not match.';
    if(!terms)errors.terms='Please agree to the Terms of Service.';
    if(!privacy)errors.privacy='Please acknowledge the Privacy Policy.';
    if(Object.keys(errors).length){setFieldErrors(errors);return;}
    if(!auth||!db){setError('Account service is unavailable. Check the Firebase connection and try again.');return;}
    setBusy(true);
    try{
      const credential=await createUserWithEmailAndPassword(auth,email.trim().toLowerCase(),password);
      const fullName=[profile.firstName.trim(),profile.lastName.trim()].join(' ');
      await updateProfile(credential.user,{displayName:fullName});
      const record={uid:credential.user.uid,role:PLATFORM_ROLES.PROFESSIONAL,accountStatus:'PENDING',email:credential.user.email,emailVerified:false,firstName:profile.firstName.trim(),lastName:profile.lastName.trim(),displayName:fullName,phoneNumber:'',onboardingStatus:'EMAIL_VERIFICATION_PENDING',currentOnboardingStep:0,onboardingCompleted:false,profileCompletion:0,completedSteps:[],termsAccepted:true,termsVersion:LEGAL_POLICY_VERSION,privacyAcknowledged:true,privacyPolicyVersion:LEGAL_POLICY_VERSION,termsAcceptedAt:serverTimestamp(),privacyAcknowledgedAt:serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
      await setDoc(doc(db,'users',credential.user.uid),record,{merge:true});
      await sendEmailVerification(credential.user,{url:`${window.location.origin}/verify-email`,handleCodeInApp:false});
      window.history.replaceState({},'','/verify-email');setEmail(credential.user.email||email.trim());setBusy(false);
    }catch(cause){setError(readableError(cause));setBusy(false);}
  };

  const validateStep=()=>{
    const errors={};
    if(step===1){if(profile.firstName.trim().length<2||profile.firstName.trim().length>80)errors.firstName='First name must be between 2 and 80 characters.';if(profile.lastName.trim().length<2||profile.lastName.trim().length>80)errors.lastName='Last name must be between 2 and 80 characters.';const phoneError=validatePhone(profile.phoneNumber,phoneCountry);if(phoneError)errors.phoneNumber=phoneError;}
    if(step===2){if(!profile.state)errors.state=profile.country==='Canada'?'Enter your province or territory.':profile.country==='United States'?'Choose your state.':'Enter your state or region.';if(profile.city.trim().length<2||profile.city.trim().length>100)errors.city='City must be between 2 and 100 characters.';const postal=profile.zipCode.trim();if(profile.country==='United States'&&!/^\d{5}(-\d{4})?$/.test(postal))errors.zipCode='Enter a valid 5-digit ZIP code.';else if(profile.country==='Canada'&&!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(postal))errors.zipCode='Enter a valid Canadian postal code.';else if(profile.country==='Other'&&!postal)errors.zipCode='Enter a postal code.';if(!profile.serviceAreas?.length)errors.serviceAreas='Add at least one primary service area.';}
    if(step===3&&profile.brokerageAffiliated){if(profile.brokerageName.trim().length<2||profile.brokerageName.trim().length>120)errors.brokerageName='Brokerage name must be between 2 and 120 characters.';if(profile.brokerageAddress.trim().length<5||profile.brokerageAddress.trim().length>180)errors.brokerageAddress='Enter a brokerage address between 5 and 180 characters.';if(profile.brokerageCity.trim().length<2||profile.brokerageCity.trim().length>100)errors.brokerageCity='City must be between 2 and 100 characters.';if(!profile.brokerageState)errors.brokerageState='Choose the brokerage state.';if(!/^\d{5}(-\d{4})?$/.test(profile.brokerageZipCode.trim()))errors.brokerageZipCode='Enter a valid 5-digit ZIP code.';}
    if(step===4){if(!profile.propertyTypes?.length)errors.propertyTypes='Choose at least one property type.';if(!profile.clientTypes?.length)errors.clientTypes='Choose at least one client type.';}
    setFieldErrors(errors);return Object.keys(errors).length===0;
  };
  const continueStep=async()=>{
    setError('');if(!validateStep())return;setBusy(true);
    try{const nextStep=step===5?6:step+1;await saveProgress(profile,nextStep);setStep(nextStep);setSaveState('saved');}
    catch(cause){setError(readableError(cause));setSaveState('error');setSaveError(readableError(cause));}
    finally{setBusy(false);}
  };
  const retrySave=async()=>{setSaveState('saving');setSaveError('');try{await saveProgress(profile,step);}catch(cause){setSaveState('error');setSaveError(readableError(cause));}};
  const startProfileSetup=()=>{
    // Keep the user's explicit step choice when the parent receives its next
    // Firestore snapshot; otherwise the initial server step can reset to 0.
    dirty.current=true;
    setError('');setSaveError('');setSaveState('saving');setStep(1);
    saveProgress(profile,1).catch(cause=>{setSaveState('error');setSaveError(readableError(cause));});
  };
  const backStep=async()=>{
    if(step<=1){setStep(0);return;}setBusy(true);try{await saveProgress(profile,step-1);setStep(step-1);setError('');}catch(cause){setError(readableError(cause));}finally{setBusy(false);}
  };
  const uploadPhoto=async file=>{
    setError('');setPhotoError('');if(!file||uploading)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){setPhotoError('Choose a JPG, PNG, or WebP image.');return;}
    if(file.size>5*1024*1024){setPhotoError('Your profile photo must be 5 MB or smaller.');return;}
    if(!storage||!auth?.currentUser){setPhotoError('Secure photo storage is unavailable. Check the Firebase Storage configuration.');return;}
    if(uploadPreview.current)URL.revokeObjectURL(uploadPreview.current);const previousPreview=photoPreview;const tempUrl=URL.createObjectURL(file);uploadPreview.current=tempUrl;setPhotoPreview(tempUrl);setUploading(true);setPhotoUploadProgress(0);let uploadedPath='';
    try{
      // Refresh claims so Storage rules see a recently verified email address.
      await withTimeout(auth.currentUser.reload(),15000,'Refreshing your sign-in took too long. Check your connection and retry.');
      await withTimeout(auth.currentUser.getIdToken(true),15000,'Refreshing your sign-in took too long. Check your connection and retry.');
      if(!auth.currentUser.emailVerified)throw Object.assign(new Error('Verify your email before uploading a profile photo.'),{code:'profile/email-not-verified'});
      const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)||'profile-photo';
      const path=`profile-photos/${auth.currentUser.uid}/${crypto.randomUUID()}_${safeName}`;
      uploadedPath=path;
      await uploadPhotoFile(storageRef(storage,path),file,setPhotoUploadProgress);
      const next={...profile,photoStoragePath:path};await saveProgress(next,step);update('photoStoragePath',path);
      setPhotoError('');uploadedPath='';
      if(profile.photoStoragePath){deleteObject(storageRef(storage,profile.photoStoragePath)).catch(()=>{});}
    }catch(cause){if(uploadedPath)await deleteObject(storageRef(storage,uploadedPath)).catch(()=>{});const message=cause?.code==='profile/email-not-verified'||cause?.code==='profile/timeout'||cause?.code==='profile/upload-timeout'?cause.message:readableError(cause);setPhotoError(message);if(uploadPreview.current){URL.revokeObjectURL(uploadPreview.current);uploadPreview.current='';}setPhotoPreview(previousPreview);}finally{setUploading(false);setPhotoUploadProgress(0);}
  };
  const removePhoto=async()=>{setError('');const old=profile.photoStoragePath;const next={...profile,photoStoragePath:''};update('photoStoragePath','');setPhotoPreview('');uploadPreview.current='';try{await saveProgress(next,step);if(old)await deleteObject(storageRef(storage,old)).catch(()=>{});}catch(cause){setError(readableError(cause));}};
  const finishPreview=async()=>{setError('');setBusy(true);try{await saveProgress(profile,7,true);setStep(7);}catch(cause){setError(readableError(cause));}finally{setBusy(false);}};
  const complete=()=>{window.history.replaceState({},'','/verification');onComplete?.();};
  const errorFor=key=>fieldErrors[key]&&<small className="po-error-text">{fieldErrors[key]}</small>;
  const field=(label,key,options={})=><ReactField label={label} value={profile[key]} required={options.required} type={options.type} placeholder={options.placeholder} autoComplete={options.autoComplete} helper={options.helper} error={fieldErrors[key]} onChange={value=>update(key,value)} />;

  return <main className={`po-shell${screen==='register'?' po-shell-register':''}`}>
    <div className="po-orb po-orb-one"/><div className="po-orb po-orb-two"/>
    <header className="po-header"><Brand/>{screen==='register'?<button type="button" className="po-text-button" onClick={onSignIn}>Already have an account? <b>Sign in</b></button>:<button type="button" className="po-quiet-button" onClick={onCancel}>Sign out</button>}</header>
    {screen==='register'?<section className="po-register-card">
      <div className="po-register-art"><span><UserRound size={24}/></span><div><b>Your professional network starts here.</b><small>Create one account, then build your profile one step at a time.</small></div><i/><i/></div>
      <form className="po-register-form" onSubmit={createAccount} noValidate>
        <span className="po-eyebrow"><Sparkles size={14}/> PROFESSIONAL MEMBERSHIP</span><h1>Create your professional account</h1><p className="po-lead">Join AgentReferrals and connect with trusted real-estate professionals.</p>
        <div className="po-form-grid">{field('First name','firstName',{required:true,placeholder:'e.g. John',autoComplete:'given-name'})}{field('Last name','lastName',{required:true,placeholder:'e.g. Johnson',autoComplete:'family-name'})}<ReactField label="Email" value={email} onChange={value=>{setEmail(value);setFieldErrors(current=>({...current,email:''}));}} error={fieldErrors.email} type="email" required placeholder="you@example.com" autoComplete="email"/></div>
        <label className="po-field"><span>Password <i>*</i></span><div className="po-password"><LockKeyhole size={16}/><input type={showPassword?'text':'password'} value={password} onChange={event=>{setPassword(event.target.value);setFieldErrors(current=>({...current,password:''}));}} autoComplete="new-password" placeholder="At least 8 characters" aria-describedby="po-password-strength"/><button type="button" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div><span className="po-strength" id="po-password-strength"><i data-active={passwordStrength>0}/><i data-active={passwordStrength>1}/><i data-active={passwordStrength>2}/><i data-active={passwordStrength>3}/><small>{!password?'8+ chars · upper · lower · number':passwordValid?(passwordStrength===5?'Strong':'Good'):'Add 8+ chars, upper, lower & number'}</small></span>{fieldErrors.password&&<small className="po-error-text">{fieldErrors.password}</small>}</label>
        <label className="po-field"><span>Confirm password <i>*</i></span><input type={showPassword?'text':'password'} value={confirmPassword} onChange={event=>{setConfirmPassword(event.target.value);setFieldErrors(current=>({...current,confirmPassword:''}));}} autoComplete="new-password" placeholder="Re-enter your password" aria-invalid={Boolean(fieldErrors.confirmPassword)}/>{fieldErrors.confirmPassword&&<small className="po-error-text">{fieldErrors.confirmPassword}</small>}</label>
        <label className="po-consent"><input type="checkbox" checked={terms} onChange={event=>setTerms(event.target.checked)}/><span>I agree to the <b><a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a></b>.</span></label>{fieldErrors.terms&&<small className="po-error-text">{fieldErrors.terms}</small>}
        <label className="po-consent"><input type="checkbox" checked={privacy} onChange={event=>setPrivacy(event.target.checked)}/><span>I acknowledge the <b><a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></b>.</span></label>{fieldErrors.privacy&&<small className="po-error-text">{fieldErrors.privacy}</small>}
        {error&&<div className="po-alert" role="alert"><X size={16}/>{error}</div>}
        <button className="po-primary" disabled={busy}>{busy?<><LoaderCircle className="po-spin" size={17}/> Creating your account…</>:'Create Account'}{!busy&&<ArrowRight size={17}/>}</button>
        <small className="po-privacy-note"><ShieldCheck size={14}/> Email verification is separate from professional verification.</small>
      </form>
    </section>:<>
      <section className="po-progress-block"><span className="po-eyebrow">PROFILE SETUP</span><div className="po-progress-head"><b>{step===0?'Your professional profile':step===6?'Profile preview':step===7?'All set':'Build your profile'}</b><small>{step>=1&&step<=5?`Step ${step} of 5`:step===6?'Review':'One step at a time'}</small></div><div className="po-progress-track" aria-label={`${Math.max(0,Math.min(step,5))} of 5 profile steps complete`}>{[1,2,3,4,5].map(item=><i key={item} className={step>=item?'complete':''}/>)}</div>{step>=1&&step<=5&&<div className={`po-save-row ${saveState==='error'?'has-error':''}`}><div className="po-save-indicator"><i className={saveState}/>{saveState==='saving'?'Saving your progress…':saveState==='error'?'Save needs attention':'Progress saved'}</div>{saveState==='error'&&<><span className="po-save-error" role="alert">{saveError||'We could not save this step. Check your connection and retry.'}</span><button type="button" className="po-save-retry" onClick={retrySave}>Retry save</button></>}</div>}</section>
      <section className="po-content" key={`${screen}-${step}`}>
        {step===0&&<article className="po-welcome po-step-enter"><div className="po-welcome-main"><span className="po-welcome-icon"><Sparkles size={26}/></span><span className="po-eyebrow">WELCOME TO AGENTREFERRALS</span><h1>Let’s build your professional profile.</h1><p>Your profile helps other professionals understand who you are, where you work, and the clients you serve.</p><div className="po-welcome-actions"><button className="po-primary" onClick={startProfileSetup}>Let’s Get Started <ArrowRight size={17}/></button><button className="po-later" onClick={onCancel}>Complete Later</button></div></div><aside className="po-welcome-side"><span className="po-eyebrow">YOUR SETUP JOURNEY</span><h2>Five simple steps to get started</h2><div className="po-welcome-list">{['Basic information','Professional location','Brokerage','Professional preferences','Profile setup'].map((item,index)=><span key={item}><i><Check size={13}/></i>{item}<small>{String(index+1).padStart(2,'0')}</small></span>)}</div><div className="po-welcome-note"><ShieldCheck size={16}/><span>Your progress saves as you go, so you can come back anytime.</span></div></aside></article>}
        {step===1&&<article className="po-step-card po-step-enter"><StepTitle icon={<UserRound size={19}/>} title="Tell us about yourself" subtitle="This information will appear on your professional profile."/ ><div className="po-form-grid">{field('First name','firstName',{required:true,placeholder:'First name',autoComplete:'given-name'})}{field('Last name','lastName',{required:true,placeholder:'Last name',autoComplete:'family-name'})}{field('Preferred display name','displayName',{placeholder:name||'How colleagues know you'})}<label className="po-field"><span>Phone number <i>*</i></span><div className="po-phone-control"><select aria-label="Country calling code" value={`${phoneCountry.name}|${phoneCountry.code}`} onChange={event=>{const next=PHONE_COUNTRIES.find(item=>`${item.name}|${item.code}`===event.target.value)||PHONE_COUNTRIES[0];const prefix=digitsOnly(phoneCountry.code),current=digitsOnly(profile.phoneNumber),national=current.startsWith(prefix)?current.slice(prefix.length):current;setPhoneCountry(next);update('phoneNumber',national?`${next.code} ${national}`:'');}}>{PHONE_COUNTRIES.map((country,index)=><option key={`${country.name}-${index}`} value={`${country.name}|${country.code}`}>{country.name} ({country.code})</option>)}</select><input type="tel" inputMode="numeric" autoComplete="tel-national" value={(()=>{const all=digitsOnly(profile.phoneNumber),prefix=digitsOnly(phoneCountry.code);return all.startsWith(prefix)?all.slice(prefix.length):all;})()} onChange={event=>{const national=digitsOnly(event.target.value);update('phoneNumber',national?`${phoneCountry.code} ${national}`:'');}} placeholder={phoneCountry.code==='+1'?'512 555 0123':'Enter number'} aria-invalid={Boolean(fieldErrors.phoneNumber)} aria-describedby={fieldErrors.phoneNumber?'po-phone-error':'po-phone-help'}/></div><small id="po-phone-help">Choose your country code. Enter the number without the country code.</small>{fieldErrors.phoneNumber&&<small id="po-phone-error" className="po-error-text" role="alert">{fieldErrors.phoneNumber}</small>}</label>{field('Professional headline','professionalHeadline',{wide:true,placeholder:'Residential real-estate professional'})}</div></article>}
        {step===2&&<article className="po-step-card po-step-enter"><StepTitle icon={<MapPin size={19}/>} title="Where do you work?" subtitle="Tell other professionals where you primarily serve clients."/><div className="po-form-grid"><label className="po-field"><span>Country <i>*</i></span><select value={profile.country} onChange={event=>{update('country',event.target.value);update('state','');update('zipCode','');}}><option>United States</option><option>Canada</option><option>Other</option></select></label>{profile.country==='United States'?<label className="po-field"><span>State <i>*</i></span><select value={profile.state} onChange={event=>update('state',event.target.value)}><option value="">Select a state</option>{STATES.map(state=><option key={state}>{state}</option>)}</select>{errorFor('state')}</label>:field(profile.country==='Canada'?'Province or territory':'State or region','state',{required:true,placeholder:profile.country==='Canada'?'e.g. Ontario':'e.g. England'})}{field('City','city',{required:true,placeholder:'e.g. Austin'})}{field(profile.country==='United States'?'ZIP code':'Postal code','zipCode',{required:true,placeholder:profile.country==='United States'?'5-digit ZIP':profile.country==='Canada'?'e.g. M5V 2T6':'Postal code',autoComplete:'postal-code'})}<label className="po-field wide"><span>Primary service areas <i>*</i></span><input aria-invalid={Boolean(fieldErrors.serviceAreas)} value={(profile.serviceAreas||[]).join(', ')} onChange={event=>update('serviceAreas',splitList(event.target.value))} placeholder="Austin, Round Rock, Cedar Park"/><small>Separate places with commas.</small>{errorFor('serviceAreas')}</label></div></article>}
        {step===3&&<article className="po-step-card po-step-enter"><StepTitle icon={<Building2 size={19}/>} title="Tell us about your brokerage" subtitle="Add the brokerage you currently work with."/><fieldset className="po-radio-field"><legend>Are you affiliated with a brokerage?</legend><label><input type="radio" checked={profile.brokerageAffiliated} onChange={()=>update('brokerageAffiliated',true)}/> Yes, I’m affiliated</label><label><input type="radio" checked={!profile.brokerageAffiliated} onChange={()=>update('brokerageAffiliated',false)}/> No, I’m independent</label></fieldset>{profile.brokerageAffiliated&&<div className="po-form-grid">{field('Brokerage name','brokerageName',{required:true,placeholder:'Company or brokerage'})}{field('Brokerage address','brokerageAddress',{required:true,placeholder:'Street address'})}{field('City','brokerageCity',{required:true,placeholder:'City'})}<label className="po-field"><span>State <i>*</i></span><select value={profile.brokerageState} onChange={event=>update('brokerageState',event.target.value)}><option value="">Select state</option>{STATES.map(state=><option key={state}>{state}</option>)}</select>{errorFor('brokerageState')}</label>{field('ZIP code','brokerageZipCode',{required:true,placeholder:'5-digit ZIP'})}{field('Brokerage website','brokerageWebsite',{type:'url',placeholder:'https://example.com'})}</div>}<label className="po-field po-relationship"><span>Professional relationship</span><select value={profile.professionalRelationship} onChange={event=>update('professionalRelationship',event.target.value)}>{ROLES.map(role=><option key={role}>{role}</option>)}</select></label></article>}
        {step===4&&<article className="po-step-card po-step-enter"><StepTitle icon={<Globe2 size={19}/>} title="What kind of business do you work with?" subtitle="These preferences help us personalize your referral opportunities."/><ChoiceChips label="Property types *" options={PROPERTY_TYPES} selected={profile.propertyTypes||[]} onChange={values=>{update('propertyTypes',values);setFieldErrors(current=>({...current,propertyTypes:''}));}}/>{errorFor('propertyTypes')}<ChoiceChips label="Client types *" options={CLIENT_TYPES} selected={profile.clientTypes||[]} onChange={values=>{update('clientTypes',values);setFieldErrors(current=>({...current,clientTypes:''}));}}/>{errorFor('clientTypes')}<label className="po-field po-relationship"><span>Areas of interest</span><input value={(profile.serviceAreas||[]).join(', ')} onChange={event=>update('serviceAreas',splitList(event.target.value))} placeholder="Your location-based areas of interest"/><small>Uses your primary service areas from the previous step.</small></label></article>}
        {step===5&&<article className="po-step-card po-step-enter"><StepTitle icon={<BadgeCheck size={19}/>} title="Complete your professional profile" subtitle="Add a few final details so your profile feels complete."/><div className="po-photo-row"><div className="po-photo-preview">{photoPreview?<img src={photoPreview} alt="Profile preview"/>:<UserRound size={30}/>}</div><div><b>Profile photo</b><small>JPG, PNG or WebP · up to 5 MB · optional</small><div className="po-photo-actions"><button type="button" onClick={()=>photoInput.current?.click()} disabled={uploading}><UploadCloud size={15}/>{uploading?(photoUploadProgress===0?'Connecting to storage…':`Uploading ${photoUploadProgress}%`):photoPreview?'Replace photo':'Upload photo'}</button>{photoPreview&&<button type="button" className="remove" onClick={removePhoto} disabled={uploading}>Remove</button>}</div></div><input ref={photoInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value="";uploadPhoto(file);}}/>{photoError&&<small className="po-error-text" role="alert">{photoError}</small>}</div><div className="po-form-grid">{field('Years of experience','yearsExperience',{type:'number',placeholder:'e.g. 8'})}{field('Professional website','professionalWebsite',{type:'url',placeholder:'https://example.com'})}<label className="po-field"><span>Languages</span><input value={(profile.languages||[]).join(', ')} onChange={event=>update('languages',splitList(event.target.value))} placeholder="English, Spanish"/><small>Separate languages with commas.</small></label><label className="po-field"><span>Specialties</span><input value={(profile.specialties||[]).join(', ')} onChange={event=>update('specialties',splitList(event.target.value))} placeholder="Residential, relocation"/><small>Separate specialties with commas.</small></label><label className="po-field wide"><span>Professional bio</span><textarea rows={5} maxLength={2000} value={profile.bio||''} onChange={event=>update('bio',event.target.value)} placeholder="Tell other professionals about your experience and the markets you serve."/><small>{(profile.bio||'').length}/2,000 characters</small></label></div><div className="po-completion-meter"><span><b>Profile completion</b><strong>{progress}%</strong></span><i><b style={{width:`${progress}%`}}/></i><small>Calculated from the profile details you’ve added.</small></div></article>}
        {step===6&&<article className="po-step-card po-preview-card po-step-enter"><StepTitle icon={<Eye size={19}/>} title="Here’s how your professional profile will look" subtitle="Preview your profile before you finish setting it up."/><div className="po-preview"><header>{photoPreview?<img src={photoPreview} alt=""/>:<span><UserRound size={27}/></span>}<div><h2>{name||'Your name'}</h2><p>{profile.professionalHeadline||profile.professionalRelationship||'Professional real-estate profile'}</p><small><MapPin size={13}/>{[profile.city,profile.state].filter(Boolean).join(', ')||'Location not added'}{profile.brokerageAffiliated&&profile.brokerageName?` · ${profile.brokerageName}`:''}</small></div></header><div className="po-preview-tags">{[...(profile.clientTypes||[]),...(profile.propertyTypes||[])].map((item,index)=><span key={`${item}-${index}`}>{item}</span>)}</div>{profile.bio&&<section><b>About</b><p>{profile.bio}</p></section>}{profile.serviceAreas?.length>0&&<section><b>Service areas</b><p>{profile.serviceAreas.join(' · ')}</p></section>}{profile.specialties?.length>0&&<section><b>Specialties</b><p>{profile.specialties.join(' · ')}</p></section>}{profile.languages?.length>0&&<section><b>Languages</b><p>{profile.languages.join(' · ')}</p></section>}</div></article>}
        {step===7&&<article className="po-complete po-step-enter"><span className="po-complete-icon"><CheckCircle2 size={32}/></span><span className="po-eyebrow">ONBOARDING COMPLETE</span><h1>Your profile is ready.</h1><p>You’re all set. Your professional profile has been saved.</p><div className="po-complete-checks"><span><CheckCircle2 size={16}/> Account created</span><span><CheckCircle2 size={16}/> Email verified</span><span><CheckCircle2 size={16}/> Profile completed</span></div><button className="po-primary" onClick={complete}>Continue <ArrowRight size={17}/></button><small>Professional verification is a separate next step.</small></article>}
        {error&&<div className="po-alert" role="alert"><X size={16}/>{error}</div>}
      </section>
      {step>=1&&step<=6&&<footer className="po-step-footer"><button className="po-back" type="button" onClick={backStep} disabled={busy}><ChevronLeft size={16}/>{step===1?'Welcome':'Back'}</button>{step===6?<><button className="po-back" type="button" onClick={()=>{setStep(5);setError('');}}>Back to edit</button><button className="po-primary" type="button" onClick={finishPreview} disabled={busy}>{busy?'Saving…':'Looks Good — Continue'}{!busy&&<ArrowRight size={17}/>}</button></>:<button className="po-primary" type="button" onClick={continueStep} disabled={busy||uploading}>{busy?<><LoaderCircle className="po-spin" size={17}/> Saving…</>:'Continue'}{!busy&&<ArrowRight size={17}/>}</button>}</footer>}
    </>}
    <footer className="po-footer"><span>© 2026 AgentReferrals.org</span><span><ShieldCheck size={13}/> Your profile details stay in your account.</span></footer>
  </main>;
}

function ReactField({label,value,onChange,required,type='text',placeholder,autoComplete,helper,error}){const id=`po-${label.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;return <label className="po-field" htmlFor={id}><span>{label}{required&&<i> *</i>}</span><input id={id} type={type} value={value||''} onChange={event=>onChange(event.target.value)} placeholder={placeholder} required={required} autoComplete={autoComplete} aria-invalid={Boolean(error)}/>{helper&&<small>{helper}</small>}{error&&<small className="po-error-text">{error}</small>}</label>}
function StepTitle({icon,title,subtitle}){return <header className="po-step-title"><span>{icon}</span><div><h1>{title}</h1><p>{subtitle}</p></div></header>}
