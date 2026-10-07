import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Archive, ArrowDownWideNarrow, ArrowUpWideNarrow, BadgeCheck, Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Eye, FileText, Filter, MapPin, MoreHorizontal, Pause, Play, Search, ShieldAlert, Trash2, Users, Wallet, X } from 'lucide-react';
import { can, PERMISSIONS } from '../functions/permissions.mjs';
import './admin-referrals.css';
import './admin-board.css';

const value = (...items) => items.find(item => item !== undefined && item !== null && String(item).trim() !== '');
const money = amount => {
  if (amount === undefined || amount === null || amount === '') return null;
  const number = Number(String(amount).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(number)) return String(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(number);
};
const dateOf = item => {
  if (!item) return null;
  const date = item?.toDate ? item.toDate() : new Date(item);
  return Number.isNaN(date.getTime()) ? null : date;
};
const fmtDate = item => dateOf(item)?.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) || 'Not provided';
const relative = item => {
  const date = dateOf(item);
  if (!date) return 'Post date unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `Posted ${minutes}m ago`;
  if (minutes < 1440) return `Posted ${Math.floor(minutes / 60)}h ago`;
  if (minutes < 43200) return `Posted ${Math.floor(minutes / 1440)}d ago`;
  return `Posted ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
};
const normalizedStatus = referral => {
  const status = String(referral.status || '').toLowerCase();
  if (status === 'archived') return 'archived';
  if (status === 'suspended' || status === 'flagged') return 'suspended';
  if (status === 'paused') return 'paused';
  if (['closed', 'completed', 'cancelled', 'canceled'].includes(status)) return 'closed';
  const expiry = dateOf(value(referral.expiresAt, referral.expirationDate));
  if (expiry && expiry.getTime() < Date.now()) return 'expired';
  if (['open', 'active', 'published', 'live'].includes(status)) return 'published';
  return status || 'unknown';
};
const statusLabel = status => ({ published: 'Published', paused: 'Paused', suspended: 'Suspended', closed: 'Closed', expired: 'Expired', archived: 'Archived', unknown: 'Unknown' }[status] || (status ? status[0].toUpperCase() + status.slice(1) : 'Unknown'));
const budgetOf = referral => {
  const min = money(value(referral.minValue, referral.minBudget, referral.budgetMin));
  const max = money(value(referral.maxValue, referral.maxBudget, referral.budgetMax));
  return min || max ? `${min || '—'}${min && max ? ' – ' : ''}${max || ''}` : null;
};
const locationOf = referral => [referral.city, referral.state, referral.zip || referral.postalCode].filter(Boolean).join(', ');

function StatusBadge({ status }) { return <span className={`arm-status arm-status-${status}`}>{statusLabel(status)}</span>; }
function Field({ icon: Icon, label, children }) {
  return <div className="arm-field"><span className="arm-field-icon"><Icon size={15} /></span><div><span className="arm-field-label">{label}</span><b>{children || 'Not provided'}</b></div></div>;
}

export default function AdminReferralManagement({ referrals = [], applications = [], agreements = [], users = [], activity = [], loading, error, onRetry, onMutate, onNavigate, isSuperAdmin, role }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [feeFilter, setFeeFilter] = useState('all');
  const [createdFilter, setCreatedFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('cards');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selected]);
  const [moreFor, setMoreFor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const pageSize = 10;
  const canModerate = can(role, PERMISSIONS.REFERRALS_MODERATE);
  const canClose = can(role, PERMISSIONS.REFERRALS_CANCEL);
  const locations = useMemo(() => [...new Set(referrals.map(locationOf).filter(Boolean))].sort(), [referrals]);
  const clientTypes = useMemo(() => [...new Set(referrals.map(r => value(r.clientType, r.category)).filter(Boolean))].sort(), [referrals]);
  const propertyTypes = useMemo(() => [...new Set(referrals.map(r => r.propertyType).filter(Boolean))].sort(), [referrals]);
  const counts = useMemo(() => referrals.reduce((result, referral) => { const status = normalizedStatus(referral); result.all += 1; result[status] = (result[status] || 0) + 1; return result; }, { all: 0 }), [referrals]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filteredRows = referrals.filter(referral => {
      const status = normalizedStatus(referral);
      const searchable = [referral.title, locationOf(referral), referral.id, referral.category, referral.clientType, referral.propertyType, referral.description, referral.creatorName, referral.creatorEmail].filter(Boolean).join(' ').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (needle && !searchable.includes(needle)) return false;
      if (locationFilter !== 'all' && locationOf(referral) !== locationFilter) return false;
      if (clientFilter !== 'all' && value(referral.clientType, referral.category) !== clientFilter) return false;
      if (propertyFilter !== 'all' && referral.propertyType !== propertyFilter) return false;
      const fee = Number(referral.feePercent);
      if (feeFilter === 'under25' && !(fee < 25)) return false;
      if (feeFilter === '25to35' && !(fee >= 25 && fee <= 35)) return false;
      if (feeFilter === 'over35' && !(fee > 35)) return false;
      const created = dateOf(referral.createdAt);
      if (createdFilter === '7d' && (!created || Date.now() - created.getTime() > 7 * 86400000)) return false;
      if (createdFilter === '30d' && (!created || Date.now() - created.getTime() > 30 * 86400000)) return false;
      if (createdFilter === 'older' && (!created || Date.now() - created.getTime() <= 30 * 86400000)) return false;
      return true;
    });
    const byDate = item => dateOf(item.createdAt)?.getTime() || 0;
    const byFee = item => Number(item.feePercent) || 0;
    const byApps = item => applications.filter(app => app.referralId === item.id).length;
    return filteredRows.sort((a, b) => sort === 'oldest' ? byDate(a) - byDate(b) : sort === 'highestFee' ? byFee(b) - byFee(a) : sort === 'lowestFee' ? byFee(a) - byFee(b) : sort === 'applications' ? byApps(b) - byApps(a) : byDate(b) - byDate(a));
  }, [referrals, applications, search, statusFilter, locationFilter, clientFilter, propertyFilter, feeFilter, createdFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setLocationFilter('all'); setClientFilter('all'); setPropertyFilter('all'); setFeeFilter('all'); setCreatedFilter('all'); setPage(1); };
  const applicationRows = referral => applications.filter(app => app.referralId === referral.id);
  const posterOf = referral => users.find(person => person.id === value(referral.creatorProfessionalId, referral.creatorId));
  const activeAction = async () => {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await onMutate(confirm.referral, confirm.action, reason, notes);
      setConfirm(null); setReason(''); setNotes('');
    } catch {
      // The portal reports mutation errors through its shared admin toast.
    } finally { setBusy(false); }
  };
  const hasFilters = Boolean(search || statusFilter !== 'all' || locationFilter !== 'all' || clientFilter !== 'all' || propertyFilter !== 'all' || feeFilter !== 'all' || createdFilter !== 'all');
  const openConfirm = (referral, action) => { setConfirm({ referral, action }); setReason(''); setNotes(''); setMoreFor(null); };
  const drawerActivity = selected ? activity.filter(event => event.referralId === selected.id || (event.entityType === 'referrals' && event.entityId === selected.id) || event.resourceId === selected.id).sort((a, b) => (dateOf(b.createdAt)?.getTime() || 0) - (dateOf(a.createdAt)?.getTime() || 0)) : [];

  return <div className="adminView arm-page">
    <header className="arm-header">
      <div><span className="arm-eyebrow">REFERRAL OPERATIONS</span><h1>Referral Management</h1><p>Monitor, review, and manage referral opportunities across the network.</p></div>
      <div className="arm-total"><span>Total Referrals</span><strong>{loading ? '—' : referrals.length}</strong><small>Live marketplace records</small></div>
    </header>
    {error && <div className="arm-error"><ShieldAlert size={19} /><div><b>Unable to load referrals</b><span>{error?.code ? `${String(error.code).split('/').pop()}: ` : ""}{error?.message || "Referral data is unavailable."}</span></div><button onClick={onRetry}>Retry</button></div>}
    <div className="arm-statusbar" role="tablist" aria-label="Filter referrals by status">
      {['all', 'published', 'paused', 'suspended', 'closed', 'expired'].map(status => <button key={status} className={statusFilter === status ? 'is-active' : ''} onClick={() => { setStatusFilter(status); setPage(1); }}><span>{statusLabel(status)}</span><b>{loading ? '—' : counts[status] || 0}</b></button>)}
    </div>
    <section className="arm-toolbar">
      <label className="arm-search"><Search size={17} /><input value={search} placeholder="Search referrals by title, location, ID..." onChange={event => { setSearch(event.target.value); setPage(1); }} />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</label>
      <div className="arm-selects">
        <label><MapPin size={15} /><select value={locationFilter} onChange={e => { setLocationFilter(e.target.value); setPage(1); }}><option value="all">All locations</option>{locations.map(location => <option key={location}>{location}</option>)}</select><ChevronDown size={14} /></label>
        <label><Users size={15} /><select value={clientFilter} onChange={e => { setClientFilter(e.target.value); setPage(1); }}><option value="all">All client types</option>{clientTypes.map(type => <option key={type}>{type}</option>)}</select><ChevronDown size={14} /></label>
        <label><Building2 size={15} /><select value={propertyFilter} onChange={e => { setPropertyFilter(e.target.value); setPage(1); }}><option value="all">All property types</option>{propertyTypes.map(type => <option key={type}>{type}</option>)}</select><ChevronDown size={14} /></label>
        <label><Wallet size={15} /><select value={feeFilter} onChange={e => { setFeeFilter(e.target.value); setPage(1); }}><option value="all">Any referral fee</option><option value="under25">Under 25%</option><option value="25to35">25–35%</option><option value="over35">Over 35%</option></select><ChevronDown size={14} /></label>
        <label><CalendarDays size={15} /><select value={createdFilter} onChange={e => { setCreatedFilter(e.target.value); setPage(1); }}><option value="all">Any created date</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="older">Older than 30 days</option></select><ChevronDown size={14} /></label>
        <label><ArrowDownWideNarrow size={15} /><select value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highestFee">Highest fee</option><option value="lowestFee">Lowest fee</option><option value="applications">Most applications</option></select><ChevronDown size={14} /></label>
      </div>
      <div className="arm-view-toggle"><button className={view === 'cards' ? 'active' : ''} onClick={() => setView('cards')}>Cards</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Board</button></div>
    </section>
    {loading ? <div className="arm-grid" aria-label="Loading referrals">{Array.from({ length: 4 }, (_, index) => <div className="arm-skeleton" key={index}><i /><i /><i /><i /></div>)}</div> : !error && referrals.length === 0 ? <div className="arm-empty"><div className="arm-empty-icon"><FileText size={25} /></div><h2>No referrals yet</h2><p>Referral opportunities posted by professionals will appear here.</p></div> : !error && filtered.length === 0 ? <div className="arm-empty"><div className="arm-empty-icon"><Filter size={25} /></div><h2>No referrals match your filters</h2><p>Adjust your search or clear filters to see more opportunities.</p><button className="arm-button arm-button-primary" onClick={clearFilters}>Clear filters</button></div> : !error && <>
      {view === 'board' ? <div className="arm-board">{[
        { key: 'published', label: 'Published', statuses: ['published'] },
        { key: 'paused', label: 'Paused', statuses: ['paused'] },
        { key: 'review', label: 'Needs attention', statuses: ['suspended', 'unknown'] },
        { key: 'closed', label: 'Closed', statuses: ['closed', 'expired', 'archived'] },
        { key: 'other', label: 'Other stages', statuses: [] },
      ].map(column => { const knownStatuses = ['published', 'paused', 'suspended', 'unknown', 'closed', 'expired', 'archived']; const rows = filtered.filter(item => column.key === 'other' ? !knownStatuses.includes(normalizedStatus(item)) : column.statuses.includes(normalizedStatus(item))); return <section className="arm-board-column" key={column.key}><header><div><i className={`arm-board-dot ${column.key}`} /><h2>{column.label}</h2></div><b>{rows.length}</b></header><div className="arm-board-cards">{rows.map(item => <button key={item.id} className="arm-board-card" onClick={() => setSelected(item)}><StatusBadge status={normalizedStatus(item)}/><strong>{value(item.title, 'Untitled referral')}</strong><span>{locationOf(item) || 'Location not provided'}</span><small><Clock3 size={12}/>{dateOf(item.createdAt)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || 'Date unavailable'}<i />{applicationRows(item).length} applications</small></button>)}{rows.length === 0 && <div className="arm-board-empty">No referrals in this stage</div>}</div></section>; })}</div> : <div className={view === 'cards' ? 'arm-grid' : 'arm-list'}>
        {pageRows.map(referral => {
          const status = normalizedStatus(referral); const apps = applicationRows(referral).length; const postedBy = posterOf(referral); const fee = referral.feePercent;
          const name = value(referral.creatorName, postedBy?.displayName, postedBy?.name, 'Professional');
          const email = value(referral.creatorEmail, postedBy?.email);
          const canPause = canModerate && ['published', 'paused'].includes(status);
          const controls = <div className="arm-card-actions"><button className="arm-button" onClick={() => setSelected(referral)}><Eye size={15} /> View details</button><button className="arm-button" onClick={() => onNavigate('applications', referral.id)}><Users size={15} /> Applications <b>{apps}</b></button>{canPause && <button className="arm-button arm-button-quiet" onClick={() => openConfirm(referral, status === 'paused' ? 'published' : 'paused')}>{status === 'paused' ? <Play size={15} /> : <Pause size={15} />}{status === 'paused' ? 'Resume' : 'Pause'}</button>}{canClose && ['published', 'paused', 'suspended'].includes(status) && <button className="arm-icon-button arm-danger-quiet" title="Close referral" onClick={() => openConfirm(referral, 'closed')}><X size={16} /></button>}
              {(canModerate || isSuperAdmin) && <div className="arm-more-wrap"><button className="arm-icon-button" aria-label="More referral actions" onClick={() => setMoreFor(moreFor === referral.id ? null : referral.id)}><MoreHorizontal size={18} /></button>{moreFor === referral.id && <div className="arm-more-menu"><button onClick={() => { setSelected(referral); setMoreFor(null); }}><Eye size={14} /> View Details</button><button onClick={() => { onNavigate('applications', referral.id); setMoreFor(null); }}><Users size={14} /> View Applications</button>{posterOf(referral) && <button onClick={() => { onNavigate('professionals', posterOf(referral).id); setMoreFor(null); }}><Users size={14} /> View Posted By</button>}<button onClick={() => { setSelected(referral); setMoreFor(null); }}><Activity size={14} /> View Activity</button>{canModerate && status !== 'suspended' && status !== 'closed' && <button onClick={() => openConfirm(referral, 'suspended')}><ShieldAlert size={14} /> Suspend Referral</button>}{canModerate && status !== 'closed' && <button onClick={() => openConfirm(referral, 'closed')}><X size={14} /> Close Referral</button>}{isSuperAdmin && status !== 'archived' && <button onClick={() => openConfirm(referral, 'archived')}><Archive size={14} /> Archive Referral</button>}{isSuperAdmin && <button className="danger" onClick={() => openConfirm(referral, 'deleted')}><Trash2 size={14} /> Delete Referral</button>}</div>}</div>}
            </div>;
          return <article className={`arm-card ${view === 'list' ? 'arm-card-list' : ''}`} key={referral.id}>
            <div className="arm-card-top"><StatusBadge status={status} /><span className="arm-posted"><Clock3 size={13} />{relative(referral.createdAt)}</span></div>
            <button className="arm-card-title" onClick={() => setSelected(referral)}>{value(referral.title, 'Untitled referral')}</button>
            <div className="arm-card-subtitle"><span>{locationOf(referral) || 'Location not provided'}</span>{value(referral.clientType, referral.category) && <><i />{value(referral.clientType, referral.category)}{!String(value(referral.clientType, referral.category)).toLowerCase().includes('referral') ? ' Client Referral' : ''}</>}</div>
            <div className="arm-meta-grid"><Field icon={MapPin} label="Location">{locationOf(referral)}</Field><Field icon={Users} label="Client type">{value(referral.clientType, referral.category)}</Field><Field icon={Building2} label="Property type">{referral.propertyType}</Field><Field icon={Wallet} label="Budget">{budgetOf(referral)}</Field><Field icon={BadgeCheck} label="Referral fee">{fee !== undefined && fee !== null && fee !== '' ? `${fee}%` : null}</Field><Field icon={Users} label="Applications">{apps}</Field></div>
            {referral.description && <p className="arm-description">{referral.description}</p>}
            <div className="arm-poster"><div className="arm-avatar">{String(name).trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'P'}</div><div><span>POSTED BY</span><b>{name}</b>{email && <small>{email}</small>}</div><button aria-label="View referral details" onClick={() => setSelected(referral)}><Eye size={15} /></button></div>
            {controls}
          </article>;
        })}
      </div>}
      {view !== 'board' && <div className="arm-pagination"><span>Showing {filtered.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} referrals</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={17} /></button>{Array.from({ length: pageCount }, (_, index) => <button key={index + 1} className={page === index + 1 ? 'active' : ''} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button aria-label="Next page" disabled={page >= pageCount} onClick={() => setPage(Math.min(pageCount, page + 1))}><ChevronRight size={17} /></button></div></div>}
    </>}

    {selected && createPortal(<div className="arm-drawer-backdrop" onClick={() => setSelected(null)}><aside className="arm-drawer" onClick={event => event.stopPropagation()}><header className="arm-drawer-header"><div><span>REFERRAL DETAILS</span><StatusBadge status={normalizedStatus(selected)} /></div><button className="arm-icon-button" aria-label="Close details" onClick={() => setSelected(null)}><X size={19} /></button></header><div className="arm-drawer-scroll"><div className="arm-detail-hero"><span><Clock3 size={13}/>{relative(selected.createdAt)}</span><h2>{value(selected.title, 'Untitled referral')}</h2><p className="arm-drawer-location">{locationOf(selected) || 'Location not provided'}{selected.clientType || selected.category ? ` · ${value(selected.clientType, selected.category)}` : ''}</p><div className="arm-id">REF-{selected.id.toUpperCase()}<span>Created {fmtDate(selected.createdAt)}</span></div><div className="arm-date-strip">{selected.publishedAt && <span>Published <b>{fmtDate(selected.publishedAt)}</b></span>}{selected.updatedAt && <span>Updated <b>{fmtDate(selected.updatedAt)}</b></span>}</div></div>
      <section className="arm-drawer-section"><h3>REFERRAL INFORMATION</h3><div className="arm-drawer-grid"><Field icon={Users} label="Client type">{value(selected.clientType, selected.category)}</Field><Field icon={Building2} label="Property type">{selected.propertyType}</Field><Field icon={MapPin} label="Location">{locationOf(selected)}</Field><Field icon={MapPin} label="Country">{selected.country}</Field><Field icon={MapPin} label="Postal code">{value(selected.zip, selected.postalCode)}</Field><Field icon={Wallet} label="Budget">{budgetOf(selected)}</Field><Field icon={BadgeCheck} label="Referral fee">{selected.feePercent !== undefined && selected.feePercent !== null ? `${selected.feePercent}%` : null}</Field><Field icon={Wallet} label="Estimated property value">{money(selected.estimatedValueCents != null ? selected.estimatedValueCents / 100 : value(selected.estimatedValue, selected.propertyValue))}</Field><Field icon={Users} label="Applications">{applicationRows(selected).length}</Field>{(selected.latitude != null || selected.longitude != null) && <Field icon={MapPin} label="Coordinates">{[selected.latitude, selected.longitude].filter(item => item != null).join(', ')}</Field>}</div></section>
      <section className="arm-drawer-section"><h3>POSTED BY</h3><div className="arm-drawer-poster"><div className="arm-avatar">{String(value(selected.creatorName, posterOf(selected)?.displayName, posterOf(selected)?.name, 'P')).trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div><div><b>{value(selected.creatorName, posterOf(selected)?.displayName, posterOf(selected)?.name, 'Professional')}</b><span>{value(selected.creatorEmail, posterOf(selected)?.email, 'Email not provided')}</span>{posterOf(selected)?.phone && <span>{posterOf(selected).phone}</span>}{(selected.creatorBrokerage || posterOf(selected)?.brokerageName) && <span>{value(selected.creatorBrokerage, posterOf(selected)?.brokerageName)}</span>}<small>Email verification: {posterOf(selected)?.emailVerified === true ? 'Verified' : posterOf(selected)?.emailVerified === false ? 'Not verified' : 'Not provided'} · Professional verification: {value(posterOf(selected)?.professionalVerificationStatus, posterOf(selected)?.verificationStatus, 'Not provided')}</small></div></div><button className="arm-button arm-profile-button" onClick={() => posterOf(selected) && onNavigate('professionals', posterOf(selected).id)} disabled={!posterOf(selected)}>View Professional Profile <ChevronRight size={15} /></button></section>
      <section className="arm-drawer-section"><h3>REFERRAL DESCRIPTION</h3><p className="arm-full-description">{selected.description || 'Not provided'}</p>{selected.preferences && <><h4>Preferences</h4><p className="arm-full-description">{selected.preferences}</p></>}</section>
      <section className="arm-drawer-section"><h3>APPLICATIONS</h3><div className="arm-app-total"><b>{applicationRows(selected).length}</b><span>Total applications</span></div><div className="arm-app-statuses">{['pending', 'shortlisted', 'accepted', 'rejected'].map(status => <div key={status}><span>{statusLabel(status)}</span><b>{applicationRows(selected).filter(app => String(app.status || '').toLowerCase() === status).length}</b></div>)}</div><button className="arm-button arm-button-primary arm-profile-button" onClick={() => onNavigate('applications', selected.id)}>View Applications <ChevronRight size={15} /></button></section>
      <section className="arm-drawer-section"><h3>ACTIVITY</h3>{drawerActivity.length ? <div className="arm-timeline">{drawerActivity.map(event => <div key={event.id} className="arm-timeline-item"><i /><span>{fmtDate(event.createdAt)}</span><b>{value(event.title, event.action, event.type, 'Activity')}</b><small>{value(event.body, event.description)}</small></div>)}</div> : <div className="arm-no-activity"><Activity size={16} />No activity records are available for this referral.</div>}</section></div>
      <footer className="arm-drawer-footer"><button className="arm-button arm-button-primary" onClick={() => onNavigate('applications', selected.id)}><Users size={15} /> View Applications</button>{canModerate && ['published', 'paused'].includes(normalizedStatus(selected)) && <button className="arm-button" onClick={() => openConfirm(selected, normalizedStatus(selected) === 'paused' ? 'published' : 'paused')}>{normalizedStatus(selected) === 'paused' ? <Play size={15} /> : <Pause size={15} />}{normalizedStatus(selected) === 'paused' ? 'Resume Referral' : 'Pause Referral'}</button>}{canClose && !['closed', 'archived'].includes(normalizedStatus(selected)) && <button className="arm-button" onClick={() => openConfirm(selected, 'closed')}><X size={15} /> Close Referral</button>}{isSuperAdmin && <button className="arm-icon-button arm-danger-quiet" title="More actions" onClick={() => setMoreFor(moreFor === selected.id ? null : selected.id)}><MoreHorizontal size={18} /></button>}{isSuperAdmin && moreFor === selected.id && <div className="arm-footer-menu"><button onClick={() => openConfirm(selected, 'suspended')}><ShieldAlert size={14} /> Suspend Referral</button><button onClick={() => openConfirm(selected, 'archived')}><Archive size={14} /> Archive Referral</button><button className="danger" onClick={() => openConfirm(selected, 'deleted')}><Trash2 size={14} /> Delete Referral</button></div>}</footer></aside></div>, document.body)}

    {confirm && <div className="arm-modal-backdrop" onClick={() => !busy && setConfirm(null)}><div className="arm-modal" onClick={event => event.stopPropagation()}><div className={`arm-modal-icon ${confirm.action === 'deleted' || confirm.action === 'suspended' ? 'danger' : ''}`}>{confirm.action === 'deleted' ? <Trash2 size={21} /> : confirm.action === 'archived' ? <Archive size={21} /> : confirm.action === 'paused' ? <Pause size={21} /> : confirm.action === 'suspended' ? <ShieldAlert size={21} /> : <Check size={21} />}</div><button className="arm-modal-close" onClick={() => setConfirm(null)}><X size={18} /></button><h2>{confirm.action === 'deleted' ? 'Delete referral?' : confirm.action === 'suspended' ? 'Suspend this referral?' : confirm.action === 'paused' ? 'Pause this referral?' : confirm.action === 'published' ? 'Resume this referral?' : confirm.action === 'closed' ? 'Close this referral?' : 'Archive this referral?'}</h2><p>{confirm.action === 'suspended' ? 'This referral will no longer be available as an active opportunity to professionals.' : confirm.action === 'deleted' ? 'Deleting this referral will remove it from active platform operations.' : confirm.action === 'paused' ? 'This temporarily removes the referral from active marketplace visibility.' : confirm.action === 'closed' ? 'This referral will stop accepting applications.' : confirm.action === 'archived' ? 'This referral will be archived and removed from active operations.' : 'This referral will become available in the marketplace again.'}</p>
      {confirm.action === 'suspended' && <><label className="arm-form-label">Suspension reason</label><select className="arm-form-control" value={reason} onChange={event => setReason(event.target.value)}><option value="">Select a reason</option>{['Policy violation', 'Incorrect information', 'Duplicate referral', 'User requested', 'Under investigation', 'Other'].map(option => <option key={option}>{option}</option>)}</select><label className="arm-form-label">Optional notes</label><textarea className="arm-form-control" rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Add context for the audit record" /></>}
      {confirm.action === 'deleted' && (applicationRows(confirm.referral).length || agreements.some(item => item.referralId === confirm.referral.id)) ? <div className="arm-related-warning">This referral has related applications or agreements and cannot be permanently deleted. It can be archived instead.</div> : confirm.action === 'deleted' && <label className="arm-delete-confirm"><input type="checkbox" checked={reason === 'DELETE'} onChange={event => setReason(event.target.checked ? 'DELETE' : '')} /> I understand this permanent deletion cannot be undone.</label>}
      <div className="arm-modal-actions"><button className="arm-button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button><button className={`arm-button ${confirm.action === 'deleted' || confirm.action === 'suspended' ? 'arm-button-danger' : 'arm-button-primary'}`} disabled={busy || (confirm.action === 'suspended' && !reason) || (confirm.action === 'deleted' && (reason !== 'DELETE' || applicationRows(confirm.referral).length > 0 || agreements.some(item => item.referralId === confirm.referral.id)))} onClick={activeAction}>{busy ? 'Saving…' : confirm.action === 'deleted' ? 'Delete Referral' : statusLabel(confirm.action) + ' Referral'}</button></div>
    </div></div>}
  </div>;
}

