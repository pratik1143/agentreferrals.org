import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, CircleHelp, CirclePlay, Compass, Eye, EyeOff, Fingerprint, Handshake, LockKeyhole, Mail, MapPin, Menu, Phone, Send, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';
import { auth, db, firebaseConfigured } from './firebase';
import { confirmEmailOtp, requestVerificationEmail, verificationSnapshot, subscribeVerification } from './email-verification';
import { createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, RecaptchaVerifier, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPhoneNumber, signInWithPopup, signInWithRedirect, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import ConnectionJourney from './ConnectionJourney';
import { isProfessionalRole, PLATFORM_ROLES } from './roles';
import ProfessionalPanel from './ProfessionalPanel';
import AdminPortal from './AdminPortal';
import FernlySuperAdmin from './FernlySuperAdmin';
import OnboardingFlow from './OnboardingFlow';
import ProfessionalOnboarding from './ProfessionalOnboarding';
import VerificationPendingGate from './VerificationPendingGate';
import PlatformLoader from './PlatformLoader';
import LegalDocument from './LegalDocument';
import PublicAgentCard from './PublicAgentCard';
import HomeReferralHero from './HomeReferralHero';

const providers = { email: 'Email', google: 'Google', phone: 'Phone' };
const translateAuthError = (error) => ({
  'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.',
  'auth/invalid-credential': 'Sign-in was rejected. Check the password, or reset it if it may have changed.',
  'auth/invalid-login-credentials': 'Sign-in was rejected. Check the password, or reset it if it may have changed.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password with at least 6 characters.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window. Allow pop-ups and try again.',
  'auth/unauthorized-domain': 'This domain is not yet authorized in the Firebase project.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'Network connection failed. Check your connection and try again.',
  'auth/user-not-found': 'No account was found for that email. Create an account to get started.',
  'auth/requires-recent-login': 'For security, sign in again and retry this action.',
  'auth/invalid-phone-number': 'Enter your phone in international format, including country code.',
  'auth/quota-exceeded': 'SMS limit reached for this Firebase project. Try later or use another sign-in method.',
  'auth/missing-phone-number': 'Enter a phone number first.',
  'auth/invalid-verification-code': 'That verification code is not correct.',
}[error?.code] || error?.message || 'Something went wrong. Please try again.');

function Brand(){return <div className="brand"><img className="brandMark" src="/agentreferrals-mark.svg" alt=""/><span>Agent<span className="blue">Referrals</span></span></div>}
function FirebaseNotice(){return <div className="firebaseNotice"><span className="noticeDot" style={firebaseConfigured?{background:'#168568'}:{}}/><span>{firebaseConfigured?'Firebase connection configured':'Firebase project connection needed'}</span>{!firebaseConfigured&&<span className="noticeInfo" title="Auth and Firestore code is ready. Add your registered Firebase Web app config in .env.local">i</span>}</div>}
function AuthCard({initialMode='signin', onSwitchToOnboard}){
  const [mode,setMode]=useState(initialMode);const [method,setMethod]=useState('email');const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [phone,setPhone]=useState('');const [code,setCode]=useState('');const [confirmation,setConfirmation]=useState(null);const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [info,setInfo]=useState('');const [showResetShortcut,setShowResetShortcut]=useState(false);const verifier=useRef(null);
  useEffect(()=>()=>{if(verifier.current){try{verifier.current.clear()}catch{}}},[]);
  const ready=()=>{if(!firebaseConfigured||!auth||!db)throw new Error('Firebase is not connected yet. Add the Firebase Web app values to .env.local to turn on sign-in.');};
  async function ensureProfile(user,preferredName=''){if(!db)return;const claims=(await user.getIdTokenResult()).claims;if(['ADMIN','SUPER_ADMIN'].includes(claims.platformRole))return;const ref=doc(db,'users',user.uid);const snap=await getDoc(ref);if(!snap.exists()){const invitedBy=sessionStorage.getItem('agentreferrals_invited_by')||'';await setDoc(ref,{uid:user.uid,displayName:preferredName||user.displayName||'New professional',email:user.email||null,phoneNumber:user.phoneNumber||null,role:PLATFORM_ROLES.PROFESSIONAL,accountStatus:'PENDING',emailVerified:user.emailVerified===true,onboardingStatus:'NOT_STARTED',currentOnboardingStep:0,onboardingCompleted:false,completedSteps:[],profileCompletion:0,...(invitedBy&&invitedBy!==user.uid?{referredByProfessionalId:invitedBy}:{}),createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});sessionStorage.removeItem('agentreferrals_invited_by')}else await setDoc(ref,{updatedAt:serverTimestamp()}, {merge:true});}
  async function submit(e){
    e.preventDefault();setError('');setInfo('');setShowResetShortcut(false);
    const normalizedEmail=email.trim().toLowerCase();
    if(method==='email'){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)){setError('Enter a valid email address.');return;}
      if(mode==='signup'&&name.trim().length<2){setError('Enter your full name (at least 2 characters).');return;}
      if(mode!=='reset'&&!password){setError('Enter your password.');return;}
      if(mode==='signup'&&(password.length<8||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password))){setError('Use at least 8 characters with uppercase, lowercase and a number.');return;}
    }else if(method==='phone'){
      const digits=phone.replace(/\D/g,'');
      if(!confirmation&&(digits.length<7||digits.length>15)){setError('Enter a valid phone number with country code (7–15 digits).');return;}
      if(confirmation&&!/^\d{6}$/.test(code.trim())){setError('Enter the 6-digit verification code.');return;}
    }
    setBusy(true);try{ready();if(method==='email'){if(mode==='reset'){await sendPasswordResetEmail(auth,normalizedEmail);setInfo('Password reset link sent. Check your inbox.')}else if(mode==='signup'){if(onSwitchToOnboard){onSwitchToOnboard(normalizedEmail);return}const cred=await createUserWithEmailAndPassword(auth,normalizedEmail,password);if(name.trim())await updateProfile(cred.user,{displayName:name.trim()});await ensureProfile(cred.user,name.trim());await requestVerificationEmail(cred.user);setInfo('Account created. A verification code was sent to your email.')}else{const cred=await signInWithEmailAndPassword(auth,normalizedEmail,password);await ensureProfile(cred.user)}}else if(method==='phone'){if(!confirmation){if(!verifier.current)verifier.current=new RecaptchaVerifier(auth,'phone-recaptcha',{size:'invisible'});const result=await signInWithPhoneNumber(auth,phone.trim(),verifier.current);setConfirmation(result);setInfo(`We sent a code to ${phone}.`)}else{const cred=await confirmation.confirm(code.trim());await ensureProfile(cred.user)}}}catch(err){setError(translateAuthError(err));setShowResetShortcut(mode==='signin'&&method==='email'&&['auth/invalid-credential','auth/invalid-login-credentials','auth/wrong-password'].includes(err?.code));if(verifier.current){try{verifier.current.clear()}catch{}verifier.current=null}}finally{setBusy(false)}}
  async function google(){setError('');setInfo('');setBusy(true);try{ready();const provider=new GoogleAuthProvider();if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){await signInWithRedirect(auth,provider);return}const result=await signInWithPopup(auth,provider);await ensureProfile(result.user)}catch(err){setError(translateAuthError(err))}finally{setBusy(false)}}
  const phoneMode=method==='phone';const reset=mode==='reset';
  return <div className="authCard"><div className="cardBrand"><Brand/><span className="secure"><ShieldCheck size={14}/> Secure sign in</span></div><div className="cardIntro"><div className="eyebrow"><Sparkles size={14}/> THE TRUSTED REFERRAL NETWORK</div><h1>{mode==='signup'?'Build your network.':reset?'Reset your password.':'Good business starts here.'}</h1><p>{mode==='signup'?'Join verified professionals sharing better opportunities.':reset?'We’ll email you a secure password reset link.':'Connect with trusted professionals and turn introductions into opportunity.'}</p></div>
    {mode!=='reset'&&<div className="tabs"><button className={method==='email'?'selected':''} onClick={()=>{setMethod('email');setError('');setInfo('')}}><Mail size={15}/> Email</button><button className={method==='google'?'selected':''} onClick={()=>{setMethod('google');setError('');setInfo('')}}><span className="googleG">G</span> Google</button><button className={method==='phone'?'selected':''} onClick={()=>{setMethod('phone');setError('');setInfo('')}}><Phone size={15}/> Phone</button></div>}
    {method==='google'&&<div className="googlePane"><p>Continue securely with your Google account.</p><button className="googleButton" disabled={busy} onClick={google}><span className="googleG">G</span> Continue with Google <ArrowRight size={16}/></button></div>}
    {method==='email'&&<form onSubmit={submit}>{mode==='signup'&&<label>Full name<div className="inputWrap"><UserRound size={17}/><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Jordan Parker" required/></div></label>}<label>Email address<div className="inputWrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/></div></label>{!reset&&<label>Password<div className="inputWrap"><LockKeyhole size={17}/><input type={show?'text':'password'} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength="6" required/><button type="button" className="eye" onClick={()=>setShow(!show)} aria-label="Toggle password visibility">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>}{mode==='signin'&&<button type="button" className="forgot" onClick={()=>{setMode('reset');setError('');setInfo('')}}>Forgot password?</button>}<button className="submit" disabled={busy}>{busy?'Please wait…':reset?'Send reset link':mode==='signup'?'Create account':'Sign in'} <ArrowRight size={16}/></button></form>}
    {method==='phone'&&<form onSubmit={submit}><label>Phone number<div className="inputWrap"><Phone size={17}/><input type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 512 555 0123" required disabled={!!confirmation}/></div><span className="fieldHint">Use your country code. We’ll text you a one-time code.</span></label>{confirmation&&<label>Verification code<div className="inputWrap"><Fingerprint size={17}/><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="6-digit code" required/></div></label>}<div id="phone-recaptcha"/><button className="submit" disabled={busy}>{busy?'Please wait…':confirmation?'Verify and continue':'Text me a code'} <ArrowRight size={16}/></button></form>}
    {error&&<div role="alert" className="message error"><X size={15}/>{error}</div>}{showResetShortcut&&<button type="button" className="forgot authResetHint" onClick={()=>{setMode('reset');setError('');setInfo('');setShowResetShortcut(false)}}>Send a password reset link to this email</button>}{info&&<div role="status" className="message success"><CheckCircle2 size={15}/>{info}</div>}
    {method==='email'&&<div className="switch">{reset?<button onClick={()=>{setMode('signin');setInfo('');setError('')}}>← Back to sign in</button>:<>{mode==='signup'?'Already have an account?':'New to AgentReferrals.org?'} <button onClick={()=>{if(mode==='signup'){setMode('signin');setInfo('');setError('')}else{if(onSwitchToOnboard)onSwitchToOnboard();else setMode('signup');setInfo('');setError('')}}}>{mode==='signup'?'Sign in':'Create an account'}</button></>}</div>}
    <div className="terms">Your account details remain private. Opportunity access is reserved for approved professionals.</div>
  </div>
}
function VerifyEmailPage({user,onLogout,onVerified}){
  const delivery=useSyncExternalStore(subscribeVerification,()=>verificationSnapshot(user.uid));
  const [now,setNow]=useState(Date.now());
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState('');
  const [otp,setOtp]=useState('');
  const [showAddress,setShowAddress]=useState(false);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer)},[]);
  const cooldown=Math.max(0,Math.ceil((delivery.retryAt-now)/1000));
  const sending=delivery.status==='sending';
  const email=user.email||'';const [localPart,domain]=email.split('@');
  const address=showAddress?email:domain?localPart.slice(0,1)+'********@'+domain:'No email address';
  const resend=async()=>{if(sending||checking||cooldown)return;setError('');try{await requestVerificationEmail(user)}catch{/* Shared request state displays the precise error. */}};
  const confirm=async()=>{
    setError('');setChecking(true);
    try{await confirmEmailOtp(user,otp);onVerified()}
    catch(err){setError(err?.code==='functions/deadline-exceeded'?'That code expired. Request a new one and enter the latest code.':err?.code==='functions/resource-exhausted'?'Too many attempts or requests. Please wait, then request a new code.':err?.code==='functions/permission-denied'?'That code doesn’t match. Check your inbox and try again.':err?.message||'We couldn’t verify that code. Try again.')}
    finally{setChecking(false)}
  };
  return <div className="verifyEmailPage">
    <div className="verifyEmailGlow" aria-hidden="true"/>
    <header className="verifyEmailHeader"><a href="/" aria-label="AgentReferrals.org home"><Brand/></a><button onClick={onLogout}>Sign out</button></header>
    <main className="verifyEmailCard">
      <div className="verifyEmailIcon"><Mail size={25}/></div><span className="verifyEmailEyebrow">ONE QUICK SECURITY STEP</span>
      <h1>Verify your email</h1><p className="verifyEmailLead">We’ll email you a one-time 6-digit code.</p>
      <div className="verifyEmailAddress">{address}</div><button className="verifyAddressToggle" onClick={()=>setShowAddress(value=>!value)}>{showAddress?'Hide email address':'Check full email address'}</button>
      <p className="verifyEmailHint">Enter the code from your inbox. Check spam or junk if you don’t see it.</p>
      <label className="verifyOtpLabel" htmlFor="email-verification-otp">Email verification code</label>
      <input id="email-verification-otp" className="verifyOtpInput" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000" aria-label="6-digit email verification code" />
      <button className="verifyEmailPrimary" onClick={confirm} disabled={checking||otp.length!==6}><CheckCircle2 size={17}/>{checking?'Verifying code…':'Verify email and continue'}<ArrowRight size={16}/></button>
      <button className="verifyEmailResend" onClick={resend} disabled={sending||checking||cooldown>0||!email}><Send size={16}/>{sending?'Sending code…':cooldown>0?'Resend code in '+cooldown+'s':delivery.sentAt?'Resend code':'Send me a code'}</button>
      {delivery.status==='sent'&&<div className="verifyEmailNotice success" role="status">{delivery.message}</div>}
      {delivery.status==='failed'&&<div className="verifyEmailNotice error" role="alert">{delivery.message}</div>}
      {error&&<div className="verifyEmailNotice error" role="alert">{error}</div>}
      <div className="verifyEmailFoot"><ShieldCheck size={15}/> Your license review is a separate step.</div>
    </main><footer className="verifyEmailFooter">© 2026 AgentReferrals.org <span>Secure access for trusted connections</span></footer>
  </div>;
}
function VerifyEmailLinkPage({user,onLogout,onVerified}){
  const [cooldown,setCooldown]=useState(0);const [checking,setChecking]=useState(false);const [sending,setSending]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  useEffect(()=>{if(!cooldown)return undefined;const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearTimeout(timer)},[cooldown]);
  const check=async()=>{setChecking(true);setError('');try{await reload(user);if(user.emailVerified){await user.getIdToken(true);if(db)await setDoc(doc(db,'users',user.uid),{emailVerified:true},{merge:true});onVerified?.();}else setError('Email abhi verify nahi hua. Inbox ke verification link par click karke phir check karein.');}catch(cause){setError(translateAuthError(cause));}finally{setChecking(false)}};
  const resend=async()=>{if(sending||cooldown)return;setSending(true);setError('');setNotice('');try{await sendEmailVerification(user,{url:`${window.location.origin}/verify-email`,handleCodeInApp:false});setCooldown(60);setNotice('Verification link dobara bhej diya hai. Inbox aur spam folder check karein.');}catch(cause){setError(translateAuthError(cause));}finally{setSending(false)}};
  return <main className="verifyEmailPage"><div className="verifyEmailGlow" aria-hidden="true"/><header className="verifyEmailHeader"><a href="/" aria-label="AgentReferrals.org home"><Brand/></a><button onClick={onLogout}>Sign out</button></header><section className="verifyEmailCard"><div className="verifyEmailIcon"><Mail size={25}/></div><span className="verifyEmailEyebrow">ACCOUNT SECURITY</span><h1>Verify your email</h1><p className="verifyEmailLead">We sent a secure verification link to:</p><div className="verifyEmailAddress">{user.email}</div><p className="verifyEmailHint">Open the message and click its link. Afterward, return here and continue to your professional profile.</p><div className="verifyJourney" aria-label="Account setup progress"><div className="current"><i>1</i><span>Email</span></div><b/><div><i>2</i><span>Profile</span></div><b/><div><i>3</i><span>Review</span></div></div><button className="verifyEmailPrimary" onClick={check} disabled={checking}>{checking?'Checking…':'I verified my email'} <ArrowRight size={16}/></button><button className="verifyEmailResend" onClick={resend} disabled={sending||cooldown>0}>{sending?'Sending…':cooldown?`Resend link in ${cooldown}s`:'Resend verification link'}</button>{notice&&<div className="verifyEmailNotice success" role="status">{notice}</div>}{error&&<div className="verifyEmailNotice error" role="alert">{error}</div>}<div className="verifyEmailFoot"><ShieldCheck size={15}/> Professional verification is a separate later step.</div></section></main>;
}

function AuthPage({mode='signin', onStartAuth, onCancel}){
  if(mode==='signup')return <ProfessionalOnboarding initialMode="register" onSignIn={()=>onStartAuth('signin')} onCancel={onCancel}/>;
  return <div className="authPage">
    <div className="authPageGlow authPageGlowOne" aria-hidden="true"/>
    <div className="authPageGlow authPageGlowTwo" aria-hidden="true"/>
    <header className="authPageHeader"><a href="/" aria-label="AgentReferrals.org home"><Brand/></a><a className="authBack" href="/"><ArrowRight size={16}/> Back to website</a></header>
    <main className="authPageMain">
      <section className="authStory" aria-labelledby="authStoryTitle">
        <div className="authStoryEyebrow"><span/> A BETTER WAY TO CONNECT</div>
        <h1 id="authStoryTitle">Your next<br/><em>connection</em><br/>starts here.</h1>
        <p className="authStoryLead">One thoughtful introduction can open a new opportunity. {mode==='signup'?'Create your account in the space built for real estate professionals who make those connections count.':'Sign in to the space built for real estate professionals who make those connections count.'}</p>
        <div className="authStoryCards" aria-label="What you can do in AgentReferrals">
          <div className="authStoryCard"><span className="authStoryIcon"><Handshake size={20}/></span><span><strong>Build trusted relationships</strong><small>Connect with verified professionals.</small></span><ArrowRight size={16}/></div>
          <div className="authStoryCard"><span className="authStoryIcon violet"><Compass size={20}/></span><span><strong>Discover opportunities</strong><small>Find referrals in the markets you know.</small></span><ArrowRight size={16}/></div>
          <div className="authStoryCard"><span className="authStoryIcon mint"><LockKeyhole size={19}/></span><span><strong>Keep every handoff private</strong><small>Share the right details at the right time.</small></span><ArrowRight size={16}/></div>
        </div>
        <div className="authStoryFoot"><span className="authStoryFootMark"><ShieldCheck size={15}/></span> A professional network, built around trust.</div>
      </section>
      <section className="authPagePanel" aria-label={mode==='signup'?'Create an AgentReferrals account':mode==='reset'?'Reset your password':'Sign in to AgentReferrals'}>
        <div className="authPanelAccent" aria-hidden="true"/>
        <div className="authPanelTop"><span><span className="authPanelStatus"/> {mode==='signup'?'CREATE YOUR ACCOUNT':mode==='reset'?'ACCOUNT RECOVERY':'MEMBER ACCESS'}</span><span>AGENTREFERRALS</span></div>
        {mode==='signup'
          ? <OnboardingFlow initialMode="signup" onCancel={onCancel} onComplete={()=>onStartAuth(null)}/>
          : <AuthCard key={mode} initialMode={mode} onSwitchToOnboard={()=>onStartAuth('signup')}/>}
      </section>
    </main>
    <footer className="authPageFooter"><span>© 2026 AgentReferrals.org</span><span>Secure access for trusted connections</span></footer>
  </div>;
}
function PublicHome({ onStartAuth }){
  const [menuOpen,setMenuOpen]=useState(false);const [openFaq,setOpenFaq]=useState(0);const progressRef=useRef(null);
  const [introStage,setIntroStage]=useState('done');
  useEffect(()=>{const id=window.location.hash.slice(1);if(!['how-it-works','network-journey','marketplace','why-agentreferrals','faq'].includes(id))return;const frame=window.requestAnimationFrame(()=>{const target=document.getElementById(id);if(!target)return;const prior=document.documentElement.style.scrollBehavior;document.documentElement.style.scrollBehavior='auto';target.scrollIntoView({block:'start'});document.documentElement.style.scrollBehavior=prior});return()=>window.cancelAnimationFrame(frame)},[]);
  useEffect(()=>{if(introStage!=='show')return;const exit=window.setTimeout(()=>setIntroStage('exit'),1120);const done=window.setTimeout(()=>setIntroStage('done'),1760);return()=>{window.clearTimeout(exit);window.clearTimeout(done)}},[]);
  useEffect(()=>{if(introStage==='done')return;const prior=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=prior}},[introStage]);
  useEffect(()=>{const nodes=[...document.querySelectorAll('.reveal,.trustStrip,.quoteSection')];if(!('IntersectionObserver'in window)){nodes.forEach(n=>n.classList.add('is-visible'));return}const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target)}}),{threshold:.14,rootMargin:'0px 0px -35px 0px'});nodes.forEach(n=>observer.observe(n));return()=>observer.disconnect()},[]);
  useEffect(()=>{const section=document.querySelector('.marketSection');if(!section||!('IntersectionObserver'in window))return;const observer=new IntersectionObserver(([entry])=>section.classList.toggle('is-active',entry.isIntersecting),{threshold:.28});observer.observe(section);return()=>observer.disconnect()},[]);
  useEffect(()=>{let frame;const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-window.innerHeight;const progress=max>0?Math.min(1,window.scrollY/max):0;if(progressRef.current)progressRef.current.style.transform=`scaleX(${progress})`;const header=document.querySelector('.siteHeader');const hero=document.querySelector('.cinematicHero');if(header&&hero){const final=document.querySelector('.finalCta');const beyondHero=window.scrollY>=hero.offsetHeight-header.offsetHeight-30;const overFinal=final&&window.scrollY>=final.offsetTop-header.offsetHeight-30&&window.scrollY<final.offsetTop+final.offsetHeight;header.classList.toggle('overLight',beyondHero&&!overFinal)}if(reduceMotion)return;if(hero)hero.style.setProperty('--hero-drift',`${Math.min(window.scrollY*.1,80)}px`);for(const selector of ['.marketSection','.quoteSection']){const section=document.querySelector(selector);if(!section)continue;const rect=section.getBoundingClientRect();if(rect.bottom<0||rect.top>window.innerHeight)continue;const shift=Math.max(-42,Math.min(42,(window.innerHeight/2-rect.top-rect.height/2)*.085));section.style.setProperty('--scene-shift',`${shift}px`)}})};window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update);update();return()=>{window.removeEventListener('scroll',update);window.removeEventListener('resize',update);cancelAnimationFrame(frame)}},[]);
  const start=(mode='signup')=>{
    setMenuOpen(false);
    if(onStartAuth){
      onStartAuth(mode);
    }
  };
  const faqs=[['Who can join AgentReferrals.org?','The network is designed for real-estate professionals who want to build trusted business relationships. Members can create a profile first; referral actions are reserved for verified professionals.'],['How does a referral work?','A professional shares an opportunity with the context another agent needs, without exposing a client’s private details in the public marketplace. Interested professionals can connect through the referral workflow.'],['Is my information visible to everyone?','Your account details stay private to your account. The marketplace is designed to show opportunity information to approved members, with client identity and contact details kept out of public referral cards.'],['Does it cost anything to sign up?','Create an account to get started. Any paid membership or transaction fees will be clearly shown before they are introduced into the product.']];
  return <div className={`publicSite ${introStage==='done'?'introReady':'introPending'}`} aria-busy={introStage!=='done'}>
    {introStage!=='done'&&<div className={`siteIntro ${introStage==='exit'?'is-exiting':''}`} role="status" aria-label="Loading AgentReferrals"><div className="introAmbient"/><div className="introIdentity"><img src="/agentreferrals-mark.svg" alt=""/><span>Agent<strong>Referrals</strong></span></div><p>Real estate professionals. Together.</p><div className="introTrack"><i/></div></div>}
    <div className="scrollProgress" aria-hidden="true"><span ref={progressRef}/></div>
    <header className="siteHeader"><a className="brand" href="#home" aria-label="AgentReferrals home"><img className="brandMark" src="/agentreferrals-mark.svg" alt=""/><span>Agent<span className="blue">Referrals</span></span></a><button className="mobileMenuButton" aria-label={menuOpen?'Close navigation':'Open navigation'} onClick={()=>setMenuOpen(!menuOpen)}>{menuOpen?<X size={21}/>:<Menu size={21}/>}</button><nav className={menuOpen?'siteNav open':'siteNav'} aria-label="Main navigation"><a href="#how-it-works" onClick={()=>setMenuOpen(false)}>How it works</a><a href="#marketplace" onClick={()=>setMenuOpen(false)}>Marketplace</a><a href="#why-agentreferrals" onClick={()=>setMenuOpen(false)}>Why AgentReferrals</a><a href="#faq" onClick={()=>setMenuOpen(false)}>FAQ</a><div className="navActions"><button className="loginLink" onClick={()=>start('signin')}>Log in</button><button className="button buttonSmall buttonBlue" onClick={()=>start('signup')}>Join the network <ArrowRight size={15}/></button></div></nav></header>
    <main id="home">
      <HomeReferralHero onJoin={()=>start('signup')}/>
      <section className="trustStrip" aria-label="Platform principles"><div><span className="trustIcon"><ShieldCheck size={18}/></span><span><b>Verified by design</b><small>Professional access matters</small></span></div><div><span className="trustIcon"><LockKeyhole size={17}/></span><span><b>Privacy, built in</b><small>Client details stay protected</small></span></div><div><span className="trustIcon"><Handshake size={18}/></span><span><b>Relationships first</b><small>Every referral starts with trust</small></span></div><div className="trustLast"><span className="trustIcon"><Sparkles size={17}/></span><span><b>Simple by nature</b><small>Less friction, better follow-through</small></span></div></section>
      <section className="section howSection" id="how-it-works">
        <div className="sectionIntro reveal"><div className="eyebrow"><span/> HOW IT WORKS</div><h2>Real estate referrals,<br/><span>made simple.</span></h2><p>From a professional profile to a thoughtful handoff, every step keeps the right people and the right context connected.</p></div>
        <div className="stepsGrid">
          <article className="stepCard reveal"><div className="stepTop"><span className="stepNumber">01</span><span className="stepKicker">PROFILE</span></div><div className="stepArtwork"><span className="stepArtworkHalo"/><span className="stepArtworkCore"><UserRound size={30}/></span><i/><i/></div><h3>Create your profile</h3><p>Introduce yourself, add the markets you know, and complete professional verification.</p><div className="stepRule"/></article>
          <article className="stepCard reveal delay1"><div className="stepTop"><span className="stepNumber">02</span><span className="stepKicker">SHARE</span></div><div className="stepArtwork"><span className="stepArtworkHalo"/><span className="stepArtworkCore"><BriefcaseBusiness size={29}/></span><i/><i/></div><h3>Share an opportunity</h3><p>Post the essentials when a client needs a trusted agent in another market. Keep private details protected.</p><div className="stepRule"/></article>
          <article className="stepCard reveal delay2"><div className="stepTop"><span className="stepNumber">03</span><span className="stepKicker">DISCOVER</span></div><div className="stepArtwork"><span className="stepArtworkHalo"/><span className="stepArtworkCore"><Compass size={30}/></span><i/><i/></div><h3>Show your interest</h3><p>Approved agents can explore relevant referrals and explain how they can help.</p><div className="stepRule"/></article>
          <article className="stepCard reveal delay3"><div className="stepTop"><span className="stepNumber">04</span><span className="stepKicker">CONNECT</span></div><div className="stepArtwork"><span className="stepArtworkHalo"/><span className="stepArtworkCore"><Handshake size={30}/></span><i/><i/></div><h3>Choose and connect</h3><p>Review interested professionals, select the right fit, and keep the introduction moving.</p><div className="stepRule"/></article>
        </div>
      </section>
      <ConnectionJourney/>
      <section className="section whySection" id="why-agentreferrals"><div className="whyIntro reveal"><div className="eyebrow"><span/> WHY AGENTREFERRALS</div><h2>Good referrals start<br/>with <span>good relationships.</span></h2><p>We’re building a professional network where the human side of the handoff matters as much as the opportunity itself.</p><button className="textAction" onClick={()=>start('signup')}>Find your people <ArrowRight size={15}/></button></div><div className="benefitGrid"><article className="benefitCard reveal"><div className="benefitIcon"><ShieldCheck size={20}/></div><h3>Trust you can see</h3><p>Professional verification gives members more confidence in who they’re working with.</p><div className="benefitMeta"><span>01</span><i/></div></article><article className="benefitCard reveal delay1"><div className="benefitIcon blueIcon"><LockKeyhole size={19}/></div><h3>Privacy by default</h3><p>Keep sensitive client details private while sharing enough to start a real conversation.</p><div className="benefitMeta"><span>02</span><i/></div></article><article className="benefitCard reveal delay2"><div className="benefitIcon violetIcon"><Compass size={20}/></div><h3>Built for real work</h3><p>Organize opportunities around the people, markets, and follow-through that move business.</p><div className="benefitMeta"><span>03</span><i/></div></article></div></section>
      <section className="quoteSection"><div className="quoteMark">“</div><div className="quoteText reveal"><p>The best business still happens person to person. We’re giving those introductions a place to go.</p><div className="quoteBy"><span className="quoteAvatar"><img src="/agentreferrals-mark.svg" alt=""/></span><span><b>AgentReferrals</b><small>Made for trusted introductions</small></span></div></div><div className="quoteGlow"/></section>
      <section className="section faqSection" id="faq"><div className="faqIntro reveal"><div className="eyebrow"><span/> A FEW GOOD QUESTIONS</div><h2>Good to <span>know.</span></h2><p>Have another question? Start with the answers below.</p><a href="#faq" className="textAction">Browse member questions <ArrowRight size={15}/></a></div><div className="faqList reveal delay1">{faqs.map(([q,a],i)=><article className={openFaq===i?'faqItem active':'faqItem'} key={q}><button aria-expanded={openFaq===i} onClick={()=>setOpenFaq(openFaq===i?-1:i)}><span className="faqIndex">0{i+1}</span><b>{q}</b><span className="faqToggle"><ChevronDown size={17}/></span></button><div className="faqAnswer"><p>{a}</p></div></article>)}</div></section>
      <section className="finalCta"><div className="ctaGlow"/><div className="ctaInner reveal"><div className="ctaSparkle"><Sparkles size={16}/></div><div className="eyebrow light"><span/> YOUR NEXT CONNECTION STARTS HERE</div><h2>Let’s make the<br/><em>introduction.</em></h2><p>Join professionals building better business through better relationships.</p><button className="button buttonWhite buttonLarge" onClick={()=>start('signup')}>Join the network <ArrowRight size={17}/></button><small><LockKeyhole size={13}/> Secure sign-in with email, Google, or phone</small></div><div className="ctaOrb ctaOrbA"/><div className="ctaOrb ctaOrbB"/></section>
    </main><footer className="siteFooter"><div className="footerTop"><div className="footerBrand"><a className="brand" href="#home"><img className="brandLockup" src="/agentreferrals-logo.svg" alt="AgentReferrals — Real estate professionals. Together."/></a><p>Better connections.<br/>Better business.</p></div><div className="footerLinks"><div><b>Explore</b><a href="#how-it-works">How it works</a><a href="#marketplace">Marketplace</a><a href="#why-agentreferrals">Why AgentReferrals</a></div><div><b>Resources</b><a href="#faq">Frequently asked questions</a><a href="#faq">Privacy questions</a></div><div><b>Get started</b><button onClick={()=>start('signin')}>Log in</button><button onClick={()=>start('signup')}>Join the network</button></div></div></div><div className="footerBottom"><span>© 2026 AgentReferrals.org. All rights reserved.</span><span>Built for trusted introductions <span className="footerDot">✦</span></span><div><a href="#faq">Privacy questions</a></div></div></footer>
  </div>
}
export default function App() {
  const [user, setUser] = useState(undefined);
  const [, setAuthRevision] = useState(0);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [connectionError, setConnectionError] = useState('');

  useEffect(() => {
    const invitedBy = new URLSearchParams(window.location.search).get('ref');
    if (invitedBy && /^[A-Za-z0-9_-]{1,128}$/.test(invitedBy)) sessionStorage.setItem('agentreferrals_invited_by', invitedBy);
  }, []);
  
  const getInitialAuthMode = () => {
    const p = window.location.pathname;
    if (p === '/login' || p === '/signin') return 'signin';
    if (p === '/register' || p === '/signup' || p === '/get-started' || p === '/onboarding') return 'signup';
    if (p === '/reset-password') return 'reset';
    return null;
  };

  const [authMode, setAuthMode] = useState(getInitialAuthMode);
  const [forceEditProfile, setForceEditProfile] = useState(false);

  useEffect(() => {
    const syncAuthRoute = () => setAuthMode(getInitialAuthMode());
    window.addEventListener('popstate', syncAuthRoute);
    return () => window.removeEventListener('popstate', syncAuthRoute);
  }, []);

  useEffect(() => {
    if (!auth) return;
    let unsubProfile = () => {};
    const unsubAuth = onAuthStateChanged(auth, async current => {
      unsubProfile();
      if (current) {
        try {
          await reload(current);
          await current.getIdToken(true);
        } catch (error) {
          setConnectionError(translateAuthError(error));
        }
      }
      setUser(current);
      setRole(null);
      setProfile(null);
      setConnectionError('');

      if (current && db) {
        try {
          const token = await current.getIdTokenResult(true);
          const ref = doc(db, 'users', current.uid);
          const snap = await getDoc(ref);

          const isSuperAdminEmail = current.email?.toLowerCase() === 'support@agentreferrals.org';
          let resolvedRole =
            isSuperAdminEmail
              ? PLATFORM_ROLES.SUPER_ADMIN
              : (token.claims?.platformRole ||
                 snap.data()?.role ||
                 PLATFORM_ROLES.PROFESSIONAL);

          setRole(resolvedRole);

          if (!snap.exists() && resolvedRole === PLATFORM_ROLES.PROFESSIONAL) {
            const invitedBy = sessionStorage.getItem('agentreferrals_invited_by') || '';
            const seed = {
              uid: current.uid,
              displayName: current.displayName || 'New professional',
              email: current.email || null,
              phoneNumber: current.phoneNumber || null,
              role: PLATFORM_ROLES.PROFESSIONAL,
              accountStatus: 'PENDING',
              emailVerified: current.emailVerified === true,
              onboardingStatus: 'NOT_STARTED',
              currentOnboardingStep: 0,
              onboardingCompleted: false,
              completedSteps: [],
              profileCompletion: 0,
              ...(invitedBy && invitedBy !== current.uid ? { referredByProfessionalId: invitedBy } : {}),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            await setDoc(ref, seed, { merge: true });
            sessionStorage.removeItem('agentreferrals_invited_by');
          }

          unsubProfile = onSnapshot(
            ref,
            snapshot => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                if (isSuperAdminEmail) {
                  data.role = PLATFORM_ROLES.SUPER_ADMIN;
                  data.platformRole = PLATFORM_ROLES.SUPER_ADMIN;
                }
                setProfile(data);
              } else {
                setProfile(null);
              }
            },
            error => setConnectionError(translateAuthError(error))
          );
        } catch (error) {
          setConnectionError(translateAuthError(error));
        }
      }
    });

    return () => {
      unsubAuth();
      unsubProfile();
    };
  }, []);

  const publicAgentMatch = typeof window !== 'undefined' ? window.location.pathname.match(/^\/agent\/([A-Za-z0-9_-]{1,128})\/?$/) : null;
  if (publicAgentMatch) return <PublicAgentCard uid={publicAgentMatch[1]} />;

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      setAuthMode(null);
      setForceEditProfile(false);
      window.history.replaceState({}, '', '/');
    }
  };

  const openAuth = (mode) => {
    setAuthMode(mode);
    if (mode) window.history.pushState({}, '', mode === 'signin' ? '/login' : mode === 'reset' ? '/reset-password' : '/register');
  };

  // Preview user portal check for visual inspection & testing
  if (typeof window !== 'undefined' && (window.location.search.includes('preview=portal') || window.location.search.includes('preview=user'))) {
    return (
      <ProfessionalPanel
        user={{
          uid: 'demo-user-123',
          email: 'rozer.ramon@agentreferrals.org',
          displayName: 'Rozer Ramon'
        }}
        profile={{
          displayName: 'Rozer Ramon',
          brokerageName: 'Premier Realty Group',
          licenseNumber: 'TX-984210',
          role: 'PROFESSIONAL',
          verificationStatus: 'approved'
        }}
        connectionError={null}
        onLogout={() => { window.location.href = '/'; }}
      />
    );
  }

  // Preview super admin portal check for visual inspection & testing
  if (typeof window !== 'undefined' && (window.location.search.includes('preview=admin') || window.location.search.includes('preview=superadmin') || window.location.search.includes('preview=fernly'))) {
    return (
      <FernlySuperAdmin
        user={{
          uid: 'superadmin-demo-123',
          email: 'support@agentreferrals.org',
          displayName: 'Super Admin',
          emailVerified: true
        }}
        role={PLATFORM_ROLES.SUPER_ADMIN}
        profile={{
          displayName: 'Super Admin',
          role: PLATFORM_ROLES.SUPER_ADMIN,
          platformRole: PLATFORM_ROLES.SUPER_ADMIN,
          email: 'support@agentreferrals.org'
        }}
        onLogout={() => { window.location.href = '/'; }}
      />
    );
  }

  // Preview loader check for testing & visual inspection
  const legalPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  if (legalPath === '/terms' || legalPath === '/terms-of-service') return <LegalDocument type="terms" />;
  if (legalPath === '/privacy' || legalPath === '/privacy-policy') return <LegalDocument type="privacy" />;

  if (typeof window !== 'undefined' && window.location.search.includes('preview=loader')) {
    return (
      <PlatformLoader
        title="Authenticating Session"
        subtitle="Resolving account permissions and workspace…"
      />
    );
  }

  // Initial Auth Check Loading
  if (user === undefined) {
    return <PlatformLoader title="AgentReferrals" subtitle="Connecting to secure workspace…" />;
  }

  // If unauthenticated and in Auth flow (Sign in, Sign up / Onboarding, Password reset)
  if (!user && authMode) {
    return <AuthPage mode={authMode} onStartAuth={openAuth} onCancel={() => {
      setAuthMode(null);
      window.history.pushState({}, '', '/');
    }}/>;
  }

  if (user) {
    if (!role) {
      return (
        <PlatformLoader
          title="Authenticating Session"
          subtitle="Resolving account permissions and workspace…"
        />
      );
    }

    const isAdmin = role === PLATFORM_ROLES.ADMIN || role === PLATFORM_ROLES.SUPER_ADMIN;
    const adminPath = window.location.pathname.startsWith('/admin');

    // Keep the existing admin OTP gate; professionals use Firebase's real
    // email-verification action link before their profile onboarding.
    if (isAdmin && user.emailVerified !== true) {
      return <VerifyEmailPage user={user} onLogout={handleLogout} onVerified={() => setAuthRevision(value => value + 1)} />;
    }
    if (isProfessionalRole(role) && user.emailVerified !== true) return <VerifyEmailLinkPage user={user} onLogout={handleLogout} onVerified={() => setAuthRevision(value => value + 1)} />;

    // Smooth Automatic Routing:
    // If a regular professional is on an /admin URL, cleanly redirect them to /dashboard
    if (adminPath && !isAdmin) {
      window.history.replaceState({}, '', '/dashboard');
    }

    // Admin and Super Admin shell
    if (isAdmin) {
      if (!adminPath || window.location.pathname === '/dashboard') {
        window.history.replaceState({}, '', '/admin/dashboard');
      }
      return <FernlySuperAdmin user={user} role={role} profile={profile} onLogout={handleLogout} />;
    }

    // New professionals finish their profile first. Existing verification
    // submissions continue through the established review status page.
    const alreadyApproved = profile?.verificationStatus === 'approved';
    const hasSubmittedVerification = Boolean(profile?.verificationSubmittedAt || profile?.onboardingStatus === 'SUBMITTED' || profile?.onboardingStatus === 'RESUBMITTED');
    if (!alreadyApproved && !hasSubmittedVerification && profile?.onboardingCompleted !== true) {
      if (window.location.pathname === '/verify-email') window.history.replaceState({}, '', '/onboarding');
      return <ProfessionalOnboarding initialMode="onboarding" initialProfile={profile} onCancel={handleLogout} onComplete={() => { setForceEditProfile(false); setAuthMode(null); setAuthRevision(value => value + 1); }} />;
    }
    if (forceEditProfile && !alreadyApproved && hasSubmittedVerification) {
      return (
        <OnboardingFlow
          initialMode="signup"
          initialStep={3}
          initialEmail={user.email || ''}
          initialProfile={profile}
          onCancel={() => {
            if (forceEditProfile) setForceEditProfile(false);
            else handleLogout();
          }}
          onComplete={() => {
            setForceEditProfile(false);
            setAuthMode(null);
          }}
        />
      );
    }

    // This existing page remains the next product stage after onboarding.
    const isApproved = profile?.verificationStatus === 'approved';
    if (!isApproved) {
      return (
        <VerificationPendingGate
          user={user}
          profile={profile}
          onLogout={handleLogout}
          onEditProfile={() => setForceEditProfile(true)}
        />
      );
    }

    // 3. Fully Verified Professional Dashboard
    return (
      <ProfessionalPanel
        user={user}
        profile={profile}
        connectionError={connectionError}
        onLogout={handleLogout}
      />
    );
  }

  const adminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
  if (adminPath && !user) {
    return <AuthPage mode="signin" onStartAuth={openAuth} onCancel={() => {
      setAuthMode(null);
      window.history.pushState({}, '', '/');
    }} />;
  }

  return (
    <PublicHome
      onStartAuth={(mode) => openAuth(mode || 'signup')}
    />
  );
}





