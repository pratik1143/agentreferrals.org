import { useMemo, useState } from 'react';
import { Activity, ArrowDown, ArrowRight, BadgeCheck, BriefcaseBusiness, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Download, Eye, FileBadge2, FilterX, Globe2, LayoutGrid, Mail, Phone, Search, ShieldCheck, SlidersHorizontal, UserRound, UserX, Users, X } from 'lucide-react';
import './admin-users.css';
import './admin-users-fernly.css';

const formatDate = value => {
  const date = value && typeof value.toDate === 'function' ? value.toDate() : (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
};
const accountOf = user => String(user.accountStatus || 'unknown').toLowerCase();
const rawReviewOf = user => String(user.professionalVerificationStatus || user.verificationStatus || '').toLowerCase();
const reviewOf = user => {
  const value = rawReviewOf(user);
  if (value === 'pending_review') return 'pending';
  return value || 'not submitted';
};
const nameOf = user => user.displayName || user.email && user.email.split('@')[0] || 'Unnamed professional';
const valueOf = value => value === null || value === undefined || value === '' ? 'Not recorded' : String(value);
const titleCase = value => String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function AdminUsers({ users = [], referrals = [], applications = [], activity = [], currentUserId, isSuperAdmin, onAction }) {
  const [segment, setSegment] = useState('all');
  const [verification, setVerification] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [layout, setLayout] = useState('cards');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [fullProfile, setFullProfile] = useState(false);
  const [fullProfileTab, setFullProfileTab] = useState('overview');
  const pageSize = 10;

  const totals = useMemo(() => ({
    all: users.length,
    active: users.filter(item => accountOf(item) === 'active').length,
    unverified: users.filter(item => item.emailVerified === false).length,
    suspended: users.filter(item => accountOf(item) === 'suspended').length
  }), [users]);

  const filtered = useMemo(() => users.filter(item => {
    if (segment === 'active' && accountOf(item) !== 'active') return false;
    if (segment === 'unverified' && item.emailVerified !== false) return false;
    if (segment === 'suspended' && accountOf(item) !== 'suspended') return false;
    if (verification !== 'all' && reviewOf(item) !== verification) return false;
    const text = [item.displayName, item.email, item.brokerageName, item.licenseNumber, item.licenseState].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }).sort((a, b) => {
    if (sort === 'name') return nameOf(a).localeCompare(nameOf(b));
    const aTime = (a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) || 0;
    const bTime = (b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) || 0;
    return sort === 'oldest' ? aTime - bTime : bTime - aTime;
  }), [users, segment, verification, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = visible.find(item => item.id === selectedId) || null;
  const selectedReferrals = selected ? referrals.filter(item => item.creatorProfessionalId === selected.id || item.creatorId === selected.id) : [];
  const selectedApplications = selected ? applications.filter(item => item.applicantProfessionalId === selected.id) : [];
  const selectedActivity = selected ? activity.filter(item => [item.userId, item.actorUid, item.targetUserId].includes(selected.id)) : [];

  if (fullProfile && selected) {
    const sections = [
      { title: 'Contact information', icon: Mail, fields: [['Email address', selected.email], ['Phone number', selected.phoneNumber], ['Professional website', selected.website || selected.professionalWebsite]] },
      { title: 'Professional details', icon: BriefcaseBusiness, fields: [['Professional title', selected.professionalTitle || selected.title], ['Brokerage', selected.brokerageName], ['Years of experience', selected.yearsExperience], ['License number', selected.licenseNumber], ['License state', selected.licenseState], ['Primary market', selected.primaryMarket || selected.city]] },
      { title: 'Service & expertise', icon: Globe2, fields: [['Service areas', selected.serviceAreas], ['Specialties', selected.specialties], ['Languages', selected.languages], ['Expertise', selected.expertise || selected.tags]] }
    ];
    const showValue = value => Array.isArray(value) ? value.join(', ') : value && typeof value === 'object' ? (value.toDate ? formatDate(value) : Object.values(value).filter(Boolean).join(', ')) : valueOf(value);
    const dataField = (label, value) => <div className="fullProfileDataField" key={label}><span>{label}</span><b>{showValue(value)}</b></div>;
    const tabItems = [['overview', 'Overview'], ['verification', 'Verification & licenses'], ['activity', 'Activity']];

    return <main className="peopleFullProfilePage">
      <div className="fullProfileBreadcrumb"><button onClick={() => setFullProfile(false)}><ChevronLeft size={16}/> Users &amp; Agents</button><ChevronRight size={14}/><span>{nameOf(selected)}</span></div>
      <header className="fullProfilePageHead">
        <div><span className="peopleEyebrow">PROFESSIONAL ACCOUNT</span><h1>Full profile</h1><p>Account, credentials, and platform activity for this professional.</p></div>
        <div className="fullProfileHeadActions">
          <button className="profileSecondary" onClick={() => onAction({ type: accountOf(selected) === 'suspended' ? 'REACTIVATE_USER' : 'SUSPEND_USER', target: selected, label: accountOf(selected) === 'suspended' ? 'Reactivate Account' : 'Suspend Account' })} disabled={selected.id === currentUserId}>{accountOf(selected) === 'suspended' ? <Check size={15}/> : <UserX size={15}/>} {accountOf(selected) === 'suspended' ? 'Reactivate access' : 'Suspend access'}</button>
          {isSuperAdmin && <span className="peopleStatus active"><ShieldCheck size={13}/> {titleCase(selected.role || 'professional')}</span>}
        </div>
      </header>

      <section className="fullProfileHero">
        <span className="fullProfileHeroAvatar">{nameOf(selected).slice(0, 1).toUpperCase()}</span>
        <div className="fullProfileHeroIdentity"><div className="fullProfileNameLine"><h2>{nameOf(selected)}</h2><span className={'peopleStatus ' + accountOf(selected)}><i/>{titleCase(accountOf(selected))}</span></div><p>{selected.email || 'Email not provided'}{selected.professionalTitle ? ` · ${selected.professionalTitle}` : ''}</p><div className="fullProfileBadges"><span className={'peopleEmailStatus ' + (selected.emailVerified === true ? 'verified' : 'unverified')}><i/>{selected.emailVerified === true ? 'Email verified' : selected.emailVerified === false ? 'Email unverified' : 'Email status unknown'}</span><span className={'peopleVerification ' + reviewOf(selected)}><ShieldCheck size={13}/>{titleCase(reviewOf(selected))}</span><span className="fullProfileJoined"><CalendarDays size={13}/> Joined {formatDate(selected.createdAt)}</span></div></div>
      </section>

      <div className="fullProfileMetrics"><article><span><BriefcaseBusiness size={16}/></span><b>{selectedReferrals.length}</b><small>Referrals created</small></article><article><span><ClipboardList size={16}/></span><b>{selectedApplications.length}</b><small>Applications sent</small></article><article><span><Activity size={16}/></span><b>{selectedActivity.length}</b><small>Activity events</small></article><article><span><FileBadge2 size={16}/></span><b>{selected.licenseNumber ? '1' : '0'}</b><small>License records</small></article></div>

      <nav className="fullProfileTabs" role="tablist" aria-label="Profile sections">{tabItems.map(([key, label]) => <button key={key} role="tab" aria-selected={fullProfileTab === key} className={fullProfileTab === key ? 'active' : ''} onClick={() => setFullProfileTab(key)}>{label}{key === 'activity' && <span>{selectedActivity.length}</span>}</button>)}</nav>

      {fullProfileTab === 'overview' && <div className="fullProfileContent">
        <section className="fullProfilePanel fullProfileBio"><div className="fullProfilePanelHead"><div><span>ABOUT</span><h3>Professional biography</h3></div><UserRound size={18}/></div><p>{selected.bio || selected.professionalBio || 'This professional has not added a biography yet.'}</p></section>
        <div className="fullProfileSectionGrid">{sections.map(section => { const Icon = section.icon; const populated = section.fields.filter(([, value]) => value !== undefined && value !== null && value !== ''); return <section className="fullProfilePanel" key={section.title}><div className="fullProfilePanelHead"><div><span>PROFILE DETAILS</span><h3>{section.title}</h3></div><Icon size={18}/></div>{populated.length ? <div className="fullProfileDataGrid">{populated.map(([label, value]) => dataField(label, value))}</div> : <p className="fullProfileEmptyNote">No details provided yet.</p>}</section>; })}</div>
        <div className="fullProfileSectionGrid"><section className="fullProfilePanel"><div className="fullProfilePanelHead"><div><span>RECENT WORK</span><h3>Referrals created</h3></div><BriefcaseBusiness size={18}/></div>{selectedReferrals.length ? <div className="fullProfileRecordList">{selectedReferrals.slice(0, 5).map(item => <div key={item.id}><span><b>{item.title || 'Untitled referral'}</b><small>{[item.city, item.state].filter(Boolean).join(', ') || 'Location not provided'} · {formatDate(item.createdAt)}</small></span><em>{titleCase(item.status || 'unknown')}</em></div>)}</div> : <p className="fullProfileEmptyNote">No referrals created yet.</p>}</section><section className="fullProfilePanel"><div className="fullProfilePanelHead"><div><span>RECENT WORK</span><h3>Applications sent</h3></div><ClipboardList size={18}/></div>{selectedApplications.length ? <div className="fullProfileRecordList">{selectedApplications.slice(0, 5).map(item => <div key={item.id}><span><b>{item.referralTitle || 'Referral application'}</b><small>Submitted {formatDate(item.createdAt)}</small></span><em>{titleCase(item.status || 'unknown')}</em></div>)}</div> : <p className="fullProfileEmptyNote">No applications sent yet.</p>}</section></div>
      </div>}

      {fullProfileTab === 'verification' && <div className="fullProfileSectionGrid fullProfileContent"><section className="fullProfilePanel"><div className="fullProfilePanelHead"><div><span>ACCOUNT SECURITY</span><h3>Email &amp; account status</h3></div><ShieldCheck size={18}/></div><div className="fullProfileDataGrid">{dataField('Email verification', selected.emailVerified === true ? 'Verified' : selected.emailVerified === false ? 'Unverified' : 'Not recorded')}{dataField('Account status', titleCase(accountOf(selected)))}{dataField('Onboarding status', titleCase(selected.onboardingStatus || 'Not started'))}{dataField('Account role', titleCase(selected.role || 'Professional'))}</div></section><section className="fullProfilePanel"><div className="fullProfilePanelHead"><div><span>LICENSE REVIEW</span><h3>Professional credentials</h3></div><FileBadge2 size={18}/></div><div className="fullProfileDataGrid">{dataField('Review status', titleCase(reviewOf(selected)))}{dataField('License number', selected.licenseNumber)}{dataField('License state', selected.licenseState)}{dataField('Brokerage', selected.brokerageName)}{dataField('Review notes', selected.verificationReason)}</div></section></div>}

      {fullProfileTab === 'activity' && <section className="fullProfilePanel fullProfileContent"><div className="fullProfilePanelHead"><div><span>ACCOUNT TIMELINE</span><h3>Recent activity</h3></div><Activity size={18}/></div>{selectedActivity.length ? <div className="fullProfileTimeline">{selectedActivity.slice(0, 20).map(item => <article key={item.id}><i/><div><b>{item.title || item.action || 'Account activity'}</b><p>{item.description || item.reason || 'Activity recorded for this account.'}</p><small>{formatDate(item.createdAt)}</small></div></article>)}</div> : <p className="fullProfileEmptyNote">No activity is recorded for this account yet.</p>}</section>}
    </main>;
  }

  const exportUsers = () => {
    const cell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, match => "'" + match).replaceAll('"', '""') + '"';
    const rows = [['Name', 'Email', 'Account status', 'Email verification', 'Professional verification', 'Brokerage', 'Joined'], ...filtered.map(item => [nameOf(item), item.email, accountOf(item), item.emailVerified === true ? 'Verified' : item.emailVerified === false ? 'Unverified' : 'Not recorded', reviewOf(item), item.brokerageName, formatDate(item.createdAt)])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'agentreferrals-people.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const chooseSegment = next => { setSegment(next); setPage(1); };
  const reset = () => { setSegment('all'); setVerification('all'); setQuery(''); setSort('newest'); setPage(1); };
  const segments = [
    { key: 'all', label: 'Total accounts', icon: Users },
    { key: 'active', label: 'Active', icon: UserRound },
    { key: 'unverified', label: 'Email unverified', icon: CircleAlert },
    { key: 'suspended', label: 'Suspended', icon: UserX }
  ];

  return <div className="peoplePage">
    <div className="peopleBreadcrumb"><span>Admin</span><ChevronRight size={13}/><b>Users &amp; Agents</b></div>
    <header className="peopleIntro">
      <div><span className="peopleEyebrow">PEOPLE &amp; ACCESS</span><h1>Users &amp; Agents</h1><p>Manage professional accounts, email verification, and platform access.</p></div>
      <div className="peopleIntroActions"><span className="peopleLoaded"><Users size={15}/>{users.length} professional accounts</span><button className="consoleExport" onClick={exportUsers} disabled={!filtered.length}><Download size={15}/> Export CSV</button></div>
    </header>

    <div className="peopleSummary" role="tablist" aria-label="Account status filters">{segments.map(item => { const Icon = item.icon; return <button key={item.key} role="tab" aria-selected={segment === item.key} className={'peopleSummaryCard ' + (segment === item.key ? 'active' : '')} onClick={() => chooseSegment(item.key)}><span><Icon size={18}/><ArrowRight size={15}/></span><strong>{totals[item.key]}</strong><small>{item.label}</small></button>; })}</div>

    <div className={'peopleWorkspace ' + (selected ? 'hasProfile' : '')}>
      <section className="peopleDirectory">
        <div className="peopleDirectoryHead"><div><span className="peopleEyebrow">PROFESSIONAL DIRECTORY</span><h2>Professional accounts <span>{filtered.length}</span></h2></div>
          <div className="peopleToolbar">
            <label className="peopleSearch"><Search size={17}/><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, email, brokerage…" aria-label="Search users"/></label>
            <label className="peopleSelect"><SlidersHorizontal size={16}/><select value={verification} onChange={event => { setVerification(event.target.value); setPage(1); }} aria-label="Verification filter"><option value="all">All verification</option><option value="approved">Approved</option><option value="pending">Pending review</option><option value="rejected">Rejected</option><option value="not submitted">Not submitted</option></select></label>
            <label className="peopleSelect"><ArrowDown size={16}/><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort users"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>
            <div className="peopleViewToggle" role="group" aria-label="Directory layout"><button className={layout === 'cards' ? 'active' : ''} aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}><LayoutGrid size={14}/> Cards</button><button className={layout === 'table' ? 'active' : ''} aria-pressed={layout === 'table'} onClick={() => setLayout('table')}><ClipboardList size={14}/> Table</button></div>
          </div>
        </div>
        {(segment !== 'all' || verification !== 'all' || query) && <div className="peopleActiveFilter"><span>Showing {filtered.length} matching account{filtered.length === 1 ? '' : 's'}</span><button onClick={reset}><FilterX size={14}/> Clear filters</button></div>}
        {layout === 'cards' ? <div className="peopleCards">{visible.map(item => { const createdReferrals = referrals.filter(referral => referral.creatorProfessionalId === item.id || referral.creatorId === item.id).length; const sentApplications = applications.filter(application => application.applicantProfessionalId === item.id).length; return <article className={'peopleCard ' + (selectedId === item.id ? 'selected' : '')} key={item.id}>
          <div className="peopleCardHead"><span className={'peopleStatus ' + accountOf(item)}><i/>{titleCase(accountOf(item))}</span><span className={'peopleCardPresence ' + (accountOf(item) === 'active' ? 'online' : '')}><i/>{accountOf(item) === 'active' ? 'Active account' : titleCase(accountOf(item))}</span></div>
          <span className="peopleCardAvatar">{nameOf(item).slice(0, 2).toUpperCase()}</span><h3>{nameOf(item)}</h3><p>{item.professionalTitle || item.title || 'Real estate professional'}</p><span className="peopleCardRole">{item.brokerageName || 'Independent professional'}</span>
          <div className="peopleCardMetrics"><span><b>{createdReferrals}</b><small>Referrals</small></span><span><b>{sentApplications}</b><small>Applications</small></span><span><b>{titleCase(reviewOf(item))}</b><small>Credentials</small></span></div>
          <div className="peopleCardActions"><button className="peopleCardDetails" onClick={() => setSelectedId(item.id)}><Eye size={14}/> Details</button><button className="peopleCardProfile" onClick={() => { setSelectedId(item.id); setFullProfileTab('overview'); setFullProfile(true); }}>Open profile <ArrowRight size={14}/></button></div>
        </article>; })}</div> : <div className="peopleTableWrap"><table className="peopleTable"><thead><tr><th>Professional</th><th>Account</th><th>Email</th><th>License review</th><th>Brokerage</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>{visible.map(item => {
            const account = accountOf(item);
            const verificationValue = reviewOf(item);
            const emailValue = item.emailVerified === true ? 'verified' : item.emailVerified === false ? 'unverified' : 'unknown';
            return <tr key={item.id} className={selected && selected.id === item.id ? 'selected' : ''} onClick={() => setSelectedId(item.id)}>
              <td><button className="peoplePerson" onClick={() => setSelectedId(item.id)}><span className="peopleAvatar">{nameOf(item).slice(0, 1).toUpperCase()}</span><span><b>{nameOf(item)}</b><small>{item.email || 'Email not provided'}</small></span></button></td>
              <td><span className={'peopleStatus ' + account}><i/>{titleCase(account)}</span></td>
              <td><span className={'peopleEmailStatus ' + emailValue}><i/>{emailValue === 'unknown' ? 'Not recorded' : titleCase(emailValue)}</span></td>
              <td><span className={'peopleVerification ' + verificationValue}>{verificationValue === 'approved' ? <BadgeCheck size={13}/> : verificationValue === 'rejected' ? <CircleAlert size={13}/> : <ShieldCheck size={13}/>} {titleCase(verificationValue)}</span></td>
              <td>{item.brokerageName || <span className="peopleMuted">Not provided</span>}</td><td>{formatDate(item.createdAt)}</td>
              <td><div className="peopleActions"><button className="peopleView" onClick={event => { event.stopPropagation(); setSelectedId(item.id); }}><Eye size={13}/> Details</button>
                <button className="peopleActionMore" aria-label={'Change access for ' + nameOf(item)} onClick={event => { event.stopPropagation(); onAction({ type: account === 'suspended' ? 'REACTIVATE_USER' : 'SUSPEND_USER', target: item, label: account === 'suspended' ? 'Reactivate Account' : 'Suspend Account' }); }} disabled={item.id === currentUserId} title={account === 'suspended' ? 'Reactivate account' : 'Suspend account'}>{account === 'suspended' ? <Check size={16}/> : <UserX size={16}/>}</button>
                {isSuperAdmin && <button className="peopleActionMore" aria-label={'Change role for ' + nameOf(item)} onClick={event => { event.stopPropagation(); onAction({ type: 'MANAGE_ROLE', target: item, label: 'Modify Platform Role' }); }} disabled={item.id === currentUserId} title="Change role"><ShieldCheck size={16}/></button>}
              </div></td></tr>;
          })}</tbody></table></div>}
        {!visible.length && <div className="peopleEmpty"><div><Search size={23}/></div><h3>No matching accounts</h3><p>Try another name or adjust the filters.</p><button onClick={reset}>Show all people <ArrowRight size={15}/></button></div>}
        <footer className="peoplePagination"><span>{filtered.length ? ((currentPage - 1) * pageSize + 1) + '–' + Math.min(currentPage * pageSize, filtered.length) + ' of ' + filtered.length : '0 results'}</span><div><button onClick={() => setPage(value => Math.max(1, value - 1))} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft size={17}/></button><span>Page {currentPage} of {pages}</span><button onClick={() => setPage(value => Math.min(pages, value + 1))} disabled={currentPage === pages} aria-label="Next page"><ChevronRight size={17}/></button></div></footer>
      </section>

      {selected && <aside className="peopleProfile">
        <>
          <div className="profileTopline"><span className="peopleEyebrow">PROFESSIONAL DETAILS</span><button className="profileClose" onClick={() => setSelectedId(null)} aria-label="Close professional details"><X size={15}/></button><span className={'peopleStatus ' + accountOf(selected)}><i/>{titleCase(accountOf(selected))}</span></div>
          <div className="profileIdentity"><span className="profileAvatar">{nameOf(selected).slice(0, 1).toUpperCase()}</span><div><h2>{nameOf(selected)}</h2><p>{selected.email || 'Email not provided'}</p><small>{selected.role ? titleCase(selected.role) : 'Professional'}</small></div></div>
          <div className="profileTabs"><span className="active">Overview</span><span>Verification</span><span>Activity</span></div>
          <div className="profileSection"><h3>Account information</h3>
            <div className="profileInfo"><Mail size={14}/><span><small>Email address</small><b>{valueOf(selected.email)}</b></span></div>
            <div className="profileInfo"><Phone size={14}/><span><small>Phone</small><b>{valueOf(selected.phoneNumber)}</b></span></div>
            <div className="profileInfo"><CalendarDays size={14}/><span><small>Joined</small><b>{formatDate(selected.createdAt)}</b></span></div>
            <div className="profileInfo"><BadgeCheck size={14}/><span><small>Email verification</small><b>{selected.emailVerified === true ? 'Verified' : selected.emailVerified === false ? 'Unverified' : 'Not recorded'}</b></span></div>
          </div>
          <div className="profileSection"><h3>Professional verification</h3>
            <div className="profileInfo"><ShieldCheck size={14}/><span><small>Review status</small><b>{titleCase(reviewOf(selected))}</b></span></div>
            <div className="profileInfo"><BadgeCheck size={14}/><span><small>License</small><b>{valueOf(selected.licenseNumber)}{selected.licenseState ? ' · ' + selected.licenseState : ''}</b></span></div>
            <div className="profileInfo"><Building2 size={14}/><span><small>Brokerage</small><b>{valueOf(selected.brokerageName)}</b></span></div>
          </div>
          <div className="profileActivity"><span><b>{selectedReferrals.length}</b><small>Referrals</small></span><span><b>{selectedApplications.length}</b><small>Applications</small></span></div>
          <div className="profileActions">
            <button className="profilePrimary" onClick={() => { setFullProfileTab('overview'); setFullProfile(true); }}><Eye size={14}/> Open full profile</button>
            <button className="profileSecondary" disabled={selected.id === currentUserId} onClick={() => onAction({ type: accountOf(selected) === 'suspended' ? 'REACTIVATE_USER' : 'SUSPEND_USER', target: selected, label: accountOf(selected) === 'suspended' ? 'Reactivate Account' : 'Suspend Account' })}>{accountOf(selected) === 'suspended' ? <Check size={14}/> : <UserX size={14}/>} {accountOf(selected) === 'suspended' ? 'Reactivate access' : 'Suspend access'}</button>
          </div>
        </>
      </aside>}
    </div>
  </div>;
}






