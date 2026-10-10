import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Handshake, MapPin, MoveUpRight, Pause, Play, RotateCcw, ShieldCheck, Signature, Users } from 'lucide-react';
import './home-referral-hero.css';
import { LAUNCH_CTA, PUBLIC_PRICING_NOTE } from './public-offer';

const origin = { name: 'Austin', coordinates: [30.2672, -97.7431] };
const markets = {
  denver: { name: 'Denver', state: 'CO', coordinates: [39.7392, -104.9903], initials: 'DA' },
  nashville: { name: 'Nashville', state: 'TN', coordinates: [36.1627, -86.7816], initials: 'NA' },
};
const steps = [
  { label: 'Introduce', title: 'Your client moves. You refer.', description: city => `In this sample, your client is moving to ${city}. Share the opportunity with professionals who serve that market.`, benefit: 'Create a referral fee opportunity', Icon: Users },
  { label: 'Connect', title: 'Their local expertise. Your handoff.', description: city => `Review interested agents in ${city} and choose the right fit. Receiving agents can find referrals in their own market.`, benefit: 'Find local buyer and seller referrals', Icon: Handshake },
  { label: 'Grow', title: 'Clear terms. A shared opportunity.', description: () => 'Agree the fee, payment conditions and timing, then complete the required signatures. The professionals and brokerages handle payment under those terms.', benefit: 'Agree terms before the handoff', Icon: Signature },
];

function curvedRoute(from, to) {
  const middle = [(from[0] + to[0]) / 2 + 3.6, (from[1] + to[1]) / 2 + 2.8];
  return Array.from({ length: 65 }, (_, index) => {
    const t = index / 64;
    return [0, 1].map(axis => (1 - t) ** 2 * from[axis] + 2 * (1 - t) * t * middle[axis] + t ** 2 * to[axis]);
  });
}

function JourneyMap({ destination, reducedMotion, onReady, onInteract }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const fitRef = useRef(null);
  const callbacks = useRef({ onReady, onInteract });
  callbacks.current = { onReady, onInteract };
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let disposed = false;
    let resizeObserver;
    let resizeFrame;
    let tiles;
    let tileFailures = 0;
    let mapCanvas;
    const pauseOnInteraction = () => callbacks.current.onInteract();
    setReady(false);
    setFailed(false);
    import('leaflet').then(L => {
      if (disposed || !canvasRef.current) return;
      const map = L.map(canvasRef.current, { zoomControl: false, scrollWheelZoom: false, zoomSnap: .25, attributionControl: true, zoomAnimation: !reducedMotion, fadeAnimation: !reducedMotion, minZoom: 3, maxZoom: 8 });
      mapRef.current = map;
      layerRef.current = { L, group: L.layerGroup().addTo(map) };
      tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>' }).addTo(map);
      tiles.on('tileerror', () => { if (++tileFailures >= 4 && !disposed) setFailed(true); });
      tiles.on('tileload', () => { if (!disposed) setFailed(false); });
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      map.on('dragstart', pauseOnInteraction);
      mapCanvas = map.getContainer();
      mapCanvas.addEventListener('pointerdown', pauseOnInteraction);
      mapCanvas.addEventListener('keydown', pauseOnInteraction);
      resizeObserver = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => { if (!disposed) { map.invalidateSize({ pan: false }); fitRef.current?.(); } });
      });
      resizeObserver.observe(canvasRef.current);
      setReady(true);
      callbacks.current.onReady();
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => {
      disposed = true;
      cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      mapCanvas?.removeEventListener('pointerdown', pauseOnInteraction);
      mapCanvas?.removeEventListener('keydown', pauseOnInteraction);
      tiles?.off();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      fitRef.current = null;
    };
  }, [reducedMotion, retry]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;
    const { L, group } = layer;
    group.clearLayers();
    const target = markets[destination];
    const route = curvedRoute(origin.coordinates, target.coordinates);
    L.polyline(route, { color: '#8eafd7', weight: 2, dashArray: '3 8', opacity: .75, interactive: false }).addTo(group);
    const activeRoute = L.polyline(route, { className: 'journey-map-route', color: '#2374e7', weight: 3.5, interactive: false, renderer: L.svg() }).addTo(group);
    const addMarker = (coordinates, label, initials, source) => {
      const icon = L.divIcon({ className: `journey-map-marker ${source ? 'journey-map-marker--source' : 'journey-map-marker--destination'}`, html: `<span class="journey-pin-face">${source ? '<img src="/agentreferrals-mark.svg" alt=""/>' : initials}</span><span class="journey-pin-label"><b>${label}</b><small>${source ? 'Your client connection' : 'Local professional'}</small></span>`, iconSize: [52, 52], iconAnchor: [26, 26] });
      L.marker(coordinates, { icon, title: `${label} — example referral`, keyboard: true }).addTo(group).on('click', () => callbacks.current.onInteract());
    };
    addMarker(origin.coordinates, 'You · Austin', '', true);
    addMarker(target.coordinates, target.name, target.initials, false);
    fitRef.current = () => {
      const compact = map.getSize().x < 450;
      map.fitBounds(L.latLngBounds(route).pad(.15), { paddingTopLeft: compact ? [32, 55] : [70, 65], paddingBottomRight: compact ? [135, 60] : [150, 85], maxZoom: 4.75, animate: false });
      const path = activeRoute.getElement();
      if (path) path.style.setProperty('--route-length', String(path.getTotalLength()));
    };
    fitRef.current();
    const frame = requestAnimationFrame(() => {
      const path = activeRoute.getElement();
      if (path) path.style.setProperty('--route-length', String(path.getTotalLength()));
    });
    return () => cancelAnimationFrame(frame);
  }, [destination, ready, reducedMotion, retry]);

  return <div className="journey-map-scene">
    <div ref={canvasRef} className="journey-map-canvas" aria-label={`Example referral map from Austin to ${markets[destination].name}`}/>
    {!ready && !failed && <div className="journey-map-loading" role="status"><span/><p>Finding the next connection…</p></div>}
    {failed && <div className="journey-map-error" role="status"><MapPin size={18}/><span>The map is temporarily unavailable.</span><button onClick={() => { if (mapRef.current) { mapRef.current.eachLayer(layer => layer.redraw?.()); setFailed(false); } else { setReady(false); setRetry(value => value + 1); } }}>Retry map</button></div>}
    <div className="journey-map-caption"><span/> ILLUSTRATIVE REFERRAL · NO LIVE CLIENT DATA</div>
  </div>;
}

export default function HomeReferralHero({ onJoin }) {
  const heroRef = useRef(null);
  const cardRef = useRef(null);
  const [destination, setDestination] = useState('denver');
  const [stage, setStage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(!document.hidden);
  const [mapReady, setMapReady] = useState(false);
  const current = steps[stage];
  const CurrentIcon = current.Icon;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { setReducedMotion(preference.matches); if (preference.matches) setPlaying(false); };
    preference.addEventListener('change', change);
    const visibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .2 });
    observer.observe(heroRef.current);
    return () => { observer.disconnect(); preference.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (!playing || !visible || !documentVisible || !mapReady || reducedMotion) return;
    if (stage === steps.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setStage(value => value + 1), 4400);
    return () => clearTimeout(timer);
  }, [playing, visible, documentVisible, mapReady, stage, reducedMotion]);

  const replay = () => { setStage(0); setPlaying(!reducedMotion); };
  const showJourney = () => {
    replay();
    if (window.matchMedia('(max-width: 960px)').matches) cardRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
  };

  return <section ref={heroRef} className="referralHero" id="marketplace" data-stage={stage} data-playing={playing && visible && documentVisible}>
    <div className="referralHero-inner">
      <div className="referralHero-copy">
        <div className="referralHero-eyebrow"><span/> REAL ESTATE REFERRALS · PUBLIC PREVIEW</div>
        <h1>Earn referral fees.<br/><span>Find referrals<br/>in your market.</span></h1>
        <p>Turn clients you can’t serve into referral fee opportunities. Discover buyer and seller referrals where you work. Agree the terms with the right professional before the handoff.</p>
        <div className="referralHero-actions"><button className="referralHero-primary" onClick={onJoin}>{LAUNCH_CTA} <ArrowRight size={18}/></button><button className="referralHero-watch" onClick={showJourney}><span><Play size={12} fill="currentColor"/></span>Watch the sample walkthrough</button></div>
        <div className="referralHero-launchNote"><b>MEMBER ACCESS IS COMING SOON</b><p>Today: explore sample referrals and the walkthrough. Accounts, posting and applications are not open yet.</p><small>{PUBLIC_PRICING_NOTE}</small></div>
        <div className="referralHero-assurance"><ShieldCheck size={16}/><span>For verified professionals. Private by design.</span></div>
        <div className="referralHero-benefits"><div><MoveUpRight size={17}/><span>Refer clients<br/><b>Earn referral fees</b></span></div><div><Users size={17}/><span>Receive referrals<br/><b>Grow locally</b></span></div><div><Signature size={17}/><span>Agree the terms<br/><b>Before the handoff</b></span></div></div>
      </div>
      <div className="referralJourney" ref={cardRef}>
        <header className="referralJourney-header"><span className="referralJourney-brand"><img src="/agentreferrals-mark.svg" alt=""/><span>One introduction.<br/><b>Two ways to grow.</b></span></span><span className="referralJourney-demo"><span/> SAMPLE MEMBER WORKFLOW</span></header>
        <div className="referralJourney-marketbar"><span><MapPin size={14}/><b>Austin, TX</b><ArrowRight size={15}/></span><div aria-label="Example destination">{Object.entries(markets).map(([key, market]) => <button key={key} aria-pressed={destination === key} onClick={() => { setDestination(key); setStage(0); setPlaying(false); }}>{market.name}<small>, {market.state}</small></button>)}</div></div>
        <JourneyMap destination={destination} reducedMotion={reducedMotion} onReady={() => setMapReady(true)} onInteract={() => setPlaying(false)}/>
        <div className="referralJourney-story">
          <div className="referralJourney-storyline" key={`${stage}-${destination}`}><span className="referralJourney-storyIcon"><CurrentIcon size={21}/></span><div><span className="referralJourney-stepLabel">0{stage + 1} / THE {current.label.toUpperCase()}</span><h2>{current.title}</h2><p>{current.description(markets[destination].name)}</p></div></div>
          <div className="referralJourney-result"><Check size={14}/>{current.benefit}<ChevronRight size={14}/></div>
        </div>
        <footer className="referralJourney-controls"><div className="referralJourney-steps" aria-label="Referral journey steps">{steps.map((step, index) => <button key={step.label} aria-pressed={stage === index} onClick={() => { setStage(index); setPlaying(false); }}><span>{index < stage ? <Check size={11}/> : `0${index + 1}`}</span>{step.label}<i/></button>)}</div><button className="referralJourney-play" onClick={() => { if (playing) setPlaying(false); else replay(); }} aria-label={playing ? 'Pause referral animation' : 'Replay referral journey'} title={playing ? 'Pause animation' : 'Replay journey'}>{playing ? <Pause size={15}/> : <RotateCcw size={15}/>}</button></footer>
      </div>
    </div>
    <div className="referralHero-baseline"><span>GOOD PEOPLE. BETTER CONNECTIONS.</span><span>Across cities. Between professionals. <b>Built around your clients.</b></span></div>
  </section>;
}
