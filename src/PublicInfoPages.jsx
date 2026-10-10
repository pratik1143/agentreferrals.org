import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BadgeCheck, Building2, ChevronDown, Compass, Handshake, LockKeyhole, MapPin, Menu, Search, ShieldCheck, Sparkles, UsersRound, X, Zap } from 'lucide-react';
import './public-info-pages.css';
import MarketplaceExperience from './PublicMarketplace';
import { LAUNCH_CTA, MEMBER_LOGIN_CTA, PUBLIC_ACCESS_TITLE, PUBLIC_FAQS } from './public-offer';
import { LEGAL_SUPPORT_EMAIL } from './legal-policy';

const pages = [
  { path: '/how-it-works', label: 'How it works' },
  { path: '/marketplace', label: 'Marketplace' },
  { path: '/why-agentreferrals', label: 'Why AgentReferrals' },
  { path: '/faq', label: 'FAQ' },
  { path: '/about', label: 'About' },
];

function MarketingHeader({ active, onStartAuth }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const start = mode => { setMenuOpen(false); onStartAuth(mode); };
  return <header className="infoHeader">
    <a className="infoBrand" href="/" aria-label="AgentReferrals home"><img src="/agentreferrals-mark.svg" alt=""/><span>Agent<b>Referrals</b></span></a>
    <button className="infoMenuButton" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
    <nav className={`infoNav ${menuOpen ? 'is-open' : ''}`} aria-label="Public navigation">
      {pages.map(page => <a key={page.path} href={page.path} className={active === page.path ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>{page.label}</a>)}
      <div className="infoNavActions"><button className="infoLogin" onClick={() => start('signin')}>{MEMBER_LOGIN_CTA}</button><button className="infoJoin" onClick={() => start('signup')}>{LAUNCH_CTA} <ArrowRight size={16}/></button></div>
    </nav>
  </header>;
}

function MarketingFooter({ onStartAuth }) {
  return <>
    <section className="infoFinalCta"><div className="infoFinalOrb infoFinalOrbLeft"/><div className="infoFinalOrb infoFinalOrbRight"/><div className="infoFinalInner"><span className="infoFinalIcon"><Sparkles size={17}/></span><span className="infoFinalEyebrow"><i/> YOUR NEXT CONNECTION STARTS HERE</span><h2>Let’s make the<br/><em>introduction.</em></h2><p>Join professionals building better business through better relationships.</p><button className="infoFinalButton" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={17}/></button><small><LockKeyhole size={13}/> Free public preview · Member access is coming soon</small></div></section>
    <footer className="infoFooter"><div className="infoFooterTop"><div className="infoFooterBrand"><a className="infoBrand" href="/"><img src="/agentreferrals-logo.svg" alt="AgentReferrals"/><span className="sr-only">AgentReferrals home</span></a><p>Better connections.<br/>Better business.</p></div><div className="infoFooterGroup"><b>Explore</b><a href="/how-it-works">How it works</a><a href="/marketplace">Marketplace</a><a href="/why-agentreferrals">Why AgentReferrals</a></div><div className="infoFooterGroup"><b>Resources</b><a href="/faq">Frequently asked questions</a><a href="/about">About us</a><a href="/privacy">Privacy questions</a></div><div className="infoFooterGroup"><b>Get started</b><button onClick={() => onStartAuth('signin')}>{MEMBER_LOGIN_CTA}</button><button onClick={() => onStartAuth('signup')}>{LAUNCH_CTA}</button></div></div><div className="infoFooterBottom"><span>© 2026 AgentReferrals.org. All rights reserved.</span><span>Built for trusted introductions <i>✦</i></span><a href="/privacy">Privacy questions</a></div></footer>
  </>;
}

function PageFrame({ page, onStartAuth, children }) {
  const progressRef = useRef(null);
  useEffect(() => {
    const items = [...document.querySelectorAll('.infoReveal')];
    if (!('IntersectionObserver' in window)) { items.forEach(item => item.classList.add('is-visible')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .12, rootMargin: '0px 0px -24px 0px' });
    items.forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [page]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); cancelAnimationFrame(frame); };
  }, []);
  return <div className="infoSite"><div className="infoProgress" aria-hidden="true"><span ref={progressRef}/></div><MarketingHeader active={page} onStartAuth={onStartAuth}/><div className="infoLaunchStatus"><span><i/>{PUBLIC_ACCESS_TITLE}</span><button onClick={() => onStartAuth('signup')}>Explore the free public preview · {LAUNCH_CTA} <ArrowRight size={13}/></button></div>{children}<MarketingFooter onStartAuth={onStartAuth}/></div>;
}

function PageHero({ eyebrow, title, accent, text, icon: Icon = Sparkles, actions }) {
  return <section className="infoHero"><div className="infoHeroGlow"/><div className="infoHeroCopy infoReveal"><span className="infoEyebrow"><Icon size={15}/>{eyebrow}</span><h1>{title} <em>{accent}</em></h1><p>{text}</p>{actions}</div><div className="infoHeroOrbit" aria-hidden="true"><span/><i/><b/></div></section>;
}

function HowItWorks({ onStartAuth }) {
  const steps = [
    { n: '01', icon: UsersRound, title: 'Build your professional profile', body: 'Share your markets, experience, and the way you work. Complete verification so other professionals know who they are meeting.' },
    { n: '02', icon: Compass, title: 'Find the right opportunity', body: 'Browse buyer and seller referral opportunities by market, type, and the context that matters to your business.' },
    { n: '03', icon: Handshake, title: 'Make a thoughtful introduction', body: 'Apply with a short note and your broker contact details. The referral owner can review applicants and choose the best fit.' },
    { n: '04', icon: BadgeCheck, title: 'Keep the handoff moving', body: 'Follow the application, agreement, and next steps in one professional workspace while client details remain protected.' },
  ];
  return <PageFrame page="/how-it-works" onStartAuth={onStartAuth}>
    <PageHero eyebrow="A CLEAR PATH TO A BETTER INTRODUCTION" title="Good referrals, " accent="step by step." text="Preview the planned member workflow: refer clients beyond your market, find local opportunities, and agree the handoff terms. Member access is coming soon." actions={<button className="infoPrimary" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={17}/></button>}/>
    <main className="infoContent"><div className="infoSectionHeading infoReveal"><span className="infoEyebrow">THE REFERRAL JOURNEY</span><h2>From first hello to <em>follow-through.</em></h2><p>Each step is designed around trust, clarity, and the people behind the opportunity.</p></div><div className="journeyGrid">{steps.map(({ n, icon: Icon, title, body }, index) => <article className="journeyCard infoReveal" style={{ '--delay': `${index * 90}ms` }} key={n}><div className="journeyTop"><span>{n}</span><i><Icon size={21}/></i></div><h3>{title}</h3><p>{body}</p><div className="journeyLine"><span/></div></article>)}</div><div className="infoCallout infoReveal"><div className="calloutIcon"><ShieldCheck size={22}/></div><div><b>Client privacy stays at the center.</b><p>Public opportunity previews leave out identifying client details. Private information belongs in a trusted, appropriate conversation.</p></div><LockKeyhole size={19} className="calloutLock"/></div></main>
  </PageFrame>;
}

function Marketplace({ onStartAuth }) {
  return <PageFrame page="/marketplace" onStartAuth={onStartAuth}><MarketplaceExperience onStartAuth={onStartAuth}/></PageFrame>;
}

function WhyPage({ onStartAuth }) {
  const benefits = [
    { icon: ShieldCheck, label: 'Professional trust', title: 'Know who is in your network', body: 'Profiles and verification help professionals make more confident connections across local markets.' },
    { icon: LockKeyhole, label: 'Privacy by design', title: 'Share context without exposing clients', body: 'Opportunity previews keep client identity private while giving receiving professionals enough information to assess fit.' },
    { icon: Handshake, label: 'Built for follow-through', title: 'Keep the relationship moving', body: 'Applications, agreements, and updates stay connected to the opportunity from first interest onward.' },
  ];
  return <PageFrame page="/why-agentreferrals" onStartAuth={onStartAuth}>
    <PageHero eyebrow="BUILT FOR PEOPLE WHO WORK THROUGH TRUST" title="Relationships are the " accent="real advantage." text="AgentReferrals gives real-estate professionals a clearer way to connect, share opportunities, and build business together." actions={<button className="infoPrimary" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={17}/></button>}/>
    <main className="infoContent"><div className="whyBanner infoReveal"><div className="whyBannerOrb"/><div><span className="infoEyebrow">BETTER BUSINESS, THROUGH BETTER CONNECTIONS</span><h2>Local knowledge.<br/><em>Wider reach.</em></h2></div><div className="whyNetwork"><div className="networkNode">JR</div><span/><div className="networkNode nodeTwo">MP</div><span/><div className="networkNode nodeThree">AL</div><p>Professionals connecting across markets</p></div></div><div className="benefitDetailGrid">{benefits.map(({ icon: Icon, label, title, body }, index) => <article className="benefitDetail infoReveal" style={{ '--delay': `${index * 85}ms` }} key={label}><div className="benefitDetailIcon"><Icon size={21}/></div><span>{label}</span><h3>{title}</h3><p>{body}</p></article>)}</div><div className="infoCallout infoReveal"><div className="calloutIcon"><UsersRound size={22}/></div><div><b>Made for independent professionals and teams.</b><p>Whether you are building your business in one city or connecting with partners across regions, the same trusted workflow keeps everyone in sync.</p></div><button className="infoTextAction" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={15}/></button></div></main>
  </PageFrame>;
}

const faqItems = PUBLIC_FAQS;

function FaqPage({ onStartAuth }) {
  const [open, setOpen] = useState(0);
  return <PageFrame page="/faq" onStartAuth={onStartAuth}>
    <PageHero eyebrow="HELPFUL ANSWERS, BEFORE YOU JOIN" title="A few good " accent="questions." text="Learn how the professional network, public marketplace preview, and referral workflow fit together."/>
    <main className="infoContent faqContent"><div className="faqSide infoReveal"><span className="faqBigIcon"><Sparkles size={25}/></span><span className="infoEyebrow">GOOD TO KNOW</span><h2>Clear answers make better <em>connections.</em></h2><p>Still have a question? Contact the AgentReferrals team directly.</p><a className="infoPrimary" href={`mailto:${LEGAL_SUPPORT_EMAIL}`}>Contact support <ArrowRight size={16}/></a></div><div className="faqRows infoReveal">{faqItems.map(([question, answer], index) => <article className={`faqRow ${open === index ? 'is-open' : ''}`} key={question}><button aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}><span className="faqRowIndex">0{index + 1}</span><b>{question}</b><i><ChevronDown size={18}/></i></button><div className="faqRowAnswer"><p>{answer}</p></div></article>)}</div></main>
  </PageFrame>;
}

function AboutPage({ onStartAuth }) {
  return <PageFrame page="/about" onStartAuth={onStartAuth}>
    <PageHero eyebrow="ABOUT AGENTREFERRALS" title="Good people, " accent="right where you need them." text="AgentReferrals is a professional real-estate network designed to make trusted introductions across markets feel clear, secure, and human." actions={<button className="infoPrimary" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={17}/></button>}/>
    <main className="infoContent aboutContent"><section className="aboutStory infoReveal"><div className="aboutStoryMark"><img src="/agentreferrals-mark.svg" alt="AgentReferrals mark"/></div><div><span className="infoEyebrow">OUR PURPOSE</span><h2>Real estate moves through <em>relationships.</em></h2><p>A great client introduction can cross a city, a state, or a whole country. We are creating a dedicated place for professionals to find the right partner, protect client privacy, and manage the next steps with confidence.</p><p>AgentReferrals brings opportunity discovery, professional profiles, applications, and agreement workflows into one connected experience.</p></div></section><div className="aboutValues">{[{icon: Handshake, title: 'People first', text: 'Every opportunity begins with a relationship.'}, {icon: ShieldCheck, title: 'Trust matters', text: 'Professional verification supports a stronger network.'}, {icon: LockKeyhole, title: 'Privacy always', text: 'Client information deserves careful handling.'}].map(({ icon: Icon, title, text }, index) => <article className="aboutValue infoReveal" style={{ '--delay': `${index * 80}ms` }} key={title}><i><Icon size={21}/></i><h3>{title}</h3><p>{text}</p></article>)}</div><section className="aboutClosing infoReveal"><span className="infoEyebrow">LET’S MAKE THE INTRODUCTION</span><h2>Your next connection starts <em>here.</em></h2><button className="infoPrimary" onClick={() => onStartAuth('signup')}>{LAUNCH_CTA} <ArrowRight size={16}/></button></section></main>
  </PageFrame>;
}

export default function PublicInfoPages({ page, onStartAuth }) {
  switch (page) {
    case '/how-it-works': return <HowItWorks onStartAuth={onStartAuth}/>;
    case '/marketplace': return <Marketplace onStartAuth={onStartAuth}/>;
    case '/why-agentreferrals': return <WhyPage onStartAuth={onStartAuth}/>;
    case '/faq': return <FaqPage onStartAuth={onStartAuth}/>;
    case '/about': return <AboutPage onStartAuth={onStartAuth}/>;
    default: return null;
  }
}
