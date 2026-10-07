import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Handshake, MapPin, ChevronDown } from 'lucide-react';
import { db } from './firebase';

const typeOf = row => String(row.clientType || row.referralType || row.category || '').toLowerCase().replace(/ referral$/, '').trim();
const isDraft = row => String(row.status).toLowerCase() === 'draft';
const dateOf = row => row.createdAt?.toDate?.() || new Date(row.createdAt || 0);
const label = value => String(value || 'Not provided').replaceAll('_', ' ');

export default function VerificationReferrals({ userId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setLoading(true); setRows([]); setError(''); setFilter('all');
    if (!db) { setError('Referral service is unavailable.'); setLoading(false); return; }
    return onSnapshot(query(collection(db, 'referrals'), where('creatorProfessionalId', '==', userId)), snapshot => {
      setRows(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })).sort((a, b) => dateOf(b) - dateOf(a)));
      setLoading(false); setError('');
    }, err => { setError(err.message || 'Could not load referrals.'); setLoading(false); });
  }, [userId, retry]);
  const posts = rows.filter(row => !isDraft(row));
  const counts = { all: rows.length, buyer: posts.filter(row => typeOf(row) === 'buyer').length, seller: posts.filter(row => typeOf(row) === 'seller').length, draft: rows.filter(isDraft).length };
  const visible = rows.filter(row => filter === 'all' || (filter === 'draft' ? isDraft(row) : !isDraft(row) && typeOf(row) === filter));
  return <div className="verificationReferralPanel">
    <header><div><h2>Referral posts</h2><p>Buyer and seller posts created by this professional. Drafts are counted separately.</p></div><Handshake size={25}/></header>
    {loading ? <div className="verificationActivityLoading" role="status"><span/><span/><b>Loading referrals…</b></div> : error ? <div className="verificationFeedback" role="alert">{error}<button onClick={() => setRetry(value => value + 1)}>Retry</button></div> : <>
      <div className="verificationReferralCounts">
        {[['all', 'All referrals'], ['buyer', 'Buyer posts'], ['seller', 'Seller posts'], ['draft', 'Drafts']].map(([key, name]) => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={filter === key ? 'active' : ''}><span>{name}</span><strong>{counts[key]}</strong></button>)}
      </div>
      <div className="verificationReferralList">
        {visible.map(row => <details key={row.id} className="verificationReferralRow"><summary><span className="verificationReferralIcon"><Handshake size={20}/></span><span className="verificationReferralTitle"><b>{row.title || 'Untitled referral'}</b><small><MapPin size={12}/>{[row.city, row.state, row.zip].filter(Boolean).join(', ') || 'Location not provided'}</small></span><span className="verificationReferralType">{label(typeOf(row))}</span><span className="verificationReferralType">{label(row.status)}</span><ChevronDown size={16}/></summary><div className="verificationReferralDetails"><dl><div><dt>Created</dt><dd>{dateOf(row).getTime() ? dateOf(row).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Not recorded'}</dd></div><div><dt>Property type</dt><dd>{row.propertyType || 'Not provided'}</dd></div><div><dt>Referral fee</dt><dd>{row.feePercent != null ? `${row.feePercent}%` : 'Not provided'}</dd></div><div><dt>Referral ID</dt><dd>{row.id}</dd></div></dl><p>{row.description || 'No description provided.'}</p></div></details>)}
        {!visible.length && <div className="verificationDocumentEmpty"><Handshake size={28}/><b>No {filter === 'all' ? 'referrals' : filter === 'draft' ? 'drafts' : `${filter} posts`} yet</b><span>This professional’s matching referrals will appear here automatically.</span></div>}
      </div>
    </>}
  </div>;
}
