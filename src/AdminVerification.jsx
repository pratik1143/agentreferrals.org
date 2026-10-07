import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, Clock3, Copy, Download, Eye, FileCheck2, FileText, FilterX, Globe, Handshake, Mail, MapPin, Phone, Quote, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, X, XCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { getBlob, ref as storageRef } from 'firebase/storage';
import { collection, getDocsFromServer, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db, functions, storage } from './firebase';
import './admin-verification.css';
import VerificationReferrals from './VerificationReferrals';

const statusOf = user => {
  const value = String(user.professionalVerificationStatus || user.verificationStatus || '').toLowerCase();
  if (value === 'pending_review' || value === 'submitted') return 'pending';
  return value || 'not_submitted';
};
const labels = { all: 'All submissions', pending: 'Awaiting review', approved: 'Approved', requires_changes: 'Changes requested', rejected: 'Rejected' };
const dateOf = user => {
  const value = user.verificationSubmittedAt || user.createdAt;
  const date = value && typeof value.toDate === 'function' ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const formatDate = value => {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
};
const nameOf = user => user.displayName || user.email && user.email.split('@')[0] || 'Unnamed professional';
const titleCase = value => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const documentsOf = user => Array.isArray(user.verificationDocuments) ? user.verificationDocuments : Array.isArray(user.documents) ? user.documents : [];
const parseList = val => {
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean);
  return [];
};

const POLICY_REQUIREMENT_FIELDS = [
  ['governmentIdRequired', 'Government ID'], ['licenseDocumentRequired', 'License document'],
  ['brokerageDocumentRequired', 'Brokerage proof'], ['proofOfAddressRequired', 'Proof of address'],
  ['backgroundCheckRequired', 'Background check'], ['licenseExpirationRequired', 'License expiration date'],
  ['brokerLicenseRequired', 'Responsible broker license number'],
];
const verificationItemLabel = item => item?.label || 'Verification item';

export default function AdminVerification({ users = [], activity = [], onOpen, role }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('all');
  const [brokerage, setBrokerage] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [reviewReason, setReviewReason] = useState({});
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [brokerSourceName, setBrokerSourceName] = useState('');
  const [brokerSourceUrl, setBrokerSourceUrl] = useState('');
  const [brokerSourceReference, setBrokerSourceReference] = useState('');
  const [reviewingId, setReviewingId] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [documentBusy, setDocumentBusy] = useState('');
  const [documentMessage, setDocumentMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshedUsers, setRefreshedUsers] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');
  const copyText = (key, text) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(k => k === key ? '' : k), 2000);
    } catch {}
  };
  const [accountEvents, setAccountEvents] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const [activityPending, setActivityPending] = useState({});
  useEffect(() => { setRefreshedUsers(null); }, [users]);
  const [submissionRejectReason, setSubmissionRejectReason] = useState('');
  const [rejectingSubmission, setRejectingSubmission] = useState(false);
  const [policyStateCode, setPolicyStateCode] = useState('');
  const [policyVersion, setPolicyVersion] = useState('');
  const [policySourceName, setPolicySourceName] = useState('');
  const [policySourceUrl, setPolicySourceUrl] = useState('');
  const [policyRequirements, setPolicyRequirements] = useState(Object.fromEntries(POLICY_REQUIREMENT_FIELDS.map(([key]) => [key, false])));
  const [policyBusy, setPolicyBusy] = useState(false);
  const [policyMessage, setPolicyMessage] = useState('');
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const submissions = useMemo(() => (refreshedUsers || users).filter(user => statusOf(user) !== 'not_submitted'), [users, refreshedUsers]);
  const counts = useMemo(() => Object.fromEntries(Object.keys(labels).map(key => [key, key === 'all' ? submissions.length : submissions.filter(user => statusOf(user) === key).length])), [submissions]);
  const regions = useMemo(() => [...new Set(submissions.map(user => user.licenseState).filter(Boolean))].sort(), [submissions]);
  const brokerages = useMemo(() => [...new Set(submissions.map(user => user.brokerageName).filter(Boolean))].sort(), [submissions]);
  const matches = useMemo(() => submissions.filter(user =>
    (filter === 'all' || statusOf(user) === filter) &&
    (region === 'all' || user.licenseState === region) &&
    (brokerage === 'all' || user.brokerageName === brokerage) &&
    [user.displayName, user.email, user.licenseNumber, user.brokerageName, user.licenseState].join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ).sort((a, b) => {
    if (sort === 'name') return nameOf(a).localeCompare(nameOf(b));
    const aTime = dateOf(a) ? dateOf(a).getTime() : 0;
    const bTime = dateOf(b) ? dateOf(b).getTime() : 0;
    return sort === 'oldest' ? aTime - bTime : bTime - aTime;
  }), [submissions, filter, region, brokerage, search, sort]);
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = matches.slice((currentPage - 1) * 10, currentPage * 10);
  const selected = (refreshedUsers || users).find(user => user.id === selectedId) || null;
  useEffect(() => {
    setReviewReason({}); setReviewMessage(''); setDocumentMessage(''); setSubmissionRejectReason('');
    setSourceName(''); setSourceUrl(''); setSourceReference('');
    setBrokerSourceName(''); setBrokerSourceUrl(''); setBrokerSourceReference('');
  }, [selectedId]);
  useEffect(() => {
    setAccountEvents({}); setActivityErrors({}); setActivityPending({});
    if (!selectedId || !db) return;
    const sources = [['activity', 'userId'], ['activity', 'targetUserId'], ['activity', 'entityId'], ['audit_logs', 'targetId']];
    setActivityPending(Object.fromEntries(sources.map(([name, field]) => [name + field, true])));
    const stops = sources.map(([name, field]) => {
      const key = name + field;
      return onSnapshot(query(collection(db, name), where(field, '==', selectedId)), snapshot => {
        setAccountEvents(current => ({ ...current, [key]: snapshot.docs.map(doc => ({ ...doc.data(), id: name + '/' + doc.id })) }));
        setActivityPending(current => ({ ...current, [key]: false }));
        setActivityErrors(current => ({ ...current, [key]: '' }));
      }, error => {
        setActivityPending(current => ({ ...current, [key]: false }));
        setActivityErrors(current => ({ ...current, [key]: error.message || 'Activity could not be loaded.' }));
      });
    });
    return () => stops.forEach(stop => stop());
  }, [selectedId]);
  useEffect(() => { if (selectedId) window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [selectedId]);
  const selectedActivity = selected ? [...new Map([...activity.filter(item => item.entityId === selected.id || item.userId === selected.id || item.targetUserId === selected.id || item.targetId === selected.id), ...Object.values(accountEvents).flat()].map(item => [item.id, item])).values()].sort((a, b) => {
    const time = value => value && typeof value.toDate === 'function' ? value.toDate().getTime() : new Date(value || 0).getTime();
    return time(b.createdAt) - time(a.createdAt);
  }) : [];
  const refreshSubmissions = async () => {
    if (!db || refreshing) return;
    setRefreshing(true); setRefreshMessage('');
    try {
      const snapshot = await getDocsFromServer(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100)));
      setRefreshedUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      setRefreshMessage('Submissions updated.');
    } catch (error) { setRefreshMessage(error.message || 'Could not refresh submissions. Please retry.'); }
    finally { setRefreshing(false); }
  };
  const cards = [
    { key: 'all', label: 'Total submissions', note: 'Credentials submitted for review', icon: FileCheck2, tone: 'blue' },
    { key: 'pending', label: 'Awaiting review', note: 'Need your attention', icon: Clock3, tone: 'amber' },
    { key: 'approved', label: 'Approved', note: 'Credentials verified', icon: CheckCircle2, tone: 'green' },
    { key: 'requires_changes', label: 'Changes requested', note: 'Waiting for resubmission', icon: RefreshCw, tone: 'orange' },
    { key: 'rejected', label: 'Rejected', note: 'Did not meet requirements', icon: XCircle, tone: 'red' }
  ];
  const chooseFilter = value => { setFilter(value); setPage(1); };
  const resetFilters = () => { setFilter('all'); setRegion('all'); setBrokerage('all'); setSearch(''); setSort('newest'); setPage(1); };
  const exportCsv = () => {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, match => "'" + match).replaceAll('"', '""') + '"';
    const rows = [['Professional', 'Email', 'License number', 'Region', 'Brokerage', 'Submitted', 'Verification status'], ...matches.map(user => [nameOf(user), user.email, user.licenseNumber, user.licenseState, user.brokerageName, formatDate(user.verificationSubmittedAt || user.createdAt), statusOf(user)])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'agentreferrals-verification.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const performReview = async (itemId, decision) => {
    if (!selected || reviewingId || rejectingSubmission) return;
    if (!functions) { setReviewMessage('Verification service is unavailable. Please reload and retry.'); return; }
    const itemReason = reviewReason[itemId] || '';
    const reviewSourceName = itemId === 'BROKERAGE' ? brokerSourceName || selected.verificationItems?.BROKERAGE?.verificationSource?.sourceName || '' : sourceName || selected.verificationSource?.sourceName || '';
    const reviewSourceUrl = itemId === 'BROKERAGE' ? brokerSourceUrl || selected.verificationItems?.BROKERAGE?.verificationSource?.sourceUrl || '' : sourceUrl || selected.verificationSource?.sourceUrl || '';
    const reviewSourceReference = itemId === 'BROKERAGE' ? brokerSourceReference : sourceReference;
    if (decision !== 'VERIFY' && !itemReason.trim()) { setReviewMessage('Enter a reason for requesting changes or rejecting this item.'); return; }
    if (decision === 'VERIFY' && ['LICENSE', 'BROKERAGE'].includes(itemId) && (!reviewSourceName.trim() || !reviewSourceUrl.startsWith('https://'))) { setReviewMessage('Record the verification source name and HTTPS URL before verifying this item.'); return; }
    setReviewingId(itemId); setReviewMessage('');
    try {
      const result = await httpsCallable(functions, 'reviewProfessionalVerificationItem')({
        userId: selected.id, itemId, decision, reason: itemReason.trim(),
        sourceName: reviewSourceName.trim(), sourceUrl: reviewSourceUrl.trim(), sourceReference: reviewSourceReference.trim(),
      });
      setReviewMessage(`${verificationItemLabel(selected.verificationItems?.[itemId])}: ${String(result.data.itemStatus).toLowerCase().replaceAll('_', ' ')}. Overall status: ${String(result.data.status).toLowerCase().replaceAll('_', ' ')}.`);
      setReviewReason({});
    } catch (error) {
      setReviewMessage(error?.message || 'The review decision could not be saved. Try again.');
    } finally { setReviewingId(''); }
  };
  const rejectSubmission = async () => {
    if (!selected || !submissionRejectReason.trim() || reviewingId || rejectingSubmission) return;
    if (!functions) { setReviewMessage('Verification service is unavailable. Please reload and retry.'); return; }
    setRejectingSubmission(true); setReviewMessage('');
    try {
      await httpsCallable(functions, 'rejectProfessionalVerificationSubmission')({ userId: selected.id, reason: submissionRejectReason.trim() });
      setReviewMessage('Application rejected. The professional has been notified and must complete the full verification process again.');
      setSubmissionRejectReason('');
    } catch (error) { setReviewMessage(error?.message || 'The application could not be rejected. Try again.'); }
    finally { setRejectingSubmission(false); }
  };
  const downloadPrivateDocument = async document => {
    if (documentBusy) return;
    setDocumentMessage('');
    if (!storage || !document?.storagePath) { setDocumentMessage('This document has no accessible storage file. Ask the professional to upload it again.'); return; }
    setDocumentBusy(document.storagePath);
    try {
      const blob = await getBlob(storageRef(storage, document.storagePath));
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a'); link.href = url; link.download = document.fileName || document.name || 'verification-document'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setDocumentMessage('Document downloaded.');
    } catch (error) { setDocumentMessage(error?.message || 'This private document could not be downloaded. Please retry.'); }
    finally { setDocumentBusy(''); }
  };
  const publishPolicy = async event => {
    event.preventDefault();
    const stateCode = policyStateCode.trim().toUpperCase();
    const version = policyVersion.trim();
    const sourceName = policySourceName.trim();
    const sourceUrl = policySourceUrl.trim();
    let parsedUrl;
    try { parsedUrl = new URL(sourceUrl); } catch { parsedUrl = null; }
    if (!/^[A-Z]{2}$/.test(stateCode)) { setPolicyMessage('Enter a valid two-letter state code.'); return; }
    if (version.length < 1 || version.length > 40) { setPolicyMessage('Policy version must be between 1 and 40 characters.'); return; }
    if (sourceName.length < 3 || sourceName.length > 120) { setPolicyMessage('Regulator name must be between 3 and 120 characters.'); return; }
    if (!parsedUrl || parsedUrl.protocol !== 'https:' || parsedUrl.hostname.length < 4) { setPolicyMessage('Enter a valid official HTTPS regulator URL.'); return; }
    setPolicyBusy(true); setPolicyMessage('');
    try {
      await httpsCallable(functions, 'saveVerificationPolicy')({
        stateCode, version,
        sourceName, sourceUrl, requirements: policyRequirements,
      });
      setPolicyMessage(`Policy ${version} published for ${stateCode}.`);
    } catch (error) { setPolicyMessage(error?.message || 'The policy could not be saved.'); }
    finally { setPolicyBusy(false); }
  };

  return <div className="verificationWorkspace verificationWorkspaceV2">
    <div className="verificationBreadcrumb"><span>Admin</span><ChevronRight size={13}/><b>Verification</b></div>
    <header className="verificationIntro">
      <div><span className="verificationEyebrow">TRUST &amp; SAFETY</span><h1>Verification Center<span>.</span></h1><p>Review professional credentials and supporting documents. Ensure a trusted and compliant network.</p></div>
      <div className="verificationPromise"><span><ShieldCheck size={22}/></span><div><b>Professional credentials</b><small>Build trust. Grow the network.</small></div></div>
    </header>

    <section className="verificationStats" aria-label="Verification submission counts">
      {cards.map(({ key, label, note, icon: Icon, tone }) => <button key={key} className={'verificationStat ' + tone + (filter === key ? ' active' : '')} onClick={() => chooseFilter(key)} aria-pressed={filter === key}>
        <span className="verificationStatIcon"><Icon size={18}/></span><span className="verificationStatText"><small>{label}</small><strong>{counts[key]}</strong><em>{note}</em></span><ArrowRight className="verificationStatArrow" size={15}/>
      </button>)}
    </section>

    {isSuperAdmin && <details className="verificationPolicyManager">
      <summary><span className="verificationPolicySummaryIcon"><ShieldCheck size={18}/></span><span><b>State verification policy setup</b><small>Only open this when adding or updating a jurisdiction policy.</small></span><ChevronDown size={16}/></summary>
      <div className="verificationPolicyContent">
        <div className="verificationPolicyIntro"><span className="verificationEyebrow">SUPER ADMIN SETUP</span><h2>Configure a state’s review checklist</h2><p>Use the official licensing regulator’s website and only select checks required by your approved policy. Professionals in a state without a published policy cannot be approved.</p>
          <ol><li>Enter the two-letter state code, policy version and official regulator link.</li><li>Check only the additional documents or details that policy requires.</li><li>Publish. Then open a submission below and review each checklist item.</li></ol>
          <div className="verificationPolicyPrivacy"><ShieldCheck size={15}/> Leave Government ID unchecked unless the policy specifically requires it. SSNs are never collected.</div>
        </div>
        <form className="verificationPolicyForm" onSubmit={publishPolicy}>
          <div className="verificationPolicyFields">
            <label>State code <small>Example: FL</small><input required maxLength={2} pattern="[A-Za-z]{2}" placeholder="FL" value={policyStateCode} onChange={event => setPolicyStateCode(event.target.value.toUpperCase())}/></label>
            <label>Policy version <small>Use the version/date you reviewed</small><input required placeholder="2026.1" value={policyVersion} onChange={event => setPolicyVersion(event.target.value)}/></label>
            <label>Official regulator name<input required placeholder="State licensing regulator" value={policySourceName} onChange={event => setPolicySourceName(event.target.value)}/></label>
            <label>Official regulator HTTPS link<input required type="url" pattern="https://.*" placeholder="https://official-state-site.gov/…" value={policySourceUrl} onChange={event => setPolicySourceUrl(event.target.value)}/></label>
          </div>
          <fieldset><legend>Extra requirements from this policy</legend><p>These are added to the standard identity, license, brokerage, declarations and consent review.</p><div>{POLICY_REQUIREMENT_FIELDS.map(([key, label]) => <label key={key}><input type="checkbox" checked={policyRequirements[key]} onChange={event => setPolicyRequirements(current => ({ ...current, [key]: event.target.checked }))}/><span>{label}</span></label>)}</div></fieldset>
          <div className="verificationPolicySubmit"><small>Publishing a new version preserves previous review history.</small><button className="verificationButton" disabled={policyBusy || !functions}>{policyBusy ? 'Publishing…' : 'Publish policy version'}</button></div>
          {policyMessage && <p className="verificationPolicyMessage" role="status">{policyMessage}</p>}
        </form>
      </div>
    </details>}

    <div className={'verificationLayout ' + (selected ? 'hasSelection' : '')}>
      <section className="verificationDirectory">
        <header className="verificationDirectoryHead">
          <div><span className="verificationEyebrow">CREDENTIALS DIRECTORY</span><h2>Professional submissions <span>{matches.length}</span></h2><p>Review identity, license and supporting documents before making a decision.</p></div>
          <div className="verificationHeadActions"><button className={"verificationIconBtn " + (refreshing ? "isRefreshing" : "")} onClick={refreshSubmissions} disabled={refreshing || !db} title="Refresh submissions" aria-label="Refresh submissions"><RefreshCw size={16}/></button><button className="verificationButton" onClick={exportCsv} disabled={!matches.length}><Download size={14}/> Export CSV</button></div>
        </header>
        {refreshMessage && <p className="verificationFeedback" role="status">{refreshMessage}</p>}
        <div className="verificationFilters" role="tablist" aria-label="Submission status">
          {cards.map(({ key, label }) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'active' : ''} onClick={() => chooseFilter(key)}>{labels[key]}<span>{counts[key]}</span></button>)}
        </div>
        <div className="verificationToolbar">
          <label className="verificationSearch"><Search size={16}/><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search by name, email, license number or brokerage…" aria-label="Search submissions"/></label>
          <label className="verificationSelect"><MapPin size={14}/><select value={region} onChange={event => { setRegion(event.target.value); setPage(1); }} aria-label="Filter by region"><option value="all">All regions</option>{regions.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={13}/></label>
          <label className="verificationSelect"><Building2 size={14}/><select value={brokerage} onChange={event => { setBrokerage(event.target.value); setPage(1); }} aria-label="Filter by brokerage"><option value="all">All brokerages</option>{brokerages.map(value => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={13}/></label>
          <label className="verificationSelect"><ArrowDown size={14}/><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort submissions"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select><ChevronDown size={13}/></label>
        </div>
        {(region !== 'all' || brokerage !== 'all' || search) && <div className="verificationFilterNote"><span>{matches.length} matching submission{matches.length === 1 ? '' : 's'}</span><button onClick={resetFilters}><FilterX size={13}/> Clear filters</button></div>}

        <div className="verificationTableWrap" aria-busy={refreshing}><table className="verificationTable"><thead><tr><th>Professional</th><th>License &amp; region</th><th>Brokerage</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {visible.map(user => {
            const status = statusOf(user);
            return <tr key={user.id} className={selected && selected.id === user.id ? 'selected' : ''} onClick={() => { setSelectedId(user.id); setDetailTab('overview'); }}>
              <td><button className="verificationPerson" onClick={() => { setSelectedId(user.id); setDetailTab('overview'); }}><span className="verificationAvatar">{nameOf(user).slice(0, 1).toUpperCase()}</span><span><b>{nameOf(user)}</b><small>{user.email || 'Email not provided'}</small></span></button></td>
              <td><span className="verificationLicense"><b>{user.licenseNumber || 'Not submitted'}</b><small>{user.licenseState || 'Region not provided'}</small></span></td>
              <td>{user.brokerageName || <span className="verificationMuted">Not provided</span>}</td>
              <td><span className="verificationDate">{formatDate(user.verificationSubmittedAt || user.createdAt)}{user.verificationSubmittedAt && <small>{dateOf(user) && dateOf(user).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small>}</span></td>
              <td><span className={'verificationStatus ' + status}><i/>{labels[status] || titleCase(status)}</span></td>
              <td><button className="verificationReview" onClick={event => { event.stopPropagation(); setSelectedId(user.id); setDetailTab('overview'); }}><Eye size={13}/> Review</button></td>
            </tr>;
          })}
        </tbody></table></div>
        {!visible.length && <div className="verificationEmpty"><span><ShieldCheck size={23}/></span><b>{submissions.length ? 'No matching submissions' : 'No verification submissions yet'}</b><small>{submissions.length ? 'Change the search or filters to see other professionals.' : 'Submitted professional credentials will appear here for review.'}</small>{(filter !== 'all' || search || region !== 'all' || brokerage !== 'all') && <button onClick={resetFilters}>Show all submissions <ArrowRight size={14}/></button>}</div>}
        <footer className="verificationPagination"><span>{matches.length ? ((currentPage - 1) * 10 + 1) + '–' + Math.min(currentPage * 10, matches.length) + ' of ' + matches.length + ' submissions' : '0 submissions'}</span><div><button disabled={currentPage === 1} onClick={() => setPage(value => Math.max(1, value - 1))} aria-label="Previous page"><ChevronLeft size={16}/></button><span>Page {currentPage} of {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(value => Math.min(pages, value + 1))} aria-label="Next page"><ChevronRight size={16}/></button></div></footer>
      </section>

      {selected && <section className="verificationProfile verificationFullPage">
        <div className="verificationProfileHead verificationFullPageHead"><button className="verificationBackButton" onClick={() => setSelectedId(null)}><ChevronLeft size={16}/> Back to submissions</button><span className="verificationAccountMeta"><small>PROFESSIONAL ACCOUNT</small><b>{selected.id}</b></span><span className={'verificationStatus ' + statusOf(selected)}><i/>{titleCase(statusOf(selected))}</span></div>
        <div className="verificationProfileIdentity verificationFullPageIdentity"><span className="verificationAvatar large">{nameOf(selected).slice(0, 1).toUpperCase()}</span><div><b>{nameOf(selected)}</b><span>{selected.email || 'Email not provided'}</span><small>Joined {formatDate(selected.createdAt)}</small></div></div>
        <div className="verificationDetailTabs" onKeyDown={event => { const keys = ["overview", "documents", "verification", "activity", "referrals"]; const index = keys.indexOf(detailTab); const next = event.key === "ArrowRight" ? (index + 1) % keys.length : event.key === "ArrowLeft" ? (index + keys.length - 1) % keys.length : event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : -1; if (next >= 0) { event.preventDefault(); setDetailTab(keys[next]); event.currentTarget.querySelectorAll("button")[next].focus(); } }} role="tablist" aria-label="Professional details">{[['overview', 'Overview'], ['documents', 'Documents'], ['verification', 'Verification'], ['activity', 'Activity'], ['referrals', 'Referrals']].map(([key, label]) => <button key={key} id={"verification-tab-" + key} aria-controls="verification-detail-panel" tabIndex={detailTab === key ? 0 : -1} role="tab" aria-selected={detailTab === key} className={detailTab === key ? 'active' : ''} onClick={() => setDetailTab(key)}>{key === "overview" ? <UserRound size={16}/> : key === "documents" ? <FileText size={16}/> : key === "verification" ? <ShieldCheck size={16}/> : key === "referrals" ? <Handshake size={16}/> : <Activity size={16}/>}<span>{label}</span>{key === "documents" && <small>{documentsOf(selected).length}</small>}</button>)}</div>

        <div key={detailTab} id="verification-detail-panel" role="tabpanel" aria-labelledby={"verification-tab-" + detailTab} className={"verificationTabPanel verificationTabPanel--" + detailTab}>
        {documentMessage && <p className="verificationFeedback" role="status">{documentMessage}</p>}
        {documentBusy && <p className="verificationFeedback" role="status"><RefreshCw size={15} className="verificationSpinner"/>Downloading secure document…</p>}
        {detailTab === 'referrals' && <VerificationReferrals key={selected.id} userId={selected.id}/>}
        {detailTab === 'overview' && <div className="verificationProfileBody verificationProfileOverviewGrid">
          {/* Card 1: Account Information */}
          <section className="coterieOverviewCard">
            <header className="coterieCardHeader">
              <span className="coterieCardHeaderIcon honey">
                <UserRound size={17} />
              </span>
              <div>
                <h3>Account Information</h3>
                <p>Core contact details &amp; credentials</p>
              </div>
            </header>
            <div className="coterieFieldGrid">
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Full Legal Name</span>
                <b className="coterieFieldValue">{nameOf(selected)}</b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Email Address</span>
                <div className="coterieFieldWithAction">
                  <b className="coterieFieldValue">{selected.email || 'Not recorded'}</b>
                  {selected.email && (
                    <button
                      type="button"
                      className="coterieCopyBtn"
                      onClick={() => copyText('email', selected.email)}
                      title="Copy email"
                    >
                      {copiedKey === 'email' ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                      <span>{copiedKey === 'email' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Phone Number</span>
                <div className="coterieFieldWithAction">
                  <b className="coterieFieldValue">{selected.phoneNumber || 'Not added'}</b>
                  {selected.phoneNumber && (
                    <button
                      type="button"
                      className="coterieCopyBtn"
                      onClick={() => copyText('phone', selected.phoneNumber)}
                      title="Copy phone"
                    >
                      {copiedKey === 'phone' ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                      <span>{copiedKey === 'phone' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Account Created</span>
                <b className="coterieFieldValue">{formatDate(selected.createdAt)}</b>
              </div>
              {selected.lastLoginAt && (
                <div className="coterieFieldTile">
                  <span className="coterieFieldLabel">Last Active Session</span>
                  <b className="coterieFieldValue">{formatDate(selected.lastLoginAt)}</b>
                </div>
              )}
            </div>
          </section>

          {/* Card 2: Professional Identity */}
          <section className="coterieOverviewCard">
            <header className="coterieCardHeader">
              <span className="coterieCardHeaderIcon amber">
                <BriefcaseBusiness size={17} />
              </span>
              <div>
                <h3>Professional Identity</h3>
                <p>Role tier, specialties, markets &amp; biography</p>
              </div>
            </header>
            
            <div className="coterieMetaRow">
              <div className="coterieMetaPill">
                <span className="coterieFieldLabel">Role</span>
                <b>{titleCase(selected.professionalType || selected.professionalTitle || selected.role || 'Agent')}</b>
              </div>
              <div className="coterieMetaPill">
                <span className="coterieFieldLabel">Experience</span>
                <b>{selected.yearsExperience != null ? `${selected.yearsExperience} yrs` : 'Not specified'}</b>
              </div>
              {selected.city && (
                <div className="coterieMetaPill">
                  <span className="coterieFieldLabel">Primary Market</span>
                  <b>{selected.city}</b>
                </div>
              )}
            </div>

            {/* Service Areas */}
            <div className="coterieSubSection">
              <span className="coterieFieldLabel">Coverage &amp; Service Areas</span>
              <div className="coterieChipGroup">
                {parseList(selected.serviceAreas).length > 0 ? (
                  parseList(selected.serviceAreas).map((area, i) => (
                    <span key={i} className="coterieLocationChip">
                      <MapPin size={11} /> {area}
                    </span>
                  ))
                ) : (
                  <span className="coterieMutedNotice">No specific service areas declared</span>
                )}
              </div>
            </div>

            {/* Specialties */}
            <div className="coterieSubSection">
              <span className="coterieFieldLabel">Specialties &amp; Focus</span>
              <div className="coterieChipGroup">
                {parseList(selected.specialties).length > 0 ? (
                  parseList(selected.specialties).map((spec, i) => (
                    <span key={i} className="coterieSpecialtyChip">
                      <Sparkles size={11} /> {spec}
                    </span>
                  ))
                ) : (
                  <span className="coterieMutedNotice">No specializations listed</span>
                )}
              </div>
            </div>

            {/* Bio Callout */}
            {selected.bio && (
              <div className="coterieBioCardlet">
                <span className="coterieBioIcon"><Quote size={14} /></span>
                <p>{selected.bio}</p>
              </div>
            )}

            {/* Professional Website */}
            {selected.professionalWebsite && (
              <div className="coterieWebsiteRow">
                <a
                  href={selected.professionalWebsite.startsWith('http') ? selected.professionalWebsite : `https://${selected.professionalWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="coterieWebsiteLink"
                >
                  <Globe size={13} />
                  <span>{selected.professionalWebsite}</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            )}
          </section>

          {/* Card 3: License Information */}
          <section className="coterieOverviewCard">
            <header className="coterieCardHeader">
              <span className="coterieCardHeaderIcon emerald">
                <FileCheck2 size={17} />
              </span>
              <div>
                <h3>License Credentials</h3>
                <p>State jurisdiction records &amp; policy version</p>
              </div>
            </header>
            <div className="coterieFieldGrid">
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">License Number</span>
                <div className="coterieFieldWithAction">
                  <b className="coterieFieldValue font-mono">{selected.licenseNumber || 'Not submitted'}</b>
                  {selected.licenseNumber && (
                    <button
                      type="button"
                      className="coterieCopyBtn"
                      onClick={() => copyText('lic', selected.licenseNumber)}
                      title="Copy license"
                    >
                      {copiedKey === 'lic' ? <Check size={12} className="text-emerald" /> : <Copy size={12} />}
                      <span>{copiedKey === 'lic' ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Licensing State / Region</span>
                <b className="coterieFieldValue">
                  {selected.licenseState || 'Not provided'}{selected.licenseStateCode ? ` (${selected.licenseStateCode})` : ''}
                </b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">License Type</span>
                <b className="coterieFieldValue">{titleCase(selected.licenseType || 'Standard license')}</b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Verification Policy</span>
                <b className="coterieFieldValue">
                  {selected.verificationPolicyId || selected.licenseStateCode || 'Not configured'}
                  {selected.verificationPolicyVersion ? ` · ${selected.verificationPolicyVersion}` : ''}
                </b>
              </div>
              {selected.licenseExpirationDate && (
                <div className="coterieFieldTile">
                  <span className="coterieFieldLabel">License Expiration</span>
                  <b className="coterieFieldValue">{formatDate(selected.licenseExpirationDate)}</b>
                </div>
              )}
            </div>
          </section>

          {/* Card 4: Brokerage Information */}
          <section className="coterieOverviewCard">
            <header className="coterieCardHeader">
              <span className="coterieCardHeaderIcon blue">
                <Building2 size={17} />
              </span>
              <div>
                <h3>Brokerage Information</h3>
                <p>Supervising office, broker &amp; affiliation</p>
              </div>
            </header>
            <div className="coterieFieldGrid">
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Brokerage Name</span>
                <b className="coterieFieldValue">{selected.brokerageName || 'Not provided'}</b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Affiliation Relationship</span>
                <b className="coterieFieldValue">{titleCase(selected.brokerageRelationship || 'Associated Agent')}</b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Responsible Broker</span>
                <b className="coterieFieldValue">{selected.responsibleBroker || 'Not provided'}</b>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Broker License Number</span>
                <b className="coterieFieldValue">{selected.brokerLicenseNumber || 'Not provided'}</b>
              </div>
              {selected.brokerageAddress && (
                <div className="coterieFieldTile fullWidth">
                  <span className="coterieFieldLabel">Brokerage Address</span>
                  <b className="coterieFieldValue">{selected.brokerageAddress}</b>
                </div>
              )}
            </div>
          </section>

          {/* Card 5: Verification Status */}
          <section className="coterieOverviewCard">
            <header className="coterieCardHeader">
              <span className="coterieCardHeaderIcon violet">
                <ShieldCheck size={17} />
              </span>
              <div>
                <h3>Verification Status</h3>
                <p>Security &amp; verification checkpoint</p>
              </div>
            </header>
            <div className="coterieFieldGrid">
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Email Verification</span>
                <span className={`coterieStatusTag ${selected.emailVerified ? 'verified' : 'unverified'}`}>
                  {selected.emailVerified ? <CheckCircle2 size={12} /> : <CircleAlert size={12} />}
                  {selected.emailVerified === true ? 'Verified' : selected.emailVerified === false ? 'Unverified' : 'Not recorded'}
                </span>
              </div>
              <div className="coterieFieldTile">
                <span className="coterieFieldLabel">Professional Verification</span>
                <span className={`verificationStatus ${statusOf(selected)}`}>
                  <i />
                  {titleCase(statusOf(selected))}
                </span>
              </div>
            </div>
          </section>

          {/* Supporting Documents Teaser */}
          <section className="coterieDocsTeaserCard">
            <div className="coterieDocsTeaserLeft">
              <span className="coterieDocsTeaserIcon">
                <FileText size={18} />
              </span>
              <div>
                <b>Supporting Documents ({documentsOf(selected).length})</b>
                <small>
                  {documentsOf(selected).length
                    ? `${documentsOf(selected).length} secure verification document(s) uploaded and available for review.`
                    : 'No documents submitted yet for this professional profile.'}
                </small>
              </div>
            </div>
            <button type="button" className="coterieDocsTeaserBtn" onClick={() => setDetailTab('documents')}>
              <span>Review documents</span>
              <ArrowRight size={14} />
            </button>
          </section>
        </div>}

        {detailTab === 'documents' && <div className="verificationProfileBody"><section><h3>Submitted documents</h3>{documentsOf(selected).length ? <div className="verificationDocumentList">{documentsOf(selected).map((document, index) => <div className="verificationDocument" key={document.id || document.name || index}><span><FileText size={15}/></span><div><b>{document.name || document.fileName || 'Verification document'}</b><small>{document.uploadedAt ? 'Uploaded ' + formatDate(document.uploadedAt) : 'Document on file'}</small></div><button type="button" disabled={Boolean(documentBusy)} onClick={() => downloadPrivateDocument(document)} aria-label={"Download " + (document.fileName || document.name || "private document")}><Download size={16}/><span>Download</span></button></div>)}</div> : <div className="verificationDocumentEmpty"><FileText size={24}/><b>No documents on file</b><span>This account has no uploaded verification documents. Review the license details recorded in the profile.</span></div>}</section></div>}

        {detailTab === 'verification' && <div className="verificationProfileBody"><section>
          <h3>Item-by-item review</h3>
          <div className="verificationInfo"><ShieldCheck size={14}/><span><small>Overall status</small><b>{titleCase(statusOf(selected))}</b></span></div>
          <div className="verificationInfo"><MapPin size={14}/><span><small>Jurisdiction policy</small><b>{selected.verificationPolicyId || selected.licenseStateCode || 'Not configured'}{selected.verificationPolicyVersion ? ` · ${selected.verificationPolicyVersion}` : ''}</b></span></div>
          {selected.verificationPolicyConfigurationRequired && <div className="verificationReason"><small>Manual policy configuration required</small><p>Configure the exact jurisdiction requirements before approving this professional.</p></div>}
          {!Object.keys(selected.verificationItems || {}).length && <div className="verificationDocumentEmpty"><ShieldCheck size={28}/><b>No review checklist available</b><span>This account has no item review records. A submitted verification checklist is required before individual credentials can be reviewed.</span></div>}
          {Object.entries(selected.verificationItems || {}).map(([itemId, item]) => {
            const itemDocuments = documentsOf(selected).filter(file => file.documentType === itemId || (item.documentIds || []).includes(file.id));
            const canReview = ['pending', 'requires_changes'].includes(statusOf(selected));
            return <article className="verificationReviewItem" key={itemId}>
              <header><span><b>{verificationItemLabel(item)}</b><small>{item.required ? 'Required' : 'Optional'} · {itemId.replaceAll('_', ' ')}</small></span><span className={'verificationStatus ' + String(item.status || 'pending').toLowerCase()}><i/>{titleCase(item.status || 'PENDING')}</span></header>
              {item.reason && <p className="verificationItemReason">Last note: {item.reason}</p>}
              {['LICENSE', 'BROKERAGE'].includes(itemId) && <div className="verificationSourceFields"><label>{itemId === 'LICENSE' ? 'Official source name' : 'Brokerage verification source'}<input value={itemId === 'LICENSE' ? sourceName || selected.verificationSource?.sourceName || '' : brokerSourceName || item.verificationSource?.sourceName || ''} onChange={event => itemId === 'LICENSE' ? setSourceName(event.target.value) : setBrokerSourceName(event.target.value)} placeholder={itemId === 'LICENSE' ? 'State licensing regulator' : 'Brokerage directory or direct confirmation'}/></label><label>Source URL<input value={itemId === 'LICENSE' ? sourceUrl || selected.verificationSource?.sourceUrl || '' : brokerSourceUrl || item.verificationSource?.sourceUrl || ''} onChange={event => itemId === 'LICENSE' ? setSourceUrl(event.target.value) : setBrokerSourceUrl(event.target.value)} placeholder="https://…"/></label><label>Source reference<input value={itemId === 'LICENSE' ? sourceReference : brokerSourceReference} onChange={event => itemId === 'LICENSE' ? setSourceReference(event.target.value) : setBrokerSourceReference(event.target.value)} placeholder="Lookup ID or record reference"/></label></div>}
              {itemDocuments.length > 0 && <div className="verificationItemFiles">{itemDocuments.map(file => <button key={file.id || file.storagePath} onClick={() => downloadPrivateDocument(file)}><FileText size={14}/>{file.fileName || file.name || 'Private document'}<Eye size={13}/></button>)}</div>}
              {!itemDocuments.length && item.required && item.status !== 'VERIFIED' && itemId.endsWith('DOCUMENT') && <small className="verificationNoDoc">Required document not submitted.</small>}
              {canReview && !['VERIFIED', 'NOT_REQUIRED'].includes(item.status) && <div className="verificationItemActions">
                <label>Reviewer note{item.status === 'CHANGES_REQUESTED' || item.status === 'REJECTED' ? ' (required)' : ''}<textarea rows={2} value={reviewReason[itemId] || ""} onChange={event => setReviewReason(current => ({ ...current, [itemId]: event.target.value }))} placeholder="Record what you checked or what needs correction"/></label>
                <div><button className="approve" disabled={Boolean(reviewingId) || rejectingSubmission || !functions} onClick={() => performReview(itemId, 'VERIFY')}>{reviewingId === itemId ? 'Saving…' : 'Verify item'}</button><button className="changes" disabled={Boolean(reviewingId) || rejectingSubmission || !functions} onClick={() => performReview(itemId, 'REQUEST_CHANGES')}>Request changes</button><button className="reject" disabled={Boolean(reviewingId) || rejectingSubmission || !functions} onClick={() => performReview(itemId, 'REJECT')}>Reject item</button></div>
              </div>}
            </article>;
          })}
          {['pending', 'requires_changes'].includes(statusOf(selected)) && <div className="verificationRejectSubmission"><div><XCircle size={19}/><span><b>Reject this full application</b><small>The professional will need to complete every verification step and submit a new application.</small></span></div><label htmlFor="verification-full-reject-reason">Reason shown to the professional</label><textarea id="verification-full-reject-reason" rows={3} maxLength={1000} value={submissionRejectReason} onChange={event => setSubmissionRejectReason(event.target.value)} placeholder="Explain why this application cannot be approved"/><button type="button" disabled={rejectingSubmission || Boolean(reviewingId) || !functions || !submissionRejectReason.trim()} onClick={rejectSubmission}><XCircle size={15}/>{rejectingSubmission ? 'Rejecting application…' : 'Reject application & require full resubmission'}</button></div>}
          {reviewMessage && <p className="verificationReviewMessage" role="status">{reviewMessage}</p>}
          {selected.verificationPolicyConfigurationRequired && <p className="verificationReviewMessage">Configure this jurisdiction policy in the panel above, then reopen this submission.</p>}
        </section></div>}

        {detailTab === "activity" && Object.values(activityPending).some(Boolean) && <div className="verificationActivityLoading" role="status"><span/><span/><span/><b>Loading account history…</b></div>}
        {detailTab === "activity" && Object.values(activityErrors).some(Boolean) && <p role="alert" className="verificationFeedback">Some activity records could not be loaded. {Object.values(activityErrors).find(Boolean)}</p>}
        {detailTab === 'activity' && <div className="verificationProfileBody"><section><h3>Verification review history</h3>{Object.entries(selected.verificationItems || {}).filter(([, item]) => item.reviewedAt || item.reason).length ? <div className="verificationTimeline">{Object.entries(selected.verificationItems || {}).filter(([, item]) => item.reviewedAt || item.reason).map(([itemId, item]) => <div key={itemId}><i/><span><b>{item.label || titleCase(itemId)} · {titleCase(item.status)}</b><small>{item.reason || `Reviewed by ${item.reviewerId || 'an administrator'}`}</small><time>{item.reviewedAt ? formatDate(item.reviewedAt) : 'Time not recorded'}</time></span></div>)}</div> : <div className="verificationDocumentEmpty"><Activity size={24}/><b>No item reviews recorded yet</b><span>Admin decisions will appear here with the reviewer and time.</span></div>}</section><section><h3>Account activity</h3>{selectedActivity.length ? <div className="verificationTimeline">{selectedActivity.map((item, index) => <div key={item.id || index}><i/><span><b>{item.title || titleCase(item.action) || 'Account update'}</b><small>{item.body || item.description || item.reason || (typeof item.details === 'string' ? item.details : '') || 'Account record updated.'}</small><time>{formatDate(item.createdAt)}</time></span></div>)}</div> : <div className="verificationDocumentEmpty"><Activity size={24}/><b>No account activity recorded</b><span>Other account activity will appear here when available.</span></div>}</section></div>}

        </div>
      </section>}
    </div>
  </div>;
}




