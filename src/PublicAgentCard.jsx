import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Globe2, Languages, Loader2, MapPin, Share2, Sparkles, UserRound } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import './public-agent-card.css';

export default function PublicAgentCard({ uid }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!uid || !db) { setLoading(false); setError('This card could not be opened.'); return undefined; }
    getDoc(doc(db, 'public_agent_cards', uid)).then(snapshot => {
      if (!active) return;
      if (snapshot.exists()) setCard(snapshot.data());
      else setError('This professional card is not available yet.');
    }).catch(() => { if (active) setError('We could not load this card. Please try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [uid]);

  const join = () => { window.location.href = `/register?ref=${encodeURIComponent(uid)}`; };
  const name = card?.displayName || 'AgentReferrals Professional';
  const serviceAreas = Array.isArray(card?.serviceAreas) ? card.serviceAreas : [];
  const specialties = Array.isArray(card?.specialties) ? card.specialties : [];
  const languages = Array.isArray(card?.languages) ? card.languages : [];
  const safePhotoURL = /^https?:\/\//i.test(card?.photoURL || '') ? card.photoURL : '';
  const safeWebsite = /^https:\/\//i.test(card?.website || '') ? card.website : '';

  return <main className="public-agent-card-page">
    <header className="public-agent-card-nav"><a href="/" className="public-agent-brand"><img src="/agentreferrals-mark.svg" alt=""/><span>Agent<strong>Referrals</strong></span></a><span><i/> PROFESSIONAL NETWORK</span></header>
    {loading ? <div className="public-agent-state"><Loader2 className="is-spinning" size={24}/><p>Opening professional card…</p></div> : error ? <section className="public-agent-state"><span className="public-agent-state-icon"><UserRound size={21}/></span><h1>Card unavailable</h1><p>{error}</p><a className="public-agent-primary" href="/">Visit AgentReferrals <ArrowRight size={16}/></a></section> : <>
      <div className="public-agent-eyebrow"><Sparkles size={14}/> A PROFESSIONAL INTRODUCTION</div>
      <article className="public-agent-card">
        <div className="public-agent-card-art" aria-hidden="true"><i/><i/><i/></div>
        <div className="public-agent-card-head"><span>AGENTREFERRALS <b>·</b> DIGITAL CARD</span><span className="public-agent-chip"><CheckCircle2 size={13}/> NETWORK MEMBER</span></div>
        <div className="public-agent-card-person">
          <span className="public-agent-avatar">{safePhotoURL ? <img src={safePhotoURL} alt=""/> : name.trim().charAt(0).toUpperCase()}</span>
          <div><h1>{name}</h1><p>{card.title || 'Real Estate Professional'}</p></div>
        </div>
        <div className="public-agent-card-rule"/>
        <div className="public-agent-card-meta">
          {card.brokerageName && <span><BriefcaseBusiness size={15}/>{card.brokerageName}</span>}
          {!!serviceAreas.length && <span><MapPin size={15}/>{serviceAreas.slice(0, 3).join(' · ')}</span>}
          {!!card.yearsExperience && <span><CheckCircle2 size={15}/>{card.yearsExperience} experience</span>}
          {!!safeWebsite && <a href={safeWebsite} target="_blank" rel="noreferrer"><Globe2 size={15}/>Professional website <ArrowRight size={13}/></a>}
        </div>
        {!!specialties.length && <div className="public-agent-specialties">{specialties.slice(0, 4).map(item => <span key={item}>{item}</span>)}</div>}
        {!!card.bio && <p className="public-agent-bio">{card.bio}</p>}
        {!!languages.length && <div className="public-agent-languages"><Languages size={14}/>{languages.slice(0, 5).join(' · ')}</div>}
        <footer className="public-agent-card-footer"><span>Trusted introductions start here.</span><Share2 size={17}/></footer>
      </article>
      <section className="public-agent-cta"><div><b>Work with {name.split(' ')[0]} on a referral?</b><p>Create your free professional account to connect and share opportunities.</p></div><button className="public-agent-primary" onClick={join}>Join AgentReferrals <ArrowRight size={16}/></button></section>
      <p className="public-agent-privacy">This card contains professional information the member chose to share. Client details are never displayed here.</p>
    </>}
  </main>;
}
