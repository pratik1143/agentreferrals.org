import { useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Clock3, FileCheck2, LogOut, MailCheck, RefreshCw, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { reload } from 'firebase/auth';

const LABELS = {
  EMAIL: 'Email verification', IDENTITY: 'Identity information', LICENSE: 'Real estate license',
  BROKERAGE: 'Brokerage information', GOVERNMENT_ID: 'Government ID', LICENSE_DOCUMENT: 'License document',
  BROKERAGE_DOCUMENT: 'Brokerage document', PROOF_OF_ADDRESS: 'Proof of address', BACKGROUND_CHECK: 'Background check',
  COMPLIANCE: 'Compliance declarations', CONSENTS: 'Terms and consent', LICENSE_EXPIRATION: 'License expiration', BROKER_LICENSE: 'Responsible broker license',
};
const statusLabel = value => ({ VERIFIED: 'Verified', NOT_REQUIRED: 'Not required', PENDING: 'Waiting for review', CHANGES_REQUESTED: 'Changes requested', REJECTED: 'Not approved' }[value] || 'Waiting for review');
const statusIcon = value => value === 'VERIFIED' || value === 'NOT_REQUIRED' ? CheckCircle2 : value === 'CHANGES_REQUESTED' ? AlertCircle : value === 'REJECTED' ? XCircle : Clock3;

export default function VerificationPendingGate({ user, profile, onLogout, onEditProfile }) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const status = String(profile?.verificationStatus || 'pending').toLowerCase();
  const items = Object.entries(profile?.verificationItems || {});
  const policyMissing = profile?.verificationPolicyConfigurationRequired === true;
  const canEdit = ['requires_changes', 'rejected'].includes(status);
  const doneCount = items.filter(([, item]) => item?.required && ['VERIFIED', 'NOT_REQUIRED'].includes(item?.status)).length;
  const requiredCount = items.filter(([, item]) => item?.required).length;
  const progress = requiredCount ? Math.min(100, Math.round(doneCount / requiredCount * 100)) : 0;

  const handleRefresh = async () => {
    setChecking(true); setError('');
    try { if (user) await reload(user); }
    catch (e) { setError(e?.message || 'Could not refresh your account. Try reloading the page.'); }
    finally { setChecking(false); }
  };

  const hasVerificationSubmission = Boolean(profile?.verificationSubmittedAt || ['SUBMITTED', 'RESUBMITTED'].includes(profile?.onboardingStatus));
  if (!hasVerificationSubmission) return <main className="verificationGate">
    <section className="verificationGateCard">
      <header className="verificationGateHeader"><span className="verificationGateIcon"><CheckCircle2 size={22}/></span><span><small>PROFILE SETUP</small><h1>Your profile is ready</h1></span><button onClick={onLogout} className="verificationGateSignout"><LogOut size={15}/> Sign out</button></header>
      <p className="verificationGateLead">Your professional profile is saved. Professional credential verification is a separate next step before access to the verified marketplace.</p>
      <div className="verificationGateNotice inReview" role="status"><ShieldCheck size={18}/><span><b>No verification review has been submitted.</b><small>Your profile setup is complete. Verification requirements and submission are handled in the next stage.</small></span></div>
      <section className="verificationGateProfile"><div className="verificationGateSectionTitle"><span><UserRound size={16}/></span><div><b>{profile?.displayName || user?.displayName || 'Professional profile'}</b><small>{profile?.email || user?.email}</small></div></div><div className="verificationGateFacts"><span><MailCheck size={15}/><small>Email</small><b>{user?.emailVerified ? 'Verified' : 'Needs verification'}</b></span><span><Building2 size={15}/><small>Brokerage</small><b>{profile?.brokerageName || 'Independent / not provided'}</b></span><span><CheckCircle2 size={15}/><small>Profile</small><b>{profile?.profileCompletion ?? 0}% complete</b></span></div></section>
      <footer className="verificationGateActions"><button className="verificationGateRefresh" onClick={handleRefresh} disabled={checking}><RefreshCw size={15} className={checking ? 'gateSpin' : ''}/>{checking ? 'Refreshing…' : 'Refresh account'}</button></footer>
    </section>
  </main>;

  return <main className="verificationGate">
    <section className="verificationGateCard">
      <header className="verificationGateHeader"><span className="verificationGateIcon"><ShieldCheck size={22}/></span><span><small>PROFESSIONAL VERIFICATION</small><h1>{canEdit ? 'Action needed on your application' : 'Your verification progress'}</h1></span><button onClick={onLogout} className="verificationGateSignout"><LogOut size={15}/> Sign out</button></header>
      <p className="verificationGateLead">Your marketplace access unlocks after all required professional checks are approved.</p>
      <div className={`verificationGateNotice ${canEdit ? 'needsAction' : policyMissing ? 'policyMissing' : 'inReview'}`} role="status">
        {canEdit ? <AlertCircle size={18}/> : policyMissing ? <AlertCircle size={18}/> : <Clock3 size={18}/>}
        <span><b>{canEdit ? 'Please review the requested changes' : policyMissing ? 'Jurisdiction policy setup is in progress' : status === 'approved' ? 'Your verification is approved' : 'Your application is being reviewed'}</b>
          <small>{canEdit ? profile?.verificationReason || 'Update the items marked below, then resubmit.' : policyMissing ? 'An administrator needs to configure the policy for your licensing state before the review can continue.' : 'This page updates automatically when an administrator reviews your application.'}</small></span>
      </div>
      <section className="verificationGateProgress"><div><span><b>Review progress</b><small>{doneCount} of {requiredCount || items.length} checks complete</small></span><strong>{progress}%</strong></div><div className="verificationGateTrack"><i style={{width: `${progress}%`}}/></div></section>
      <section className="verificationGateProfile"><div className="verificationGateSectionTitle"><span><UserRound size={16}/></span><div><b>{profile?.displayName || user?.displayName || 'Professional profile'}</b><small>{profile?.email || user?.email}</small></div></div>
        <div className="verificationGateFacts"><span><FileCheck2 size={15}/><small>License</small><b>{profile?.licenseNumber || 'Not submitted'}{profile?.licenseState ? ` · ${profile.licenseState}` : ''}</b></span><span><Building2 size={15}/><small>Brokerage</small><b>{profile?.brokerageName || 'Independent / not provided'}</b></span><span><MailCheck size={15}/><small>Email</small><b>{user?.emailVerified ? 'Verified' : 'Needs verification'}</b></span></div>
      </section>
      <section className="verificationGateChecks"><div className="verificationGateSectionTitle"><span><CheckCircle2 size={16}/></span><div><b>Verification checklist</b><small>Required documents depend on your state policy. Government ID is requested only when required.</small></div></div>
        {items.length ? <ul>{items.map(([id, item]) => { const Icon = statusIcon(item?.status); return <li key={id} className={`gateItem ${String(item?.status || '').toLowerCase()}`}><Icon size={16}/><span><b>{LABELS[id] || item?.label || id.replaceAll('_', ' ')}</b>{item?.required && <small>Required</small>}{item?.reason && <em>{item.reason}</em>}</span><strong>{statusLabel(item?.status)}</strong></li>; })}</ul> : <div className="verificationGateEmpty"><Clock3 size={17}/> Your submitted checks will appear here.</div>}
      </section>
      <footer className="verificationGateActions"><button className="verificationGateRefresh" onClick={handleRefresh} disabled={checking}><RefreshCw size={15} className={checking ? 'gateSpin' : ''}/>{checking ? 'Refreshing…' : 'Refresh status'}</button>{canEdit && <button className="verificationGateEdit" onClick={onEditProfile}>Edit and resubmit</button>}</footer>
      {error && <p className="verificationGateError" role="alert">{error}</p>}
      <p className="verificationGatePrivacy"><ShieldCheck size={14}/> Sensitive documents are private and visible only to you and authorized reviewers. We do not request SSNs.</p>
    </section>
  </main>;
}
