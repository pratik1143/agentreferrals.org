import { useEffect, useId, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Building2, ChevronDown, Compass, House, LockKeyhole, MapPin, Search, ShieldCheck, Sparkles, UsersRound, X } from 'lucide-react';
import './public-marketplace.css';

const opportunities = [
  { id: 'austin-buyer', type: 'Buyer', city: 'Austin', state: 'TX', title: 'A fresh start in central Austin', description: 'A relocating buyer looking for a local partner who knows the neighborhood.', range: '$450k–$650k', fee: '25%', tag: 'Relocation', initials: 'AT', property: 'Single-family home' },
  { id: 'denver-seller', type: 'Seller', city: 'Denver', state: 'CO', title: 'The next chapter for a Denver home', description: 'A homeowner preparing to sell and connect with an experienced local professional.', range: '$600k–$800k', fee: '20%', tag: 'Move-up', initials: 'DC', property: 'Single-family home' },
  { id: 'nashville-buyer', type: 'Buyer', city: 'Nashville', state: 'TN', title: 'A first home. The right local guide.', description: 'A first-time buyer exploring Nashville and the communities around it.', range: '$300k–$425k', fee: '25%', tag: 'First-time buyer', initials: 'NT', property: 'Townhouse' },
  { id: 'roundrock-seller', type: 'Seller', city: 'Round Rock', state: 'TX', title: 'Ready for a move in Round Rock', description: 'An owner planning a residential listing with support from a trusted local agent.', range: '$375k–$525k', fee: '20%', tag: 'Residential', initials: 'RR', property: 'Single-family home' },
  { id: 'denver-buyer', type: 'Buyer', city: 'Denver', state: 'CO', title: 'Less upkeep. More Denver living.', description: 'A buyer seeking a low-maintenance townhouse close to the places they love.', range: '$350k–$500k', fee: '25%', tag: 'Townhouse', initials: 'DC', property: 'Townhouse' },
  { id: 'austin-seller', type: 'Seller', city: 'Austin', state: 'TX', title: 'A new opportunity in Austin', description: 'A condo owner considering a sale and looking for local market expertise.', range: '$275k–$390k', fee: '20%', tag: 'Condo', initials: 'AT', property: 'Condominium' },
];

// Architectural artwork illustrates sample listings without presenting a real property photo.
function PropertyScene({ property = 'Single-family home', city = 'Austin' }) {
  const id = useId().replace(/:/g, '');
  const town = property !== 'Single-family home';
  return <svg className="mpPropertyScene" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id={`${id}sky`} x2="0" y2="1"><stop stopColor="#eff8ff"/><stop offset="1" stopColor="#c8e3ff"/></linearGradient><linearGradient id={`${id}wall`} x2="1" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#dfedff"/></linearGradient><linearGradient id={`${id}glass`} x2="1" y2="1"><stop stopColor="#7ec6ff"/><stop offset="1" stopColor="#2562aa"/></linearGradient></defs>
    <rect width="600" height="300" fill={`url(#${id}sky)`}/><circle cx="476" cy="62" r="31" fill="#fff" opacity=".8"/>
    <path d="M0 195 Q90 153 189 198 T400 181 T600 172 V300 H0Z" fill="#a9cff0" opacity=".45"/>
    {city === 'Denver' && <path d="M0 185 L85 83 172 179 246 110 338 198Z" fill="#a8cbea" opacity=".65"/>}
    <ellipse cx="300" cy="260" rx="224" ry="18" fill="#4276b7" opacity=".12"/>
    {town ? <g><path d="M113 116 L385 86 495 127 224 156Z" fill="#174a85"/><path d="M224 156 L495 127 V248 L224 270Z" fill={`url(#${id}wall)`}/><path d="M113 116 L224 156 V270 L113 232Z" fill="#b8d6f6"/>{[250,321,392].map(x => <g key={x}><path d={`M${x} 167 l43 -5 v43 l-43 5Z`} fill={`url(#${id}glass)`}/><path d={`M${x + 20} 165 v43`} stroke="#eef7ff" strokeWidth="3"/><path d={`M${x} 188 l43 -5`} stroke="#eef7ff" strokeWidth="3"/><path d={`M${x} 225 l43 -4 v29 l-43 4Z`} fill="#3d71b2"/></g>)}<path d="M133 155 L198 176 V210 L133 190Z" fill={`url(#${id}glass)`}/></g> : <g><path d="M105 174 L234 96 353 157 224 233Z" fill="#123e74"/><path d="M124 175 L234 111 329 160 V250 L124 223Z" fill={`url(#${id}wall)`}/><path d="M329 160 L451 133 V229 L329 250Z" fill="#c6def9"/><path d="M329 160 L451 133 465 121 339 143Z" fill="#24528d"/><path d="M164 177 L213 151 V207 L164 227Z" fill={`url(#${id}glass)`}/><path d="M188 164 V217" stroke="#fff" strokeWidth="4"/><path d="M164 195 L213 173" stroke="#fff" strokeWidth="4"/><path d="M250 174 L293 184 V244 L250 233Z" fill="#2b5d9b"/><path d="M350 173 L428 156 V212 L350 228Z" fill={`url(#${id}glass)`}/><path d="M389 164 V220" stroke="#edf6ff" strokeWidth="4"/><path d="M350 201 L428 184" stroke="#edf6ff" strokeWidth="4"/><path d="M249 242 L294 253 346 280 293 272Z" fill="#94b9e3"/></g>}
    <g fill="#5c91c8"><path d="M79 234 v-56" stroke="#4d7eac" strokeWidth="5"/><ellipse cx="78" cy="167" rx="26" ry="39"/><path d="M518 249 v-49" stroke="#4d7eac" strokeWidth="5"/><ellipse cx="518" cy="193" rx="24" ry="33"/></g>
    <path d="M0 272 Q125 250 225 275 T600 265 V300 H0Z" fill="#d1e8ff"/><path d="M0 284 H600" stroke="#a9c9ee" strokeWidth="1"/>
  </svg>;
}

function OpportunityCard({ item, index, onOpen }) {
  return <button className="mpOpportunity" type="button" style={{ '--mp-delay': `${index * 45}ms` }} onClick={onOpen} aria-label={`Preview ${item.type.toLowerCase()} referral in ${item.city}: ${item.title}. Member access coming soon.`}>
    <div className="mpCardArtwork"><PropertyScene property={item.property} city={item.city}/><span className="mpType"><House size={13}/>{item.type} referral</span><span className="mpSample">Sample</span><span className="mpArtworkArrow"><ArrowUpRight size={18}/></span></div>
    <div className="mpCardBody"><span className="mpLocation"><MapPin size={13}/>{item.city}, {item.state}<span>{item.tag}</span></span><h3>{item.title}</h3><p>{item.description}</p><div className="mpCardNumbers"><span><small>Example price range</small><b>{item.range}</b></span><span><small>Example referral fee</small><b>{item.fee}<i> commission</i></b></span></div><div className="mpCardBottom"><span className="mpAvatar">{item.initials}</span><span>Example professional<small>Public preview only</small></span><span className="mpView">View referral <ArrowRight size={14}/></span></div></div>
  </button>;
}

export default function MarketplaceExperience({ onStartAuth }) {
  const [selectedMarket, setSelectedMarket] = useState('Austin');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All markets');
  const [loading, setLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setLoading(false), 420); return () => clearTimeout(timer); }, []);
  const featured = opportunities.find(item => item.city === selectedMarket);
  const filtered = opportunities.filter(item => (filter === 'All' || item.type === filter) && (region === 'All markets' || item.city === region) && `${item.city} ${item.title} ${item.tag} ${item.state}`.toLowerCase().includes(search.trim().toLowerCase()));
  const open = () => onStartAuth('signin');
  return <div className="mpExperience">
    <section className="mpHero">
      <div className="mpHeroCopy infoReveal"><span className="mpEyebrow"><i/> THE REFERRAL MARKETPLACE <span>PREVIEW</span></span><h1>A new market.<br/><em>A familiar<br/>connection.</em></h1><p>Your client’s next chapter can start anywhere. Find the right local professional to help them get there.</p><div className="mpHeroActions"><a className="mpPrimary" href="#sample-opportunities">Explore referrals <ArrowDown size={17}/></a><button type="button" className="mpSecondary" onClick={() => onStartAuth('signup')}>Join the network <ArrowUpRight size={17}/></button></div><div className="mpHeroTrust"><span><ShieldCheck size={15}/> Built around trust</span><span><LockKeyhole size={14}/> Private by design</span></div><div className="mpHeroNote"><span className="mpMiniAvatars"><i>AT</i><i>DC</i><i>NT</i></span><span>Local expertise. Wider possibilities.<small>Discover how the network connects markets.</small></span></div></div>
      <div className="mpShowcase infoReveal">
        <div className="mpShowcaseHeading"><span><Compass size={17}/> A WORLD OF LOCAL CONNECTIONS</span><span className="mpPreviewPill">Sample preview</span></div>
        <div className="mpMarketTabs" role="group" aria-label="Preview an example market">{['Austin','Denver','Nashville'].map(city => <button type="button" key={city} aria-pressed={selectedMarket === city} className={selectedMarket === city ? 'is-selected' : ''} onClick={() => setSelectedMarket(city)}><MapPin size={13}/>{city}</button>)}</div>
        <div className="mpFeatured" key={featured.id}><div className="mpFeaturedArtwork"><PropertyScene property={featured.property} city={featured.city}/><span className="mpFeaturedLocation"><MapPin size={13}/>{featured.city}, {featured.state}</span><span className="mpFeaturedBudget"><small>EXAMPLE PRICE RANGE</small><b>{featured.range}</b></span></div><div className="mpFeaturedBody"><span className="mpFeaturedType">{featured.type} referral <span>· {featured.tag}</span></span><h2>{featured.title}</h2><div className="mpFeaturedDetails"><span><small>Example referral fee</small><b>{featured.fee} <i>commission</i></b></span><span><small>Looking for</small><b>A trusted local partner</b></span></div><button type="button" className="mpFeaturedAction" onClick={open}>Explore this sample <ArrowUpRight size={17}/></button></div></div>
        <div className="mpConnectionFlow"><span><UsersRound size={16}/><b>You introduce</b></span><i/><span><MapPin size={16}/><b>They connect</b></span><i/><span><Sparkles size={16}/><b>Opportunity grows</b></span></div>
        <div className="mpShowcaseHalo" aria-hidden="true"/>
      </div>
    </section>
    <section className="mpPrinciples" aria-label="Marketplace benefits"><div><House size={21}/><span><b>Buyers & sellers</b><small>The next move starts here</small></span></div><div><Building2 size={21}/><span><b>Local knowledge, wider reach</b><small>Connect across markets</small></span></div><div><ShieldCheck size={21}/><span><b>People before paperwork</b><small>Built for thoughtful introductions</small></span></div></section>
    <main className="mpListings" id="sample-opportunities"><div className="mpListingsHeading infoReveal"><div><span className="mpEyebrow">EXPLORE THE POSSIBILITIES</span><h2>One introduction.<br/><em>A whole new opportunity.</em></h2><p>Get a feel for the marketplace with these illustrative buyer and seller referrals.</p></div><span className="mpListingCount"><b>{String(filtered.length).padStart(2, '0')}</b> sample opportunities</span></div>
      <div className="mpToolbar"><div className="mpFilters" role="group" aria-label="Referral type">{['All','Buyer','Seller'].map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(value)}>{value === 'All' ? 'All referrals' : `${value}s`}<span>{opportunities.filter(item => value === 'All' || item.type === value).length}</span></button>)}</div><div className="mpSearchControls"><label className="mpSearch"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="City, keyword or property…" aria-label="Search sample referrals"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={14}/></button>}</label><label className="mpRegion"><MapPin size={15}/><select value={region} onChange={event => setRegion(event.target.value)} aria-label="Filter sample referrals by market">{['All markets','Austin','Denver','Nashville','Round Rock'].map(city => <option key={city}>{city}</option>)}</select><ChevronDown size={13}/></label></div></div>
      <div className="mpPreviewNotice"><span><LockKeyhole size={13}/> Sample listings only. Member access is coming soon.</span><span aria-live="polite">{filtered.length} of {opportunities.length} previews</span></div>
      {loading ? <div className="mpCardGrid" role="status" aria-label="Loading marketplace previews">{[0,1,2].map(index => <div key={index} className="mpSkeleton"><i/><div><b/><span/><span/><footer/></div></div>)}</div> : filtered.length ? <div className="mpCardGrid">{filtered.map((item, index) => <OpportunityCard key={item.id} item={item} index={index} onOpen={open}/>)}</div> : <div className="mpEmpty"><Search size={29}/><h3>No previews found</h3><p>Try another city or clear your filters to see all sample referrals.</p><button type="button" className="mpSecondary" onClick={() => { setSearch(''); setRegion('All markets'); setFilter('All'); }}>Reset filters <ArrowRight size={15}/></button></div>}
      <section className="mpAccessBanner"><span className="mpAccessIcon"><UsersRound size={25}/></span><div><span className="mpEyebrow">YOUR NEXT CONNECTION IS ON THE WAY</span><h3>A bigger network. A more personal handoff.</h3><p>Member access is coming soon. Your next great introduction starts with the right people.</p></div><button type="button" className="mpPrimary" onClick={() => onStartAuth('signup')}>Join the network <ArrowRight size={16}/></button></section>
    </main>
  </div>;
}
