import { useEffect, useRef } from 'react';
import { ArrowRight, BadgeCheck, Handshake, MapPin, UserRound } from 'lucide-react';

const route = 'M 126 222 C 300 92 375 310 510 190 S 765 100 875 207';
const branch = 'M 510 190 C 620 312 768 305 875 207';

export default function ConnectionJourney() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const routePaths = section.querySelectorAll('.journeyRouteActive');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = section.getBoundingClientRect();
        const travel = Math.max(1, bounds.height - window.innerHeight);
        const progress = reducedMotion ? 1 : Math.max(0, Math.min(1, -bounds.top / travel));
        routePaths.forEach((path, index) => {
          const pathProgress = index === 0 ? progress : Math.max(0, (progress - .42) / .58);
          path.style.strokeDashoffset = String(100 * (1 - pathProgress));
        });
        section.dataset.phase = progress < .28 ? '1' : progress < .6 ? '2' : '3';
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <section className="journeySection" id="network-journey" ref={sectionRef} data-phase="1" aria-label="How an introduction moves through AgentReferrals">
    <div className="journeySticky">
      <div className="journeyHeading reveal">
        <div className="eyebrow"><span/> THE CONNECTION EFFECT</div>
        <h2>One introduction.<br/><span>More possibilities.</span></h2>
        <p>Good referrals move because a person brings the right context to the right professional.</p>
      </div>
      <div className="journeyVisual" aria-label="Illustrated referral connection from one professional to another">
        <div className="journeyVisualGrid" aria-hidden="true"/>
        <div className="journeyHalo" aria-hidden="true"/>
        <svg className="journeyRoutes" viewBox="0 0 1000 390" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="journeyGradient" x1="100" y1="190" x2="890" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#b4dbff"/><stop offset=".5" stopColor="#328cf3"/><stop offset="1" stopColor="#185bd3"/></linearGradient>
            <filter id="journeyGlow" x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="6" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          </defs>
          <path d={route} className="journeyRouteBase"/>
          <path d={branch} className="journeyRouteBase journeyRouteBranch"/>
          <path d={route} pathLength="100" className="journeyRouteActive"/>
          <path d={branch} pathLength="100" className="journeyRouteActive journeyRouteSecond"/>
          <circle className="journeySignal" r="5" fill="#e1f0ff" filter="url(#journeyGlow)"><animateMotion dur="4s" repeatCount="indefinite" path={route}/></circle>
          <circle className="journeySignal journeySignalSecond" r="4" fill="#328cf3" filter="url(#journeyGlow)"><animateMotion dur="3.3s" repeatCount="indefinite" path={branch}/></circle>
        </svg>
        <div className="journeyNode journeyNodeStart"><span className="journeyNodeIcon"><UserRound size={25}/></span><span className="journeyNodeText"><small>01 / THE RELATIONSHIP</small><b>A professional<br/>knows the client.</b></span></div>
        <div className="journeyNode journeyNodeCenter"><span className="journeyNodeIcon"><Handshake size={26}/></span><span className="journeyNodeText"><small>02 / THE HANDOFF</small><b>A trusted<br/>introduction.</b></span></div>
        <div className="journeyNode journeyNodeEnd"><span className="journeyNodeIcon"><MapPin size={26}/></span><span className="journeyNodeText"><small>03 / THE NEXT MARKET</small><b>The right local<br/>professional.</b></span></div>
        <div className="journeyFloatingNote"><BadgeCheck size={17}/><span>Relationships move opportunity forward</span><ArrowRight size={15}/></div>
      </div>
      <div className="journeyIndex" aria-hidden="true"><span>01 <b>Trust</b></span><i/><span>02 <b>Introduction</b></span><i/><span>03 <b>Opportunity</b></span></div>
    </div>
  </section>;
}
