import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, Flag, History, MapPin, PauseCircle, PlayCircle, RefreshCw, ShieldAlert, ShieldCheck, Trash2, Undo2, UserCheck, X } from 'lucide-react';
import { db, functions } from './firebase';

const typeOf = row => String(row.clientType || row.referralType || row.category || '').toLowerCase().replace(/ referral$/, '').trim();
const isDraft = row => String(row.status).toLowerCase() === 'draft';
const dateOf = row => row.createdAt?.toDate?.() || new Date(row.createdAt || 0);
const pretty = value => String(value || 'Not provided').replaceAll('_', ' ');
const fmt = date => date && date.getTime() ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded';
const fmtTime = date => date && date.getTime() ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

const ACTIONS = {
  WARN_USER: { label: 'Send warning', tone: 'amber', icon: AlertTriangle, hint: 'The professional gets an in-app notice about suspicious activity. Nothing else changes.', chips: ['Suspicious activity on posted referrals', 'Misleading or duplicate referral posts', 'Unverifiable client details'] },
  HOLD_USER: { label: 'Put on hold', tone: 'orange', icon: PauseCircle, hint: 'Their live referrals are paused and they cannot post or apply until you release the hold. They can still sign in.', chips: ['Under review for suspicious activity', 'Pending identity or licence re-check', 'Multiple complaints from other professionals'] },
  RELEASE_HOLD: { label: 'Release hold', tone: 'green', icon: PlayCircle, hint: 'Paused referrals go live again and marketplace access returns.', chips: ['Review completed — no violation found', 'Issue resolved with the professional'] },
  SUSPEND_USER: { label: 'Block account', tone: 'red', icon: Ban, hint: 'Sign-in is disabled immediately. Use this for confirmed fraud or serious violations.', chips: ['Confirmed fraudulent activity', 'Repeated violations after warning', 'Impersonation or fake licence'] },
  REACTIVATE_USER: { label: 'Unblock account', tone: 'green', icon: UserCheck, hint: 'Sign-in is restored and the account becomes active again.', chips: ['Block lifted after review', 'Blocked in error'] },
  MODERATE_REFERRAL: { label: 'Flag for review', tone: 'amber', icon: Flag, hint: 'The post is hidden from the marketplace while you review it.', chips: ['Looks like a fake or duplicate lead', 'Client details cannot be verified'] },
  CANCEL_REFERRAL: { label: 'Remove post', tone: 'red', icon: Trash2, hint: 'The post is cancelled and removed from the marketplace.', chips: ['Fraudulent lead', 'Violates platform rules'] },
  RESTORE_REFERRAL: { label: 'Restore post', tone: 'green', icon: Undo2, hint: 'The post becomes visible in the marketplace again.', chips: ['Reviewed — post is fine'] }
};
const AUDIT_LABELS = { USER_WARNED: ['Warning sent', 'amber'], USER_HELD: ['Put on hold', 'orange'], USER_HOLD_RELEASED: ['Hold released', 'green'], USER_SUSPENDED: ['Account blocked', 'red'], USER_REACTIVATED: ['Account unblocked', 'green'] };

export default function ProfessionalModeration({ user, onUserPatch }) {
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState('');
  const userId = user.id;
  const account = String(user.accountStatus || '').toLowerCase();
  const state = account === 'suspended' ? 'blocked' : account === 'on_hold' ? 'hold' : 'active';
  const warnings = Number(user.warningCount || 0);

  useEffect(() => {
    setLoading(true); setRows([]); setHistory([]); setError(''); setPending(null); setNotice(''); setFilter('all');
    if (!db) { setError('Referral service is unavailable.'); setLoading(false); return undefined; }
    const offRows = onSnapshot(query(collection(db, 'referrals'), where('creatorProfessionalId', '==', userId)), snap => {
      setRows(snap.docs.map(d => ({ ...d.data(), id: d.id })).sort((a, b) => dateOf(b) - dateOf(a)));
      setLoading(false);
    }, err => { setError(err.message || 'Could not load referrals.'); setLoading(false); });
    const offLog = onSnapshot(query(collection(db, 'audit_logs'), where('targetId', '==', userId)), snap => {
      setHistory(snap.docs.map(d => ({ ...d.data(), id: d.id })).filter(item => AUDIT_LABELS[item.action]).sort((a, b) => dateOf(b) - dateOf(a)));
    }, () => {});
    return () => { offRows(); offLog(); };
  }, [userId]);

  const posts = rows.filter(row => !isDraft(row));
  const stats = useMemo(() => ({
    buyer: posts.filter(row => typeOf(row) === 'buyer').length,
    seller: posts.filter(row => typeOf(row) === 'seller').length,
    live: posts.filter(row => ['open', 'published', 'active'].includes(String(row.status).toLowerCase())).length,
    flagged: posts.filter(row => ['under_review', 'flagged', 'suspended', 'cancelled'].includes(String(row.status).toLowerCase())).length
  }), [posts]);
  const visible = rows.filter(row => filter === 'all' || (filter === 'draft' ? isDraft(row) : !isDraft(row) && typeOf(row) === filter));

  const start = (type, target = null) => { setPending({ type, target }); setReason(''); setNotice(''); };
  const submit = async () => {
    const text = reason.trim();
    if (text.length < 8) { setNotice('Add a short reason (at least 8 characters). It is saved in the audit log.'); return; }
    if (!functions) { setNotice('The secure admin service is unavailable. Reload and retry.'); return; }
    setBusy(true); setNotice('');
    try {
      const { type, target } = pending;
      await httpsCallable(functions, 'adminAction')({ action: type, targetId: target ? target.id : userId, reason: text });
      if (!target) {
        if (type === 'WARN_USER') onUserPatch({ warningCount: warnings + 1 });
        if (type === 'HOLD_USER') onUserPatch({ accountStatus: 'on_hold' });
        if (type === 'RELEASE_HOLD' || type === 'REACTIVATE_USER') onUserPatch({ accountStatus: 'ACTIVE' });
        if (type === 'SUSPEND_USER') onUserPatch({ accountStatus: 'suspended' });
      }
      setNotice(`✓ ${ACTIONS[type].label} completed.`);
      setPending(null); setReason('');
    } catch (err) {
      const code = String(err?.code || '').replace(/^functions\//, '');
      setNotice(code === 'permission-denied' ? (err.message || 'You do not have permission for this action.') : code === 'not-found' || code === 'internal' ? 'The moderation service is not reachable. Deploy the latest Cloud Functions and retry.' : err.message || 'Action failed. Try again.');
    } finally { setBusy(false); }
  };

  const meta = pending ? ACTIONS[pending.type] : null;
  const stateInfo = { active: ['Active', 'green', ShieldCheck, 'No restrictions on this account.'], hold: ['On hold', 'orange', PauseCircle, user.holdReason || 'Posting and applying are paused.'], blocked: ['Blocked', 'red', Ban, 'Sign-in is disabled for this account.'] }[state];
  const StateIcon = stateInfo[2];

  return <div className="vmod">
    <section className={'vmod-hero vmod-' + stateInfo[1]}>
      <span className="vmod-hero-icon"><StateIcon size={26}/></span>
      <div className="vmod-hero-copy">
        <small>ACCOUNT STATE</small>
        <h2>{stateInfo[0]}{warnings > 0 && <em><AlertTriangle size={12}/> {warnings} warning{warnings === 1 ? '' : 's'}</em>}</h2>
        <p>{stateInfo[3]}{user.lastWarningReason && warnings > 0 ? ` Last warning: ${user.lastWarningReason}` : ''}</p>
      </div>
      <div className="vmod-hero-actions">
        <button type="button" className="vmod-btn amber" onClick={() => start('WARN_USER')}><AlertTriangle size={15}/> Warn</button>
        {state === 'hold' ? <button type="button" className="vmod-btn green" onClick={() => start('RELEASE_HOLD')}><PlayCircle size={15}/> Release hold</button>
          : state === 'active' && <button type="button" className="vmod-btn orange" onClick={() => start('HOLD_USER')}><PauseCircle size={15}/> Hold</button>}
        {state === 'blocked' ? <button type="button" className="vmod-btn green" onClick={() => start('REACTIVATE_USER')}><UserCheck size={15}/> Unblock</button>
          : <button type="button" className="vmod-btn red" onClick={() => start('SUSPEND_USER')}><Ban size={15}/> Block</button>}
      </div>
    </section>

    {pending && <section className={'vmod-confirm vmod-' + meta.tone} role="dialog" aria-label={meta.label}>
      <header><span><meta.icon size={18}/></span><div><b>{meta.label}{pending.target ? ` · ${pending.target.title || 'Untitled referral'}` : ''}</b><p>{meta.hint}</p></div><button type="button" aria-label="Cancel" onClick={() => setPending(null)}><X size={16}/></button></header>
      <div className="vmod-chips">{meta.chips.map(chip => <button type="button" key={chip} onClick={() => setReason(chip)}>{chip}</button>)}</div>
      <textarea rows={3} value={reason} maxLength={500} onChange={event => setReason(event.target.value)} placeholder="Reason (shown to the professional for warnings and holds, and saved in the audit log)"/>
      <footer><small>{reason.trim().length}/500</small><div><button type="button" className="vmod-ghost" onClick={() => setPending(null)} disabled={busy}>Cancel</button><button type="button" className={'vmod-btn ' + meta.tone} disabled={busy} onClick={submit}>{busy ? <RefreshCw size={14} className="verificationSpinner"/> : <meta.icon size={14}/>} Confirm</button></div></footer>
    </section>}
    {notice && <p className={'vmod-notice' + (notice.startsWith('✓') ? ' ok' : '')} role="status">{notice}</p>}

    <section className="vmod-stats">
      {[['Buyer leads', stats.buyer, 'blue'], ['Seller leads', stats.seller, 'violet'], ['Live now', stats.live, 'green'], ['Flagged / removed', stats.flagged, stats.flagged ? 'red' : 'slate']].map(([name, value, tone]) => <div key={name} className={'vmod-stat ' + tone}><strong>{value}</strong><span>{name}</span></div>)}
    </section>

    <section className="vmod-card">
      <header><div><h3>Posted leads</h3><p>Everything this professional has posted. Open a lead to see details, then flag or remove it.</p></div>
        <div className="vmod-tabs">{[['all', 'All', rows.length], ['buyer', 'Buyer', stats.buyer], ['seller', 'Seller', stats.seller], ['draft', 'Drafts', rows.filter(isDraft).length]].map(([key, name, count]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{name}<b>{count}</b></button>)}</div>
      </header>
      {loading ? <div className="vmod-empty"><RefreshCw size={22} className="verificationSpinner"/><b>Loading leads…</b></div>
        : error ? <div className="vmod-empty"><ShieldAlert size={24}/><b>{error}</b></div>
        : !visible.length ? <div className="vmod-empty"><ShieldCheck size={26}/><b>No {filter === 'all' ? 'leads' : filter === 'draft' ? 'drafts' : filter + ' leads'} posted</b><span>New posts from this professional appear here instantly.</span></div>
        : <ul className="vmod-leads">{visible.map(row => {
          const status = String(row.status || '').toLowerCase();
          const hidden = ['under_review', 'flagged', 'suspended'].includes(status);
          const gone = status === 'cancelled';
          return <li key={row.id} className={'vmod-lead' + (open === row.id ? ' open' : '')}>
            <button type="button" className="vmod-lead-row" aria-expanded={open === row.id} onClick={() => setOpen(open === row.id ? '' : row.id)}>
              <span className={'vmod-type ' + (typeOf(row) === 'seller' ? 'seller' : 'buyer')}>{typeOf(row) === 'seller' ? 'Seller' : typeOf(row) === 'buyer' ? 'Buyer' : 'Lead'}</span>
              <span className="vmod-lead-title"><b>{row.title || 'Untitled referral'}</b><small><MapPin size={12}/>{[row.city, row.state, row.zip].filter(Boolean).join(', ') || 'Location not provided'} · {fmt(dateOf(row))}</small></span>
              <span className={'vmod-status ' + (gone ? 'red' : hidden ? 'amber' : isDraft(row) ? 'slate' : 'green')}>{pretty(row.status)}</span>
              <ChevronDown size={16}/>
            </button>
            {open === row.id && <div className="vmod-lead-body">
              <dl><div><dt>Property</dt><dd>{row.propertyType || 'Not provided'}</dd></div><div><dt>Referral fee</dt><dd>{row.feePercent != null ? `${row.feePercent}%` : 'Not provided'}</dd></div><div><dt>Budget / value</dt><dd>{row.minValue || row.maxValue ? `${row.minValue || '—'} – ${row.maxValue || '—'}` : 'Not provided'}</dd></div><div><dt>Referral ID</dt><dd>{row.id}</dd></div></dl>
              <p>{row.description || 'No description provided.'}</p>
              {row.moderationReason && <p className="vmod-modnote"><Flag size={13}/> Moderation note: {row.moderationReason}</p>}
              <div className="vmod-lead-actions">
                {!gone && !hidden && !isDraft(row) && <button type="button" className="vmod-btn amber sm" onClick={() => start('MODERATE_REFERRAL', row)}><Flag size={13}/> Flag for review</button>}
                {(hidden || gone) && <button type="button" className="vmod-btn green sm" onClick={() => start('RESTORE_REFERRAL', row)}><Undo2 size={13}/> Restore</button>}
                {!gone && <button type="button" className="vmod-btn red sm" onClick={() => start('CANCEL_REFERRAL', row)}><Trash2 size={13}/> Remove</button>}
              </div>
            </div>}
          </li>;
        })}</ul>}
    </section>

    <section className="vmod-card">
      <header><div><h3><History size={16}/> Moderation history</h3><p>Warnings, holds and blocks recorded for this account.</p></div></header>
      {history.length ? <ol className="vmod-timeline">{history.map(item => { const [name, tone] = AUDIT_LABELS[item.action]; return <li key={item.id} className={tone}><i/><div><b>{name}</b><small>{fmtTime(dateOf(item))}{item.actorEmail ? ` · by ${item.actorEmail}` : ''}</small>{item.reason && <p>{item.reason}</p>}</div></li>; })}</ol>
        : <div className="vmod-empty small"><CheckCircle2 size={22}/><b>Clean record</b><span>No warnings, holds or blocks yet.</span></div>}
    </section>
  </div>;
}
