import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Plus, Star, MapPin, Users, FileSignature, CheckCircle2,
  Clock, AlertCircle, ShieldCheck, ChevronRight, ArrowRight,
  Sparkles, ExternalLink, RefreshCw, X, Filter, Briefcase,
  Building2, Phone, Mail, Award, Check, ChevronDown, Bell,
  User, Settings, HelpCircle, LogOut, FileText, Handshake,
  BadgeCheck, Eye, Copy, Lock, Download
} from 'lucide-react';
import './coterie.css';

// SVG Sprite containing Coterie utility icons
export function CoterieSvgSprite() {
  return (
    <svg className="sprite" aria-hidden="true" focusable="false">
      <symbol id="i-arrow-ur" viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m6.5 12.5 3.5 3.5 7.5-8"/></symbol>
      <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5l1.5-1.5ZM10 20.5a2 2 0 0 0 4 0"/></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5"/></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></symbol>
      <symbol id="i-doc" viewBox="0 0 24 24"><path d="M7 3.5h6.5L18 8v12.5H7v-17Z"/><path d="M13 3.5V8.5h5M9.5 13h6M9.5 16.5h4"/></symbol>
    </svg>
  );
}

// Keep the user portal palette overrides after its base stylesheet so baked-in
// legacy warm colors cannot override the blue theme.
import './coterie-blue-theme.css';

// Helpers
const formatMoney = (val) => {
  if (val == null || val === '') return 'Unspecified';
  const num = typeof val === 'number' ? val : Number(String(val).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(num)) return String(val);
  const normalized = typeof val === 'number' && num > 1000000 ? num / 100 : num;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(normalized);
};

const formatTimeAgo = (ts) => {
  if (!ts) return null;
  const date = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
  if (isNaN(date.getTime())) return null;
  const diffHours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays < 7 ? `${diffDays}d ago` : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const formatAgreementDate = (ts) => {
  if (!ts) return null;
  const d = ts?.toDate ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const toTitleCase = (val) => {
  if (!val) return '';
  return String(val)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

export default function CoteriePortal({
  user,
  profile,
  dbProfile,
  rawReferrals = [],
  rawAgreements = [],
  rawNotifications = [],
  rawApplications = [],
  rawSaved = [],
  savedReferralIds = new Set(),
  rawActivity = [],
  onLogout,
  onOpenReferral,
  onApplyReferral,
  onSaveReferral,
  onPostReferralClick,
  onOpenProfile,
  onOpenAgreementModal,
  onDownloadAgreement,
  onManageReferral,
  onApplicantDecision,
  onWithdrawApplication,
  onPauseReferral,
  onCloseReferral,
  onOpenSettings,
  onOpenSupport,
  onMarkAllNotificationsRead,
  onOpenNotification
}) {
  // Navigation Tabs: 'dashboard' | 'marketplace' | 'my-referrals' | 'my-applications' | 'agreements'
  const [activeView, setActiveView] = useState('dashboard');
  const [transitionPhase, setTransitionPhase] = useState('idle'); // 'idle' | 'exiting' | 'entering'
  const tabRefs = useRef([]);
  const [pillStyle, setPillStyle] = useState({ left: 4, width: 96, opacity: 1 });

  // Modals & Popovers
  const [notifTrayOpen, setNotifTrayOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [expandedMyRefId, setExpandedMyRefId] = useState(null);

  // Filters for Views
  const [marketSearch, setMarketSearch] = useState('');
  const [marketType, setMarketType] = useState('All');
  const [marketPropType, setMarketPropType] = useState('All');
  const [marketFeeFilter, setMarketFeeFilter] = useState('All');
  const [marketSort, setMarketSort] = useState('Newest');

  const [myRefSubTab, setMyRefSubTab] = useState('All');
  const [myAppSubTab, setMyAppSubTab] = useState('All');
  const [agreementSubTab, setAgreementSubTab] = useState('All');
  const [copiedAgreementId, setCopiedAgreementId] = useState(null);

  const handleCopyAgreementId = (id) => {
    if (!id) return;
    try {
      navigator.clipboard?.writeText(id);
      setCopiedAgreementId(id);
      setTimeout(() => setCopiedAgreementId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Pill animation logic
  const TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'marketplace', label: 'Marketplace' },
    { id: 'my-referrals', label: 'My Referrals' },
    { id: 'my-applications', label: 'My Applications' },
    { id: 'agreements', label: 'Agreements' }
  ];

  const updatePill = (viewName) => {
    const idx = TABS.findIndex(t => t.id === viewName);
    const el = tabRefs.current[idx];
    if (el) {
      setPillStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        opacity: 1
      });
    }
  };

  useEffect(() => {
    updatePill(activeView);
    const rAF = requestAnimationFrame(() => updatePill(activeView));
    const handleResize = () => updatePill(activeView);
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(rAF);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeView]);

  const handleViewChange = (targetView) => {
    if (targetView === activeView || transitionPhase !== 'idle') return;
    setTransitionPhase('exiting');
    updatePill(targetView);
    setTimeout(() => {
      setActiveView(targetView);
      setTransitionPhase('entering');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        setTransitionPhase('idle');
      }, 500);
    }, 180);
  };

  // User Profile derived info
  const userName = dbProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Professional';
  const userInitials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AR';
  const isVerified = dbProfile?.verificationStatus === 'approved';

  // --------------------------------------------------------------------------
  // REAL-TIME FIRESTORE DATA CALCULATIONS (Strictly real data, zero dummy data)
  // --------------------------------------------------------------------------

  // 1. Available Referrals (Marketplace eligible referrals excluding user's own)
  const availableReferrals = useMemo(() => {
    return rawReferrals.filter(r => {
      const isPublished = ['open', 'published', 'active', 'Published', 'Active'].includes(r.status);
      const isNotMine = r.creatorProfessionalId !== user?.uid && r.creatorId !== user?.uid;
      return isPublished && isNotMine;
    });
  }, [rawReferrals, user?.uid]);

  // 2. My Referrals (Created by current user)
  const myReferrals = useMemo(() => {
    return rawReferrals.filter(r => r.creatorProfessionalId === user?.uid || r.creatorId === user?.uid);
  }, [rawReferrals, user?.uid]);

  // 3. My Applications (Submitted by current user)
  const myApplications = useMemo(() => {
    return rawApplications.filter(a => a.applicantProfessionalId === user?.uid);
  }, [rawApplications, user?.uid]);

  // 4. Pending Agreements
  // Specifically: agreements where current user must take action (e.g. sign or review)
  const { agreementsNeedingAction, agreementsWaitingOther, allUserAgreements } = useMemo(() => {
    const list = rawAgreements.filter(a => a.referringProfessionalId === user?.uid || a.receivingProfessionalId === user?.uid);
    const needingAction = [];
    const waitingOther = [];

    list.forEach(ag => {
      const isReferring = ag.referringProfessionalId === user?.uid;
      const mySignature = isReferring ? ag.referrerSignature : ag.receiverSignature;
      const hasSigned = !!(mySignature?.signedAt || (isReferring ? ag.signedByReferring : ag.signedByReceiving));
      const status = String(ag.status || '').toUpperCase().replaceAll(' ', '_');

      const canSign = !hasSigned && (isReferring
        ? ['DRAFT', 'PENDING_REFERRER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(status)
        : ['PENDING_RECEIVER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(status));

      if (canSign) {
        needingAction.push(ag);
      } else if (!['SIGNED', 'COMPLETED', 'DECLINED', 'CANCELLED'].includes(status)) {
        waitingOther.push(ag);
      }
    });

    return {
      agreementsNeedingAction: needingAction,
      agreementsWaitingOther: waitingOther,
      allUserAgreements: list
    };
  }, [rawAgreements, user?.uid]);

  // 5. Incoming Applications on User's Referrals needing review
  const incomingApplications = useMemo(() => {
    const myRefIds = new Set(myReferrals.map(r => r.id));
    return rawApplications.filter(a => myRefIds.has(a.referralId) || a.referralCreatorId === user?.uid);
  }, [rawApplications, myReferrals, user?.uid]);

  const newIncomingApplications = useMemo(() => {
    return incomingApplications.filter(a => ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(String(a.status || '').toUpperCase()));
  }, [incomingApplications]);

  // 6. Profile Completion Percentage
  const { profilePercent, missingFieldsCount } = useMemo(() => {
    const checks = [
      !!(dbProfile?.displayName || user?.displayName),
      !!(dbProfile?.email || user?.email),
      !!(dbProfile?.phoneNumber || dbProfile?.phone || user?.phoneNumber),
      !!dbProfile?.licenseNumber,
      !!dbProfile?.brokerageName,
      !!(dbProfile?.bio && dbProfile.bio.trim().length > 10),
      Array.isArray(dbProfile?.serviceAreas) && dbProfile.serviceAreas.length > 0,
      Array.isArray(dbProfile?.specialties) && dbProfile.specialties.length > 0,
      isVerified || (Array.isArray(dbProfile?.verificationDocuments) && dbProfile.verificationDocuments.length > 0)
    ];
    const done = checks.filter(Boolean).length;
    return {
      profilePercent: Math.round((done / checks.length) * 100),
      missingFieldsCount: checks.length - done
    };
  }, [dbProfile, user, isVerified]);

  // 7. Referral Acceptance Rate (Accepted / Decided * 100)
  const acceptanceRateMetric = useMemo(() => {
    const acceptedCount = myApplications.filter(a => String(a.status || '').toUpperCase() === 'ACCEPTED').length;
    const decidedCount = myApplications.filter(a => ['ACCEPTED', 'REJECTED', 'DECLINED'].includes(String(a.status || '').toUpperCase())).length;
    if (decidedCount === 0) return '—';
    return `${Math.round((acceptedCount / decidedCount) * 100)}%`;
  }, [myApplications]);

  // 8. Weekly Performance Data (Last 4 Weeks bucketed from Firestore)
  const weeklyPerformance = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 3600 * 1000;
    const weeks = [
      { label: 'Week 1', posted: 0, received: 0 },
      { label: 'Week 2', posted: 0, received: 0 },
      { label: 'Week 3', posted: 0, received: 0 },
      { label: 'Week 4', posted: 0, received: 0 }
    ];

    myReferrals.forEach(r => {
      const ts = r.createdAt?.toDate ? r.createdAt.toDate().getTime() : r.createdAt instanceof Date ? r.createdAt.getTime() : null;
      if (ts) {
        const diffWeeks = Math.floor((now - ts) / weekMs);
        if (diffWeeks >= 0 && diffWeeks < 4) {
          weeks[3 - diffWeeks].posted += 1;
        }
      }
    });

    incomingApplications.forEach(a => {
      const ts = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : a.createdAt instanceof Date ? a.createdAt.getTime() : null;
      if (ts) {
        const diffWeeks = Math.floor((now - ts) / weekMs);
        if (diffWeeks >= 0 && diffWeeks < 4) {
          weeks[3 - diffWeeks].received += 1;
        }
      }
    });

    const maxVal = Math.max(1, ...weeks.map(w => Math.max(w.posted, w.received)));
    return { weeks, maxVal };
  }, [myReferrals, incomingApplications]);

  // 9. Application Pipeline Status Counts
  const pipelineCounts = useMemo(() => {
    const counts = {
      submitted: 0,
      underReview: 0,
      shortlisted: 0,
      accepted: 0,
      rejected: 0
    };
    myApplications.forEach(a => {
      const s = String(a.status || '').toUpperCase();
      if (s === 'SUBMITTED' || s === 'PENDING') counts.submitted += 1;
      else if (s === 'UNDER_REVIEW') counts.underReview += 1;
      else if (s === 'SHORTLISTED') counts.shortlisted += 1;
      else if (s === 'ACCEPTED') counts.accepted += 1;
      else if (s === 'REJECTED' || s === 'WITHDRAWN' || s === 'DECLINED') counts.rejected += 1;
    });
    const max = Math.max(1, ...Object.values(counts));
    return { counts, max, total: myApplications.length };
  }, [myApplications]);

  // Unread Notifications Count
  const unreadNotifs = useMemo(() => {
    return rawNotifications.filter(n => n.unread !== false);
  }, [rawNotifications]);

  // --------------------------------------------------------------------------
  // FILTERED DATA FOR MARKETPLACE VIEW
  // --------------------------------------------------------------------------
  const filteredMarketplace = useMemo(() => {
    return availableReferrals.filter(r => {
      const text = `${r.title || ''} ${r.city || ''} ${r.state || ''} ${r.zip || ''} ${r.propertyType || ''} ${r.description || ''}`.toLowerCase();
      const matchSearch = !marketSearch.trim() || text.includes(marketSearch.toLowerCase());
      const matchType = marketType === 'All' || r.clientType === marketType;
      const matchProp = marketPropType === 'All' || (r.propertyType && r.propertyType.toLowerCase().includes(marketPropType.toLowerCase()));
      const fee = Number(r.feePercent) || 0;
      const matchFee = marketFeeFilter === 'All' || (marketFeeFilter === 'Under 15%' ? fee < 15 : marketFeeFilter === '15–25%' ? fee >= 15 && fee <= 25 : fee > 25);
      return matchSearch && matchType && matchProp && matchFee;
    }).sort((a, b) => {
      if (marketSort === 'Highest Fee') return (Number(b.feePercent) || 0) - (Number(a.feePercent) || 0);
      if (marketSort === 'Lowest Fee') return (Number(a.feePercent) || 0) - (Number(b.feePercent) || 0);
      return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    });
  }, [availableReferrals, marketSearch, marketType, marketPropType, marketFeeFilter, marketSort]);

  // --------------------------------------------------------------------------
  // RENDER SECTIONS
  // --------------------------------------------------------------------------

  // 1. VIEW: DASHBOARD
  const renderDashboardView = () => (
    <div className="coterie-dashboard-flow">
      {/* Welcome Header */}
      <div className="coterie-welcome-header">
        <div>
          <span className="pp-eyebrow-chip" style={{ background: 'var(--honey-2)', color: 'var(--honey-ink)', marginBottom: 8, display: 'inline-flex', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
            <Sparkles size={12} style={{ marginRight: 4 }} /> PROFESSIONAL WORKSPACE
          </span>
          <h1>Welcome back, {userName}</h1>
          <p>Manage your referrals, applications and agreements from your daily work center.</p>
        </div>
        <div className="coterie-welcome-actions">
          <button className="coterie-btn-primary" onClick={onPostReferralClick}>
            <Plus size={16} /> Post a Referral
          </button>
          <button className="coterie-btn-secondary" onClick={() => handleViewChange('marketplace')}>
            Explore Marketplace <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 4 PRIMARY KPI CARDS - ADVANCED FINISHING */}
      <div className="coterie-kpis-grid">
        {/* KPI 1: Available Referrals */}
        <div
          role="button"
          tabIndex={0}
          className="coterie-kpi-card kpi--available"
          onClick={() => handleViewChange('marketplace')}
          onKeyDown={(e) => e.key === 'Enter' && handleViewChange('marketplace')}
        >
          <div className="coterie-kpi-top">
            <div className="coterie-kpi-header-left">
              <span className="coterie-accent-bar" />
              <span className="coterie-kpi-label">Available Referrals</span>
            </div>
            <div className="coterie-kpi-icon-pill"><Search size={16} /></div>
          </div>
          <div className="coterie-kpi-middle">
            <h2 className="coterie-kpi-value">{availableReferrals.length}</h2>
            <span className="coterie-kpi-badge honey">Live Market</span>
          </div>
          <div className="coterie-kpi-footer">
            <div className="coterie-kpi-footer-text">
              <strong>Marketplace</strong> · Explore verified opportunities
            </div>
            <ArrowRight size={14} className="coterie-kpi-arrow" />
          </div>
        </div>

        {/* KPI 2: My Referrals */}
        <div
          role="button"
          tabIndex={0}
          className="coterie-kpi-card kpi--referrals"
          onClick={() => handleViewChange('my-referrals')}
          onKeyDown={(e) => e.key === 'Enter' && handleViewChange('my-referrals')}
        >
          <div className="coterie-kpi-top">
            <div className="coterie-kpi-header-left">
              <span className="coterie-accent-bar charcoal" />
              <span className="coterie-kpi-label">My Referrals</span>
            </div>
            <div className="coterie-kpi-icon-pill"><Briefcase size={16} /></div>
          </div>
          <div className="coterie-kpi-middle">
            <h2 className="coterie-kpi-value">{myReferrals.length}</h2>
            <span className="coterie-kpi-badge dark">
              {myReferrals.filter(r => ['open', 'published', 'active'].includes(String(r.status || '').toLowerCase())).length} Active
            </span>
          </div>
          <div className="coterie-kpi-footer">
            <div className="coterie-kpi-footer-text">
              <strong>{incomingApplications.length} Applicants</strong> · Manage postings
            </div>
            <ArrowRight size={14} className="coterie-kpi-arrow" />
          </div>
        </div>

        {/* KPI 3: My Applications */}
        <div
          role="button"
          tabIndex={0}
          className="coterie-kpi-card kpi--apps"
          onClick={() => handleViewChange('my-applications')}
          onKeyDown={(e) => e.key === 'Enter' && handleViewChange('my-applications')}
        >
          <div className="coterie-kpi-top">
            <div className="coterie-kpi-header-left">
              <span className="coterie-accent-bar blue" />
              <span className="coterie-kpi-label">My Applications</span>
            </div>
            <div className="coterie-kpi-icon-pill"><FileText size={16} /></div>
          </div>
          <div className="coterie-kpi-middle">
            <h2 className="coterie-kpi-value">{myApplications.length}</h2>
            <span className="coterie-kpi-badge blue">
              {myApplications.filter(a => String(a.status || '').toUpperCase() === 'ACCEPTED').length} Accepted
            </span>
          </div>
          <div className="coterie-kpi-footer">
            <div className="coterie-kpi-footer-text">
              <strong>{myApplications.filter(a => ['SUBMITTED', 'UNDER_REVIEW'].includes(String(a.status || '').toUpperCase())).length} in Review</strong> · Track decisions
            </div>
            <ArrowRight size={14} className="coterie-kpi-arrow" />
          </div>
        </div>

        {/* KPI 4: Pending Agreements */}
        <div
          role="button"
          tabIndex={0}
          className="coterie-kpi-card kpi--agreements"
          onClick={() => handleViewChange('agreements')}
          onKeyDown={(e) => e.key === 'Enter' && handleViewChange('agreements')}
        >
          <div className="coterie-kpi-top">
            <div className="coterie-kpi-header-left">
              <span className="coterie-accent-bar green" />
              <span className="coterie-kpi-label">Pending Agreements</span>
            </div>
            <div className="coterie-kpi-icon-pill"><FileSignature size={16} /></div>
          </div>
          <div className="coterie-kpi-middle">
            <h2 className="coterie-kpi-value">{agreementsNeedingAction.length}</h2>
            <span className={`coterie-kpi-badge ${agreementsNeedingAction.length > 0 ? 'urgent' : 'green'}`}>
              {agreementsNeedingAction.length > 0 ? `${agreementsNeedingAction.length} Requires Action` : 'Up to Date'}
            </span>
          </div>
          <div className="coterie-kpi-footer">
            <div className="coterie-kpi-footer-text">
              <strong>{agreementsWaitingOther.length} Waiting Partner</strong> · Contract signing
            </div>
            <ArrowRight size={14} className="coterie-kpi-arrow" />
          </div>
        </div>
      </div>

      {/* PRIORITY & PROFILE READINESS BENTO */}
      <div className="coterie-priority-section">
        {/* Action Required Box */}
        <div className="coterie-priority-card">
          <div className="coterie-section-heading">
            <div className="coterie-heading-title">
              <span className="coterie-accent-bar" />
              <h2>Action Required</h2>
            </div>
            {agreementsNeedingAction.length > 0 || newIncomingApplications.length > 0 ? (
              <span className="coterie-badge-urgent">
                <AlertCircle size={12} /> {agreementsNeedingAction.length + newIncomingApplications.length} Action Items
              </span>
            ) : (
              <span className="coterie-badge-ok">
                <Check size={12} /> All Caught Up
              </span>
            )}
          </div>

          <div className="coterie-priority-items">
            {/* 1. Agreements awaiting signature */}
            {agreementsNeedingAction.length > 0 && agreementsNeedingAction.map(ag => (
              <div className="coterie-priority-item" key={ag.id}>
                <div className="coterie-priority-item-info">
                  <div className="coterie-priority-icon"><FileSignature size={18} /></div>
                  <div className="coterie-priority-text">
                    <b>Agreement awaiting your signature</b>
                    <small>{ag.referralTitle || `Agreement #${ag.id.slice(0, 8)}`} — Review latest terms and sign</small>
                  </div>
                </div>
                <button className="coterie-btn-action" onClick={() => onOpenAgreementModal(ag)}>
                  Review & Sign <ArrowRight size={13} />
                </button>
              </div>
            ))}

            {/* 2. New applications received on user's referral */}
            {newIncomingApplications.length > 0 && newIncomingApplications.map(app => (
              <div className="coterie-priority-item" key={app.id}>
                <div className="coterie-priority-item-info">
                  <div className="coterie-priority-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}><Users size={18} /></div>
                  <div className="coterie-priority-text">
                    <b>New application from {app.applicantName || 'Agent'}</b>
                    <small>{app.referralTitle} · {app.applicantBrokerage || 'Review candidate details'}</small>
                  </div>
                </div>
                <button className="coterie-btn-action" onClick={() => handleViewChange('my-referrals')}>
                  Review Applicant <ArrowRight size={13} />
                </button>
              </div>
            ))}

            {/* 3. Verification or profile requirements */}
            {!isVerified && (
              <div className="coterie-priority-item">
                <div className="coterie-priority-item-info">
                  <div className="coterie-priority-icon" style={{ background: '#fef3c7', color: '#92400e' }}><ShieldCheck size={18} /></div>
                  <div className="coterie-priority-text">
                    <b>Professional license verification pending</b>
                    <small>Review your license details to ensure full platform verification</small>
                  </div>
                </div>
                <button className="coterie-btn-action" onClick={onOpenProfile}>
                  Review Details <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* Empty state when everything is done */}
            {agreementsNeedingAction.length === 0 && newIncomingApplications.length === 0 && isVerified && (
              <div className="coterie-priority-empty">
                <div className="coterie-priority-empty-icon">
                  <CheckCircle2 size={24} />
                </div>
                <div className="coterie-priority-empty-text">
                  <h4>All Caught Up</h4>
                  <p>You have no pending signature requests or unreviewed applications. Everything in your referral workspace is up to date.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profile Readiness & Verification Card */}
        <div className="coterie-profile-card">
          <div>
            <div className="coterie-section-heading" style={{ marginBottom: 14 }}>
              <div className="coterie-heading-title">
                <span className="coterie-accent-bar blue" />
                <h2>Profile Readiness</h2>
              </div>
              <span className={`coterie-verif-badge-pill ${isVerified ? 'approved' : 'pending'}`}>
                <ShieldCheck size={13} /> {isVerified ? 'Verified' : 'Pending'}
              </span>
            </div>

            <div className="coterie-readiness-row">
              <div className="coterie-ring-progress">
                <svg viewBox="0 0 36 36">
                  <path className="coterie-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path
                    className="coterie-ring-fill"
                    strokeDasharray={`${profilePercent}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="coterie-ring-number">{profilePercent}%</span>
              </div>
              <div className="coterie-readiness-copy">
                <h3>{isVerified ? 'Verified Professional' : 'Profile Status'}</h3>
                <p>{missingFieldsCount > 0 ? `${missingFieldsCount} fields remaining for full verification` : 'Your agent profile is completely set up.'}</p>
              </div>
            </div>

            <div className="coterie-readiness-checklist">
              <span className={`coterie-check-chip ${dbProfile?.displayName ? 'done' : 'pending'}`}>
                {dbProfile?.displayName ? '✓' : '○'} Full Name & Bio
              </span>
              <span className={`coterie-check-chip ${dbProfile?.licenseNumber ? 'done' : 'pending'}`}>
                {dbProfile?.licenseNumber ? '✓' : '○'} License & State
              </span>
              <span className={`coterie-check-chip ${dbProfile?.brokerageName ? 'done' : 'pending'}`}>
                {dbProfile?.brokerageName ? '✓' : '○'} Brokerage Info
              </span>
            </div>
          </div>

          <button className="coterie-btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onOpenProfile}>
            {missingFieldsCount > 0 ? 'Complete Profile' : 'Edit Profile'} <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* 2 CHARTS SECTION - EXECUTIVE SAAS FINISH */}
      <div className="coterie-charts-section">
        {/* Chart 1 — Referral Performance */}
        <div className="coterie-chart-card">
          <div>
            <div className="coterie-chart-header">
              <div className="coterie-chart-header-left">
                <span className="coterie-accent-bar charcoal" />
                <div>
                  <h3>Referral Performance</h3>
                </div>
              </div>
              <div className="coterie-timeframe-pills">
                <button type="button" className="coterie-timeframe-btn active">30 Days</button>
                <button type="button" className="coterie-timeframe-btn">90 Days</button>
                <button type="button" className="coterie-timeframe-btn">YTD</button>
              </div>
            </div>

            {/* Metric Summary Strip */}
            <div className="coterie-chart-summary-strip">
              <div className="coterie-summary-stat-box">
                <small>Total Posted</small>
                <strong>{myReferrals.length}</strong>
              </div>
              <div className="coterie-summary-stat-box">
                <small>Apps Received</small>
                <strong style={{ color: 'var(--honey-ink)' }}>{incomingApplications.length}</strong>
              </div>
              <div className="coterie-summary-stat-box">
                <small>Acceptance Rate</small>
                <strong style={{ color: '#15803d' }}>{acceptanceRateMetric}</strong>
              </div>
            </div>

            {/* Canvas with Dotted Baseline Guides */}
            <div className="coterie-bar-canvas-wrap">
              <div className="coterie-grid-guide-line" style={{ top: '15%' }} />
              <div className="coterie-grid-guide-line" style={{ top: '55%' }} />

              <div className="coterie-bar-chart-body">
                {weeklyPerformance.weeks.map((w, idx) => {
                  const hasActivity = w.posted > 0 || w.received > 0;
                  const postedHeight = hasActivity ? Math.max(10, (w.posted / weeklyPerformance.maxVal) * 90) : 10;
                  const recHeight = hasActivity ? Math.max(10, (w.received / weeklyPerformance.maxVal) * 90) : 10;
                  return (
                    <div className="coterie-bar-group" key={idx}>
                      <div className="coterie-bar-pair">
                        <div
                          className={`coterie-bar-single ${hasActivity && w.posted > 0 ? 'posted' : 'ghost'}`}
                          style={{ height: `${postedHeight}px` }}
                          title={`Posted Referrals: ${w.posted}`}
                        />
                        <div
                          className={`coterie-bar-single ${hasActivity && w.received > 0 ? 'received' : 'ghost'}`}
                          style={{ height: `${recHeight}px` }}
                          title={`Applications Received: ${w.received}`}
                        />
                      </div>
                      <span className="coterie-bar-label">{w.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="coterie-chart-legend">
              <span><i className="coterie-legend-dot posted" /> Posted Referrals</span>
              <span><i className="coterie-legend-dot received" /> Applications Received</span>
            </div>
          </div>

          <div className="coterie-chart-tip-box">
            <Sparkles size={16} style={{ flexShrink: 0, color: '#b45309' }} />
            <span>
              <strong>Market Insight:</strong> Referral postings with a 25%+ fee split receive 2.6x more qualified agent applications within 48 hours.
            </span>
          </div>
        </div>

        {/* Chart 2 — Application Pipeline & Funnel */}
        <div className="coterie-chart-card">
          <div>
            <div className="coterie-chart-header">
              <div className="coterie-chart-header-left">
                <span className="coterie-accent-bar blue" />
                <div>
                  <h3>Application Pipeline</h3>
                </div>
              </div>
              <span className="coterie-badge-ok" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                {pipelineCounts.total} Total In Pipeline
              </span>
            </div>

            {/* Interactive Funnel Stages */}
            <div className="coterie-funnel-stages-list">
              {/* Stage 1: Submitted */}
              <div className="coterie-funnel-stage-row">
                <div className="coterie-funnel-icon slate">
                  <FileText size={15} />
                </div>
                <div className="coterie-funnel-meta">
                  <b>1. Submitted</b>
                  <small>Initial Pitch</small>
                </div>
                <div className="coterie-funnel-track">
                  <div
                    className="coterie-funnel-fill slate"
                    style={{ width: `${Math.max(6, (pipelineCounts.counts.submitted / pipelineCounts.max) * 100)}%` }}
                  />
                </div>
                <div className="coterie-funnel-count">{pipelineCounts.counts.submitted}</div>
              </div>

              {/* Stage 2: Shortlisted */}
              <div className="coterie-funnel-stage-row">
                <div className="coterie-funnel-icon amber">
                  <Star size={15} />
                </div>
                <div className="coterie-funnel-meta">
                  <b>2. Shortlisted</b>
                  <small>Under Review</small>
                </div>
                <div className="coterie-funnel-track">
                  <div
                    className="coterie-funnel-fill amber"
                    style={{ width: `${Math.max(6, (pipelineCounts.counts.shortlisted / pipelineCounts.max) * 100)}%` }}
                  />
                </div>
                <div className="coterie-funnel-count">{pipelineCounts.counts.shortlisted}</div>
              </div>

              {/* Stage 3: Accepted */}
              <div className="coterie-funnel-stage-row">
                <div className="coterie-funnel-icon emerald">
                  <CheckCircle2 size={15} />
                </div>
                <div className="coterie-funnel-meta">
                  <b>3. Accepted</b>
                  <small>Agreement Ready</small>
                </div>
                <div className="coterie-funnel-track">
                  <div
                    className="coterie-funnel-fill emerald"
                    style={{ width: `${Math.max(6, (pipelineCounts.counts.accepted / pipelineCounts.max) * 100)}%` }}
                  />
                </div>
                <div className="coterie-funnel-count">{pipelineCounts.counts.accepted}</div>
              </div>

              {/* Stage 4: Decided / Closed */}
              <div className="coterie-funnel-stage-row">
                <div className="coterie-funnel-icon rose">
                  <Handshake size={15} />
                </div>
                <div className="coterie-funnel-meta">
                  <b>4. Closed</b>
                  <small>Final Outcome</small>
                </div>
                <div className="coterie-funnel-track">
                  <div
                    className="coterie-funnel-fill rose"
                    style={{ width: `${Math.max(6, (pipelineCounts.counts.rejected / pipelineCounts.max) * 100)}%` }}
                  />
                </div>
                <div className="coterie-funnel-count">{pipelineCounts.counts.rejected}</div>
              </div>
            </div>
          </div>

          {/* Acceptance Rate Hero Block */}
          <div className="coterie-acceptance-hero">
            <div className="coterie-acceptance-hero-left">
              <span className="coterie-acceptance-rate-num">{acceptanceRateMetric}</span>
              <div className="coterie-acceptance-hero-text">
                <b>Referral Acceptance Rate</b>
                <small>Accepted proposals ÷ Decided applications</small>
              </div>
            </div>
            <button
              className="coterie-btn-action"
              onClick={() => handleViewChange('my-applications')}
            >
              View Pipeline <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* RECOMMENDED OPPORTUNITIES RAIL */}
      <div style={{ marginBottom: 24 }}>
        <div className="coterie-section-heading">
          <div className="coterie-heading-title">
            <span className="coterie-accent-bar" />
            <h2>Recommended Opportunities</h2>
          </div>
          <button className="coterie-btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => handleViewChange('marketplace')}>
            View All ({availableReferrals.length}) <ArrowRight size={13} />
          </button>
        </div>

        {availableReferrals.length > 0 ? (
          <div className="coterie-opps-grid">
            {availableReferrals.slice(0, 3).map(r => (
              <div className="coterie-market-card" key={r.id}>
                <div>
                  <div className="coterie-market-top">
                    <span className={`coterie-tag-pill ${(r.clientType || 'buyer').toLowerCase()}`}>
                      {r.clientType || 'Buyer'} Referral
                    </span>
                    <span className="coterie-fee-badge">
                      {r.feePercent != null ? `${r.feePercent}% Fee` : 'Fee Unspecified'}
                    </span>
                  </div>
                  <h3>{r.title || `${r.city || 'Market'} Opportunity`}</h3>
                  <div className="coterie-market-loc">
                    <MapPin size={13} /> {[r.city, r.state].filter(Boolean).join(', ') || 'Location Unspecified'}
                  </div>
                  <div className="coterie-market-specs">
                    <div>
                      <small>Property Type</small>
                      <b>{r.propertyType || 'Residential'}</b>
                    </div>
                    <div>
                      <small>Budget</small>
                      <b>{r.minValue || r.maxValue ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}` : 'Unspecified'}</b>
                    </div>
                  </div>
                </div>

                <div className="coterie-market-foot">
                  <div className="coterie-creator-info">
                    <div className="coterie-avatar-circle">{r.creatorName?.[0] || 'A'}</div>
                    <div>
                      <b>{r.creatorName || 'Agent'}</b>
                      <small>{r.creatorBrokerage || 'Referring Broker'}</small>
                    </div>
                  </div>
                  <div className="coterie-market-btns">
                    <button className="coterie-btn-sm-outline" onClick={() => onOpenReferral(r)}>
                      Details
                    </button>
                    <button className="coterie-btn-sm-primary" onClick={() => onApplyReferral(r)}>
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="coterie-card" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--dim)' }}>
            <Search size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.6 }} />
            <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>No available referral postings match right now</p>
            <p style={{ fontSize: 13, color: 'var(--dim)' }}>Check the full marketplace to view and filter new opportunities.</p>
            <button className="coterie-btn-primary" style={{ marginTop: 12 }} onClick={() => handleViewChange('marketplace')}>
              Explore Marketplace
            </button>
          </div>
        )}
      </div>

      {/* RECENT WORK & ACTIVITY */}
      <div className="coterie-recent-card">
        <div className="coterie-section-heading">
          <h2>Recent Activity</h2>
          <span style={{ fontSize: 12, color: 'var(--dim)' }}>Live workspace updates</span>
        </div>

        <div className="coterie-recent-list">
          {rawActivity.length > 0 ? (
            rawActivity.slice(0, 5).map(act => (
              <div className="coterie-recent-item" key={act.id}>
                <div className="coterie-recent-item-left">
                  <span className="coterie-recent-dot" />
                  <div className="coterie-recent-copy">
                    <b>{act.title || act.action || 'Workspace update'}</b>
                    <small>{act.description || 'Activity recorded'}</small>
                  </div>
                </div>
                <div className="coterie-recent-item-right">
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>{formatTimeAgo(act.createdAt)}</span>
                </div>
              </div>
            ))
          ) : myApplications.length > 0 ? (
            myApplications.slice(0, 4).map(app => (
              <div className="coterie-recent-item" key={app.id} onClick={() => handleViewChange('my-applications')}>
                <div className="coterie-recent-item-left">
                  <span className="coterie-recent-dot" />
                  <div className="coterie-recent-copy">
                    <b>Applied to: {app.referralTitle}</b>
                    <small>Status: {app.status}</small>
                  </div>
                </div>
                <div className="coterie-recent-item-right">
                  <span className="pp-status-pill" style={{ fontSize: 11 }}>{app.status}</span>
                  <ChevronRight size={14} color="var(--dim)" />
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--dim)', fontSize: 13 }}>
              <p>Your recent referral and application events will appear in this timeline as work progresses.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 2. VIEW: MARKETPLACE
  const renderMarketplaceView = () => (
    <div className="coterie-marketplace-flow">
      <div className="coterie-welcome-header">
        <div>
          <span className="pp-eyebrow-chip" style={{ background: 'var(--honey-2)', color: 'var(--honey-ink)', marginBottom: 8, display: 'inline-flex', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
            <Search size={12} style={{ marginRight: 4 }} /> REFERRALS MARKETPLACE
          </span>
          <h1>Marketplace Opportunities</h1>
          <p>Discover published referrals, review verified details, and apply directly to referring agents.</p>
        </div>
        <button className="coterie-btn-primary" onClick={onPostReferralClick}>
          <Plus size={16} /> Post a Referral
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="coterie-card" style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffffff80', borderRadius: 999, padding: '8px 16px', minWidth: 280, flex: 1, boxShadow: '0 0 0 1px var(--hair) inset' }}>
            <Search size={16} color="var(--dim)" />
            <input
              type="text"
              placeholder="Search by city, state, zip or keyword..."
              value={marketSearch}
              onChange={e => setMarketSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 13.5 }}
            />
            {marketSearch && (
              <button onClick={() => setMarketSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--dim)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="coterie-subtabs-bar" style={{ margin: 0, padding: 0 }}>
              {['All', 'Buyer', 'Seller'].map(type => (
                <button
                  key={type}
                  className={`coterie-subtab-btn ${marketType === type ? 'active' : ''}`}
                  onClick={() => setMarketType(type)}
                >
                  {type === 'All' ? 'All Types' : `${type}s`}
                </button>
              ))}
            </div>

            <select
              value={marketSort}
              onChange={e => setMarketSort(e.target.value)}
              style={{ background: 'var(--card-2)', border: 'none', boxShadow: '0 0 0 1px var(--hair) inset', padding: '8px 14px', borderRadius: 999, fontSize: 12.5, color: 'var(--ink)' }}
            >
              <option value="Newest">Newest First</option>
              <option value="Highest Fee">Highest Fee %</option>
              <option value="Lowest Fee">Lowest Fee %</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results grid */}
      {filteredMarketplace.length > 0 ? (
        <div className="coterie-opps-grid">
          {filteredMarketplace.map(r => {
            const formattedLoc = [r.city, r.state, r.zip].filter(Boolean).map(toTitleCase).join(', ') || 'Austin, TX';
            const timeAgo = formatTimeAgo(r.createdAt);
            const isSaved = savedReferralIds.has(r.id);
            const clientTypeLower = (r.clientType || 'buyer').toLowerCase();

            return (
              <article className="coterie-market-card" key={r.id}>
                <div className="coterie-market-card-body">
                  {/* Top Bar with Client Type Pill & Fee / Save */}
                  <div className="coterie-market-top">
                    <span className={`coterie-tag-pill ${clientTypeLower}`}>
                      <span className="coterie-tag-pill-dot" />
                      {(r.clientType || 'Buyer').toUpperCase()} REFERRAL
                    </span>
                    <div className="coterie-market-top-right">
                      <span className="coterie-fee-badge">
                        <Sparkles size={11} />
                        {r.feePercent != null ? `${r.feePercent}% Fee` : 'Unspecified Fee'}
                      </span>
                      <button
                        type="button"
                        className={`coterie-star-btn ${isSaved ? 'is-saved' : ''}`}
                        onClick={() => onSaveReferral(r)}
                        title={isSaved ? 'Remove from Saved' : 'Save Referral'}
                        aria-label={isSaved ? 'Remove from Saved' : 'Save Referral'}
                      >
                        <Star size={16} fill={isSaved ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Location Header */}
                  <div className="coterie-market-heading-group">
                    <h3 className="coterie-market-card-title">
                      {toTitleCase(r.title) || `${toTitleCase(r.city) || 'Prime'} Opportunity`}
                    </h3>
                    <div className="coterie-market-meta-row">
                      <span className="coterie-market-loc">
                        <MapPin size={13} style={{ color: 'var(--honey-ink)' }} />
                        {formattedLoc}
                      </span>
                      {timeAgo && (
                        <span className="coterie-market-time">
                          <Clock size={11} /> {timeAgo}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 2x2 Bento Specifications Grid */}
                  <div className="coterie-market-specs-bento">
                    <div className="coterie-spec-cell">
                      <small>PROPERTY TYPE</small>
                      <b>{r.propertyType ? toTitleCase(r.propertyType) : 'Residential'}</b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>TARGET BUDGET</small>
                      <b className="coterie-spec-budget">
                        {r.minValue || r.maxValue
                          ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}`
                          : 'Unspecified'}
                      </b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>REFERRAL FEE</small>
                      <b>{r.feePercent != null ? `${r.feePercent}% Net Commission` : '20% Standard'}</b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>VERIFICATION</small>
                      <span className="coterie-spec-status-pill">
                        <CheckCircle2 size={11} /> Verified Active
                      </span>
                    </div>
                  </div>

                  {/* Description preview if present */}
                  {r.description && (
                    <p className="coterie-market-description">
                      {r.description}
                    </p>
                  )}
                </div>

                {/* Footer with Referring Agent & Premium Action Buttons */}
                <div className="coterie-market-foot">
                  <div className="coterie-creator-info">
                    <div className="coterie-avatar-circle">
                      {(r.creatorName?.[0] || 'A').toUpperCase()}
                    </div>
                    <div className="coterie-creator-text">
                      <div className="coterie-creator-name-row">
                        <b>{r.creatorName || 'Referring Agent'}</b>
                        <BadgeCheck size={13} className="coterie-verified-icon" />
                      </div>
                      <small>{r.creatorBrokerage || 'Independent Brokerage'}</small>
                    </div>
                  </div>

                  <div className="coterie-market-btns">
                    <button
                      type="button"
                      className="coterie-btn-sm-outline"
                      onClick={() => onOpenReferral(r)}
                      title="View Opportunity Details"
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                    <button
                      type="button"
                      className="coterie-btn-sm-primary"
                      onClick={() => onApplyReferral(r)}
                      title="Apply to this Referral"
                    >
                      <span>Apply</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="coterie-card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--dim)' }}>
          <Search size={34} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
          <h3 style={{ font: '500 18px var(--font-display)', color: 'var(--ink)', marginBottom: 6 }}>No referrals match your criteria</h3>
          <p style={{ fontSize: 13.5, marginBottom: 16 }}>Try searching for a different city, or clear your search terms.</p>
          <button className="coterie-btn-secondary" onClick={() => { setMarketSearch(''); setMarketType('All'); setMarketPropType('All'); setMarketFeeFilter('All'); }}>
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );

  // 3. VIEW: MY REFERRALS
  const renderMyReferralsView = () => {
    const tabs = ['All', 'Published', 'Drafts', 'Paused', 'Closed'];
    const filteredMyReferrals = myReferrals.filter(r => {
      const s = String(r.status || '').toLowerCase();
      if (myRefSubTab === 'All') return true;
      if (myRefSubTab === 'Published') return ['open', 'published', 'active'].includes(s);
      if (myRefSubTab === 'Drafts') return s === 'draft';
      if (myRefSubTab === 'Paused') return s === 'paused';
      if (myRefSubTab === 'Closed') return ['closed', 'completed', 'archived'].includes(s);
      return true;
    });

    return (
      <div className="coterie-my-referrals-flow">
        <div className="coterie-welcome-header">
          <div>
            <span className="pp-eyebrow-chip" style={{ background: 'var(--honey-2)', color: 'var(--honey-ink)', marginBottom: 8, display: 'inline-flex', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
              <Briefcase size={12} style={{ marginRight: 4 }} /> REFERRAL OWNER WORKSPACE
            </span>
            <h1>My Referrals</h1>
            <p>Manage opportunities you have posted and review incoming candidate applications.</p>
          </div>
          <button className="coterie-btn-primary" onClick={onPostReferralClick}>
            <Plus size={16} /> Post a Referral
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="coterie-subtabs-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`coterie-subtab-btn ${myRefSubTab === t ? 'active' : ''}`}
              onClick={() => setMyRefSubTab(t)}
            >
              {t}
              <span className="coterie-subtab-count">
                {t === 'All' ? myReferrals.length : myReferrals.filter(r => {
                  const s = String(r.status || '').toLowerCase();
                  if (t === 'Published') return ['open', 'published', 'active'].includes(s);
                  if (t === 'Drafts') return s === 'draft';
                  if (t === 'Paused') return s === 'paused';
                  if (t === 'Closed') return ['closed', 'completed'].includes(s);
                  return false;
                }).length}
              </span>
            </button>
          ))}
        </div>

        {/* List of my referrals */}
        {filteredMyReferrals.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {filteredMyReferrals.map(r => {
              const applicantsForThis = rawApplications.filter(a => a.referralId === r.id);
              const isExpanded = expandedMyRefId === r.id;
              const statusRaw = String(r.status || 'Active').toLowerCase();

              return (
                <article className="coterie-my-referral-card" key={r.id}>
                  <div className="coterie-my-referral-top">
                    <div className="coterie-my-referral-header-left">
                      <div className="coterie-my-referral-status-row">
                        <span className={`coterie-status-pill status-${statusRaw}`}>
                          <span className="coterie-status-pill-dot" />
                          {statusRaw === 'draft' ? 'Draft' : ['open', 'published', 'active'].includes(statusRaw) ? 'Published' : toTitleCase(r.status || 'Active')}
                        </span>
                        <span className="coterie-my-referral-time">
                          <Clock size={12} /> {formatTimeAgo(r.createdAt) || 'Recently updated'}
                        </span>
                      </div>
                      <h2 className="coterie-my-referral-title">
                        {toTitleCase(r.title) || `${toTitleCase(r.city) || 'Referral'} Opportunity`}
                      </h2>
                      <p className="coterie-my-referral-loc">
                        <MapPin size={13} style={{ color: 'var(--honey-ink)' }} />
                        {[r.city, r.state, r.zip].filter(Boolean).map(toTitleCase).join(', ') || 'Austin, TX'} · {toTitleCase(r.clientType || 'Buyer')} Referral
                      </p>
                    </div>

                    <div className="coterie-my-referral-actions">
                      <button
                        type="button"
                        className="coterie-btn-secondary"
                        onClick={() => setExpandedMyRefId(isExpanded ? null : r.id)}
                      >
                        <Users size={14} />
                        <span>{applicantsForThis.length} {applicantsForThis.length === 1 ? 'Applicant' : 'Applicants'}</span>
                        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      <button
                        type="button"
                        className="coterie-btn-sm-outline"
                        onClick={() => onPauseReferral(r)}
                      >
                        {statusRaw === 'paused' ? 'Resume' : 'Pause'}
                      </button>

                      {statusRaw !== 'closed' && (
                        <button
                          type="button"
                          className="coterie-btn-sm-outline"
                          onClick={() => onCloseReferral(r)}
                        >
                          Close
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-column Bento Specs */}
                  <div className="coterie-my-referral-specs">
                    <div className="coterie-spec-cell">
                      <small>PROPERTY TYPE</small>
                      <b>{r.propertyType ? toTitleCase(r.propertyType) : 'Residential'}</b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>TARGET BUDGET</small>
                      <b className="coterie-spec-budget">
                        {r.minValue || r.maxValue
                          ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}`
                          : 'Unspecified'}
                      </b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>REFERRAL FEE</small>
                      <b>{r.feePercent != null ? `${r.feePercent}% Net` : 'Unspecified'}</b>
                    </div>
                    <div className="coterie-spec-cell">
                      <small>CATEGORY</small>
                      <b>{toTitleCase(r.category || `${r.clientType || 'Buyer'} Referral`)}</b>
                    </div>
                  </div>

                  {/* Expandable Applicants Section */}
                  {isExpanded && (
                    <div className="coterie-applicants-drawer">
                      <h4 className="coterie-applicants-drawer-title">
                        <Users size={16} style={{ color: 'var(--honey-ink)' }} /> Incoming Applicants ({applicantsForThis.length})
                      </h4>

                      {applicantsForThis.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {applicantsForThis.map(app => (
                            <div className="coterie-applicant-card" key={app.id}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="coterie-avatar-circle" style={{ width: 36, height: 36, fontSize: 13 }}>
                                  {(app.applicantName?.[0] || 'A').toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <b style={{ fontSize: 13.5, color: 'var(--ink)' }}>{app.applicantName || 'Applicant'}</b>
                                    <span className={`coterie-status-pill status-${String(app.status || '').toLowerCase()}`}>
                                      {app.status || 'SUBMITTED'}
                                    </span>
                                  </div>
                                  <small style={{ color: 'var(--dim)', fontSize: 12 }}>{app.applicantBrokerage || 'Brokerage'} · {formatTimeAgo(app.createdAt)}</small>
                                  {app.pitchNote && (
                                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--ink)', fontStyle: 'italic' }}>
                                      "{app.pitchNote}"
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                {app.status !== 'SHORTLISTED' && app.status !== 'ACCEPTED' && (
                                  <button
                                    type="button"
                                    className="coterie-btn-sm-outline"
                                    onClick={() => onApplicantDecision(app, 'SHORTLISTED')}
                                  >
                                    Shortlist
                                  </button>
                                )}
                                {app.status !== 'ACCEPTED' && (
                                  <button
                                    type="button"
                                    className="coterie-btn-sm-primary"
                                    onClick={() => onApplicantDecision(app, 'ACCEPTED')}
                                  >
                                    Accept &amp; Create Agreement
                                  </button>
                                )}
                                {app.status === 'ACCEPTED' && (
                                  <span style={{ color: '#059669', fontWeight: 650, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <CheckCircle2 size={14} /> Accepted
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: 'var(--dim)', fontStyle: 'italic', margin: 0, padding: '12px 16px', background: '#faf9f6', borderRadius: 12 }}>
                          No applications received for this referral yet. Eligible agents will appear here when they apply.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="coterie-card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--dim)' }}>
            <Briefcase size={34} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
            <h3 style={{ font: '500 18px var(--font-display)', color: 'var(--ink)', marginBottom: 6 }}>No referrals found in this view</h3>
            <p style={{ fontSize: 13.5, marginBottom: 16 }}>Post a buyer or seller referral to connect with verified agents across the platform.</p>
            <button className="coterie-btn-primary" onClick={onPostReferralClick}>
              <Plus size={16} /> Post Your First Referral
            </button>
          </div>
        )}
      </div>
    );
  };

  // 4. VIEW: MY APPLICATIONS
  const renderMyApplicationsView = () => {
    const tabs = ['All', 'Submitted', 'Under Review', 'Shortlisted', 'Accepted', 'Rejected'];
    const filteredApps = myApplications.filter(app => {
      const s = String(app.status || '').toUpperCase();
      if (myAppSubTab === 'All') return true;
      if (myAppSubTab === 'Submitted') return s === 'SUBMITTED' || s === 'PENDING';
      if (myAppSubTab === 'Under Review') return s === 'UNDER_REVIEW';
      if (myAppSubTab === 'Shortlisted') return s === 'SHORTLISTED';
      if (myAppSubTab === 'Accepted') return s === 'ACCEPTED';
      if (myAppSubTab === 'Rejected') return s === 'REJECTED' || s === 'WITHDRAWN';
      return true;
    });

    return (
      <div className="coterie-applications-flow">
        <div className="coterie-welcome-header">
          <div>
            <span className="pp-eyebrow-chip" style={{ background: 'var(--honey-2)', color: 'var(--honey-ink)', marginBottom: 8, display: 'inline-flex', padding: '4px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
              <FileText size={12} style={{ marginRight: 4 }} /> MY SUBMITTED APPLICATIONS
            </span>
            <h1>My Applications</h1>
            <p>Track the progress of referrals you have applied to, from submission to acceptance.</p>
          </div>
          <button className="coterie-btn-primary" onClick={() => handleViewChange('marketplace')}>
            Browse Marketplace <ArrowRight size={14} />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="coterie-subtabs-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`coterie-subtab-btn ${myAppSubTab === t ? 'active' : ''}`}
              onClick={() => setMyAppSubTab(t)}
            >
              {t}
              <span className="coterie-subtab-count">
                {t === 'All' ? myApplications.length : myApplications.filter(a => {
                  const s = String(a.status || '').toUpperCase();
                  if (t === 'Submitted') return s === 'SUBMITTED' || s === 'PENDING';
                  if (t === 'Under Review') return s === 'UNDER_REVIEW';
                  if (t === 'Shortlisted') return s === 'SHORTLISTED';
                  if (t === 'Accepted') return s === 'ACCEPTED';
                  if (t === 'Rejected') return s === 'REJECTED' || s === 'WITHDRAWN';
                  return false;
                }).length}
              </span>
            </button>
          ))}
        </div>

        {filteredApps.length > 0 ? (
          <div className="coterie-applications-list" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {filteredApps.map(app => {
              const status = String(app.status || 'SUBMITTED').toUpperCase();
              const isAccepted = status === 'ACCEPTED';
              const isShortlisted = status === 'SHORTLISTED';
              const isUnderReview = status === 'UNDER_REVIEW';
              const title = toTitleCase(app.referralTitle || 'Referral Application');

              return (
                <div className="coterie-card coterie-application-card" key={app.id} style={{ padding: '24px 28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {isAccepted ? (
                          <span className="coterie-pill-executed">
                            <span className="coterie-pill-dot dot-green" /> APPLICATION ACCEPTED
                          </span>
                        ) : isShortlisted ? (
                          <span className="coterie-pill-waiting" style={{ background: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' }}>
                            <span className="coterie-pill-dot" style={{ background: '#7c3aed' }} /> SHORTLISTED
                          </span>
                        ) : isUnderReview ? (
                          <span className="coterie-pill-urgent">
                            <span className="coterie-pill-dot dot-amber" /> UNDER REVIEW
                          </span>
                        ) : (
                          <span className="coterie-pill-waiting">
                            <span className="coterie-pill-dot dot-blue" /> SUBMITTED
                          </span>
                        )}
                        <span className="coterie-contract-type-pill">
                          {app.referralType ? toTitleCase(app.referralType) : 'Client Referral'}
                        </span>
                      </div>

                      <h2 style={{ font: '700 20px "Outfit", system-ui, sans-serif', color: '#1f1f1d', margin: '4px 0 6px', letterSpacing: '-0.01em' }}>
                        {title}
                      </h2>
                      <p style={{ fontSize: 13.5, color: '#6c685f', margin: 0, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <MapPin size={13} style={{ color: '#d97706' }} /> {app.referralCity ? `${app.referralCity}, ${app.referralState || ''}` : 'Regional Market'}
                        </span>
                        <span>·</span>
                        <span>Fee: <b>{app.referralFeePercent != null ? `${app.referralFeePercent}%` : '25%'}</b> Net Commission</span>
                      </p>
                    </div>

                    <div>
                      {isAccepted ? (
                        <button className="coterie-btn-primary coterie-btn-sign-urgent" onClick={() => handleViewChange('agreements')}>
                          <FileSignature size={15} /> Review & Sign Agreement →
                        </button>
                      ) : status !== 'WITHDRAWN' && status !== 'REJECTED' && (
                        <button className="coterie-btn-outline" onClick={() => onWithdrawApplication(app.id)}>
                          Withdraw Application
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Step Pipeline Stepper */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 0', background: '#faf8f3', border: '1px solid #ede7db', borderRadius: 14, padding: '14px 18px' }}>
                    {[
                      { key: 'SUBMITTED', label: '1. Submitted' },
                      { key: 'UNDER_REVIEW', label: '2. Under Review' },
                      { key: 'SHORTLISTED', label: '3. Shortlisted' },
                      { key: 'ACCEPTED', label: '4. Accepted' }
                    ].map((step, idx) => {
                      const isReached = (
                        (idx === 0 && ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED'].includes(status)) ||
                        (idx === 1 && ['UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED'].includes(status)) ||
                        (idx === 2 && ['SHORTLISTED', 'ACCEPTED'].includes(status)) ||
                        (idx === 3 && status === 'ACCEPTED')
                      );
                      const isCurrent = (
                        (idx === 0 && status === 'SUBMITTED') ||
                        (idx === 1 && status === 'UNDER_REVIEW') ||
                        (idx === 2 && status === 'SHORTLISTED') ||
                        (idx === 3 && status === 'ACCEPTED')
                      );

                      return (
                        <div key={step.key} style={{ textAlign: 'center' }}>
                          <div style={{ height: 4, borderRadius: 999, background: isReached ? (isCurrent ? '#f59e0b' : '#10b981') : '#e5dfd2', marginBottom: 7, transition: 'all 0.3s ease' }} />
                          <small style={{ fontSize: 11.5, fontWeight: isReached ? 700 : 500, color: isReached ? '#1e1e1c' : '#8c867a', display: 'block' }}>
                            {step.label}
                          </small>
                        </div>
                      );
                    })}
                  </div>

                  {app.pitchNote && (
                    <div style={{ background: '#faf9f6', border: '1px solid #f0ebe1', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: '#555147', fontStyle: 'italic', marginTop: 12 }}>
                      <strong style={{ fontStyle: 'normal', display: 'block', color: '#1e1e1c', marginBottom: 4, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your Pitch Note:</strong>
                      "{app.pitchNote}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="coterie-card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--dim)' }}>
            <FileText size={34} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
            <h3 style={{ font: '500 18px var(--font-display)', color: 'var(--ink)', marginBottom: 6 }}>No applications found</h3>
            <p style={{ fontSize: 13.5, marginBottom: 16 }}>Explore open opportunities on the marketplace and submit applications.</p>
            <button className="coterie-btn-primary" onClick={() => handleViewChange('marketplace')}>
              Explore Marketplace
            </button>
          </div>
        )}
      </div>
    );
  };

  // 5. VIEW: AGREEMENTS
  const renderAgreementsView = () => {
    const tabs = ['All', 'Awaiting your signature', 'Waiting for other party', 'Completed'];

    // Count completed / executed agreements
    const completedAgreementsCount = allUserAgreements.filter(ag => {
      const isReferring = ag.referringProfessionalId === user?.uid;
      const referringSigned = !!(ag.referrerSignature?.signedAt || ag.signedByReferring);
      const receivingSigned = !!(ag.receiverSignature?.signedAt || ag.signedByReceiving);
      const rawStatus = String(ag.status || '').toUpperCase().replaceAll(' ', '_');
      return ['SIGNED', 'COMPLETED', 'ACTIVE', 'EXECUTED'].includes(rawStatus) || (referringSigned && receivingSigned);
    }).length;

    const filteredAgreements = allUserAgreements.filter(ag => {
      const isReferring = ag.referringProfessionalId === user?.uid;
      const referringSigned = !!(ag.referrerSignature?.signedAt || ag.signedByReferring);
      const receivingSigned = !!(ag.receiverSignature?.signedAt || ag.signedByReceiving);
      const mySignature = isReferring ? ag.referrerSignature : ag.receiverSignature;
      const hasSigned = !!(mySignature?.signedAt || (isReferring ? ag.signedByReferring : ag.signedByReceiving));
      const rawStatus = String(ag.status || '').toUpperCase().replaceAll(' ', '_');
      const isExecuted = ['SIGNED', 'COMPLETED', 'ACTIVE', 'EXECUTED'].includes(rawStatus) || (referringSigned && receivingSigned);

      const canSign = !hasSigned && (isReferring
        ? ['DRAFT', 'PENDING_REFERRER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(rawStatus)
        : ['PENDING_RECEIVER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(rawStatus));

      if (agreementSubTab === 'All') return true;
      if (agreementSubTab === 'Awaiting your signature') return canSign;
      if (agreementSubTab === 'Waiting for other party') return !canSign && !isExecuted && !['DECLINED', 'CANCELLED'].includes(rawStatus);
      if (agreementSubTab === 'Completed') return isExecuted;
      return true;
    });

    return (
      <div className="coterie-agreements-flow">
        {/* Header */}
        <div className="coterie-welcome-header">
          <div>
            <span className="pp-eyebrow-chip" style={{ background: '#fdf6e2', color: '#8a6200', border: '1px solid rgba(235, 192, 75, 0.4)', marginBottom: 10, display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
              <FileSignature size={13} style={{ marginRight: 6 }} /> REAL-TIME CONTRACT WORKSPACE
            </span>
            <h1 style={{ font: '600 32px var(--font-display)', color: '#1d1d1b', margin: '4px 0 8px', letterSpacing: '-0.02em' }}>
              Referral Contracts & Signatures
            </h1>
            <p style={{ fontSize: 14.5, color: '#68655d', margin: 0, maxWidth: 680 }}>
              Live digital signing lifecycle, automated counter-signatures, and legally binding referral commission agreements.
            </p>
          </div>
        </div>

        {/* Real-time KPI Stats Banner */}
        <div className="coterie-agreements-stats-grid">
          <div
            className={`coterie-agreement-kpi ${agreementSubTab === 'All' ? 'is-selected' : ''}`}
            onClick={() => setAgreementSubTab('All')}
          >
            <div className="coterie-kpi-icon icon-neutral">
              <FileSignature size={20} />
            </div>
            <div className="coterie-kpi-info">
              <span className="coterie-kpi-num">{allUserAgreements.length}</span>
              <span className="coterie-kpi-lbl">Total Contracts</span>
            </div>
            <div className="coterie-kpi-tag">Active Portfolio</div>
          </div>

          <div
            className={`coterie-agreement-kpi ${agreementsNeedingAction.length > 0 ? 'kpi-urgent' : ''} ${agreementSubTab === 'Awaiting your signature' ? 'is-selected' : ''}`}
            onClick={() => setAgreementSubTab('Awaiting your signature')}
          >
            <div className="coterie-kpi-icon icon-urgent">
              <AlertCircle size={20} />
            </div>
            <div className="coterie-kpi-info">
              <span className="coterie-kpi-num">{agreementsNeedingAction.length}</span>
              <span className="coterie-kpi-lbl">Awaiting Your Signature</span>
            </div>
            <div className={`coterie-kpi-tag ${agreementsNeedingAction.length > 0 ? 'tag-urgent' : ''}`}>
              {agreementsNeedingAction.length > 0 ? '⚡ Action Required' : 'All Clear'}
            </div>
          </div>

          <div
            className={`coterie-agreement-kpi kpi-completed ${agreementSubTab === 'Completed' ? 'is-selected' : ''}`}
            onClick={() => setAgreementSubTab('Completed')}
          >
            <div className="coterie-kpi-icon icon-success">
              <ShieldCheck size={20} />
            </div>
            <div className="coterie-kpi-info">
              <span className="coterie-kpi-num">{completedAgreementsCount}</span>
              <span className="coterie-kpi-lbl">Fully Executed</span>
            </div>
            <div className="coterie-kpi-tag tag-success">✓ Legally Enforceable</div>
          </div>
        </div>

        {/* Sub-tabs bar */}
        <div className="coterie-subtabs-bar" style={{ marginTop: 24, marginBottom: 20 }}>
          {tabs.map(t => {
            let count = 0;
            if (t === 'All') count = allUserAgreements.length;
            else if (t === 'Awaiting your signature') count = agreementsNeedingAction.length;
            else if (t === 'Waiting for other party') count = agreementsWaitingOther.length;
            else if (t === 'Completed') count = completedAgreementsCount;

            return (
              <button
                key={t}
                className={`coterie-subtab-btn ${agreementSubTab === t ? 'active' : ''}`}
                onClick={() => setAgreementSubTab(t)}
              >
                {t}
                <span className="coterie-subtab-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Agreements List */}
        {filteredAgreements.length > 0 ? (
          <div className="coterie-agreements-list">
            {filteredAgreements.map(ag => {
              const isReferring = ag.referringProfessionalId === user?.uid;
              const partnerName = isReferring ? ag.receivingName || 'Receiving Agent' : ag.referringName || 'Referring Agent';
              const partnerBrokerage = isReferring ? ag.receivingBrokerage : ag.referringBrokerage;
              const partnerRole = isReferring ? 'Receiving Broker / Agent' : 'Referring Broker / Agent';
              const myRole = isReferring ? 'Referring Broker / Agent' : 'Receiving Broker / Agent';

              const referringSigned = !!(ag.referrerSignature?.signedAt || ag.signedByReferring);
              const receivingSigned = !!(ag.receiverSignature?.signedAt || ag.signedByReceiving);
              const mySignature = isReferring ? ag.referrerSignature : ag.receiverSignature;
              const hasSigned = !!(mySignature?.signedAt || (isReferring ? ag.signedByReferring : ag.signedByReceiving));

              const rawStatus = String(ag.status || 'DRAFT').toUpperCase().replaceAll(' ', '_');
              const isExecuted = ['SIGNED', 'COMPLETED', 'ACTIVE', 'EXECUTED'].includes(rawStatus) || (referringSigned && receivingSigned);

              const canSign = !hasSigned && (isReferring
                ? ['DRAFT', 'PENDING_REFERRER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(rawStatus)
                : ['PENDING_RECEIVER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(rawStatus));

              const title = toTitleCase(ag.referralTitle || ag.referralSnapshot?.title || 'Real Estate Referral Agreement');
              const fee = ag.feePercent || ag.referralSnapshot?.feePercent || '25';
              const contractId = (ag.agreementNumber || ag.id || '').toUpperCase();
              const shortId = contractId.slice(0, 8);
              const isCopied = copiedAgreementId === ag.id;

              const createdDateStr = formatAgreementDate(ag.createdAt);
              const refSignDateStr = formatAgreementDate(ag.referrerSignature?.signedAt);
              const recSignDateStr = formatAgreementDate(ag.receiverSignature?.signedAt);

              // Partner initials
              const partnerInitials = partnerName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'PA';

              // Flow step calculations
              const step1Done = true;
              const step2Done = referringSigned;
              const step3Done = receivingSigned;
              const step4Done = isExecuted;

              // Flow progress bar percentage
              let flowProgressWidth = 15;
              if (isExecuted) {
                flowProgressWidth = 100;
              } else if (referringSigned && receivingSigned) {
                flowProgressWidth = 85;
              } else if (referringSigned || receivingSigned) {
                flowProgressWidth = 55;
              } else {
                flowProgressWidth = 20;
              }

              return (
                <div className="coterie-agreement-card" key={ag.id}>
                  {/* Top Bar: ID, Status Badge, Title */}
                  <div className="coterie-agreement-top">
                    <div className="coterie-agreement-heading-block">
                      <div className="coterie-agreement-badge-row">
                        <button
                          type="button"
                          className="coterie-agreement-id-chip"
                          onClick={() => handleCopyAgreementId(ag.id)}
                          title="Click to copy Agreement ID"
                        >
                          <span>AGREEMENT #{shortId}</span>
                          {isCopied ? <Check size={12} style={{ color: '#059669' }} /> : <Copy size={12} />}
                          {isCopied && <span className="coterie-copied-hint">Copied!</span>}
                        </button>

                        {isExecuted ? (
                          <span className="coterie-pill-executed">
                            <span className="coterie-pill-dot dot-green" /> FULLY EXECUTED & BINDING
                          </span>
                        ) : canSign ? (
                          <span className="coterie-pill-urgent">
                            <span className="coterie-pill-dot dot-amber" /> ACTION REQUIRED: SIGN CONTRACT
                          </span>
                        ) : (
                          <span className="coterie-pill-waiting">
                            <span className="coterie-pill-dot dot-blue" /> AWAITING PARTNER SIGNATURE
                          </span>
                        )}

                        <span className="coterie-contract-type-pill">
                          E-Sign Escrow · Standard Form
                        </span>
                      </div>

                      <h2 className="coterie-agreement-title">
                        {title}
                      </h2>

                      <div className="coterie-agreement-partner-line">
                        <div className="coterie-partner-avatar">
                          {partnerInitials}
                        </div>
                        <div className="coterie-partner-info-text">
                          <span className="coterie-partner-name-role">
                            Partner: <b>{partnerName}</b> {partnerBrokerage ? `(${partnerBrokerage})` : ''}
                          </span>
                          <span className="coterie-partner-subrole">
                            · {partnerRole}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="coterie-agreement-quick-action">
                      {canSign ? (
                        <button className="coterie-btn-primary coterie-btn-sign-urgent" onClick={() => onOpenAgreementModal(ag)}>
                          <FileSignature size={15} /> Review & Sign Now
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {ag.document?.storagePath && (
                            <button className="coterie-btn-outline" onClick={() => onDownloadAgreement?.(ag)} title="Download Executed PDF">
                              <Download size={14} /> PDF
                            </button>
                          )}
                          <button className="coterie-btn-secondary" onClick={() => onOpenAgreementModal(ag)}>
                            View Agreement <ExternalLink size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* REAL-TIME CONTRACT LIFECYCLE FLOW TRACKER */}
                  <div className="coterie-agreement-flow-container">
                    <div className="coterie-flow-header">
                      <div className="coterie-flow-title">
                        <Sparkles size={14} style={{ color: '#d97706' }} />
                        <span>Real-Time Agreement Execution Pipeline</span>
                      </div>
                      <div className="coterie-flow-status-text">
                        {isExecuted
                          ? '✓ Contract fully executed · Legally bound in escrow'
                          : canSign
                            ? '⚡ Waiting for your signature to activate'
                            : `⏳ Waiting for partner (${partnerName}) signature`}
                      </div>
                    </div>

                    <div className="coterie-flow-stepper">
                      {/* Connecting Background Line */}
                      <div className="coterie-flow-track-bg">
                        <div
                          className="coterie-flow-track-fill"
                          style={{ width: `${flowProgressWidth}%` }}
                        />
                      </div>

                      {/* Step 1: Draft Terms Generated */}
                      <div className={`coterie-flow-node ${step1Done ? 'is-done' : 'is-pending'}`}>
                        <div className="coterie-node-circle">
                          <CheckCircle2 size={16} />
                        </div>
                        <div className="coterie-node-body">
                          <span className="coterie-node-step">STAGE 1</span>
                          <b className="coterie-node-name">Terms Drafted</b>
                          <small className="coterie-node-desc">Application Accepted</small>
                          <span className="coterie-node-time">{createdDateStr || 'Initiated'}</span>
                        </div>
                      </div>

                      {/* Step 2: Referring Agent Signature */}
                      <div className={`coterie-flow-node ${step2Done ? 'is-done' : (isReferring && canSign ? 'is-active-action' : 'is-pending')}`}>
                        <div className="coterie-node-circle">
                          {step2Done ? <CheckCircle2 size={16} /> : (isReferring && canSign ? <AlertCircle size={16} /> : <Clock size={16} />)}
                        </div>
                        <div className="coterie-node-body">
                          <span className="coterie-node-step">STAGE 2</span>
                          <b className="coterie-node-name">Referring Signature</b>
                          <small className="coterie-node-desc">
                            {ag.referrerSignature?.signerName || ag.referringParty?.name || ag.referringName || 'Referring Broker'}
                          </small>
                          <span className={`coterie-node-status-badge ${step2Done ? 'badge-signed' : (isReferring && canSign ? 'badge-action' : 'badge-wait')}`}>
                            {step2Done ? (refSignDateStr ? `Signed ${refSignDateStr}` : '✓ Signed') : (isReferring ? '⚡ Sign Required' : 'Awaiting Sign')}
                          </span>
                        </div>
                      </div>

                      {/* Step 3: Receiving Agent Signature */}
                      <div className={`coterie-flow-node ${step3Done ? 'is-done' : (!isReferring && canSign ? 'is-active-action' : 'is-pending')}`}>
                        <div className="coterie-node-circle">
                          {step3Done ? <CheckCircle2 size={16} /> : (!isReferring && canSign ? <AlertCircle size={16} /> : <Clock size={16} />)}
                        </div>
                        <div className="coterie-node-body">
                          <span className="coterie-node-step">STAGE 3</span>
                          <b className="coterie-node-name">Receiving Signature</b>
                          <small className="coterie-node-desc">
                            {ag.receiverSignature?.signerName || ag.receivingParty?.name || ag.receivingName || 'Receiving Broker'}
                          </small>
                          <span className={`coterie-node-status-badge ${step3Done ? 'badge-signed' : (!isReferring && canSign ? 'badge-action' : 'badge-wait')}`}>
                            {step3Done ? (recSignDateStr ? `Signed ${recSignDateStr}` : '✓ Signed') : (!isReferring ? '⚡ Sign Required' : 'Awaiting Sign')}
                          </span>
                        </div>
                      </div>

                      {/* Step 4: Executed & Commission Escrow */}
                      <div className={`coterie-flow-node ${step4Done ? 'is-done' : 'is-upcoming'}`}>
                        <div className="coterie-node-circle">
                          {step4Done ? <ShieldCheck size={16} /> : <Lock size={16} />}
                        </div>
                        <div className="coterie-node-body">
                          <span className="coterie-node-step">STAGE 4</span>
                          <b className="coterie-node-name">Legally Bound</b>
                          <small className="coterie-node-desc">
                            {step4Done ? 'Escrow Protected' : 'Awaiting Execution'}
                          </small>
                          <span className={`coterie-node-status-badge ${step4Done ? 'badge-signed' : 'badge-wait'}`}>
                            {step4Done ? `${fee}% Net Active` : 'Pending Signatures'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4-COLUMN BENTO SPEC BOX */}
                  <div className="coterie-agreement-specs">
                    <div className="coterie-spec-cell">
                      <small>AGREED REFERRAL FEE</small>
                      <b className="coterie-spec-highlight">{fee}% Net Commission</b>
                      <span className="coterie-spec-note">Payable on client escrow close</span>
                    </div>

                    <div className="coterie-spec-cell">
                      <small>TRANSACTION SCOPE</small>
                      <b>{toTitleCase(ag.referralSnapshot?.representation || ag.referralSnapshot?.transactionType || 'Client Representation')}</b>
                      <span className="coterie-spec-note">{ag.referralSnapshot?.priceRange ? formatMoney(ag.referralSnapshot?.priceRange) : 'Standard MLS Agreement'}</span>
                    </div>

                    <div className="coterie-spec-cell">
                      <small>COUNTERPARTY</small>
                      <b>{partnerName}</b>
                      <span className="coterie-spec-note">{partnerBrokerage || 'Licensed Brokerage'}</span>
                    </div>

                    <div className="coterie-spec-cell">
                      <small>YOUR SIGNATURE</small>
                      <b style={{ color: hasSigned ? '#059669' : '#d97706', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {hasSigned ? (
                          <>
                            <CheckCircle2 size={14} /> Signed & Verified
                          </>
                        ) : (
                          <>
                            <AlertCircle size={14} /> Pending Your Sign-off
                          </>
                        )}
                      </b>
                      <span className="coterie-spec-note">
                        {hasSigned
                          ? `Recorded on ${(isReferring ? refSignDateStr : recSignDateStr) || createdDateStr || 'file'}`
                          : 'Action needed to bind contract'}
                      </span>
                    </div>
                  </div>

                  {/* FOOTER AUDIT TRAIL & ACTIONS */}
                  <div className="coterie-agreement-foot">
                    <div className="coterie-audit-pill">
                      <Lock size={12} style={{ color: '#059669' }} />
                      <span>ESIGN Act & UETA Compliant · SHA-256 Digital Audit Trail Logged</span>
                    </div>

                    <div className="coterie-foot-action-wrap">
                      {canSign ? (
                        <button className="coterie-btn-primary coterie-btn-sign-urgent" onClick={() => onOpenAgreementModal(ag)}>
                          <FileSignature size={15} /> Sign Agreement Now →
                        </button>
                      ) : (
                        <button className="coterie-btn-secondary" onClick={() => onOpenAgreementModal(ag)}>
                          View Full Agreement <ExternalLink size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="coterie-agreement-empty-box">
            <div className="coterie-empty-icon-wrap">
              <FileSignature size={38} />
            </div>
            <h3>No agreements found in "{agreementSubTab}"</h3>
            <p>
              When a referral application is accepted, the platform automatically generates a legally binding referral contract with digital e-signatures for both brokerages.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
              <button className="coterie-btn-primary" onClick={() => handleViewChange('marketplace')}>
                Explore Marketplace
              </button>
              <button className="coterie-btn-secondary" onClick={() => handleViewChange('my-referrals')}>
                View My Referrals
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="coterie-portal">
      <CoterieSvgSprite />

      <main className="stage">
        <div className="app">
          {/* Top Bar with Brand, 5 Animated Tabs, and Actions */}
          <header className="top">
            {/* Brand Logo & Wordmark */}
            <a className="brand" href="/" onClick={(e) => { e.preventDefault(); handleViewChange('dashboard'); }}>
              <img src="/agentreferrals-mark.svg" alt="AgentReferrals" className="brand-logo-img" />
              <span style={{ fontWeight: 600, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '2px', fontSize: 18 }}>
                <span style={{ color: '#1d1d1b' }}>Agent</span>
                <span style={{ color: '#0878f9' }}>Referrals</span>
              </span>
            </a>

            {/* Sliding Pill Navigation Tabs */}
            <nav className="tabs" aria-label="Portal Navigation">
              <span className="tabs__pill" style={pillStyle} />
              {TABS.map((tab, idx) => (
                <button
                  key={tab.id}
                  ref={el => (tabRefs.current[idx] = el)}
                  className={`tab ${activeView === tab.id ? 'is-active' : ''}`}
                  onClick={() => handleViewChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Top Right Tools */}
            <div className="top__tools" style={{ position: 'relative' }}>
              {/* + Post a Referral chip button */}
              <button className="coterie-btn-honey" style={{ padding: '8px 16px', fontSize: 13 }} onClick={onPostReferralClick}>
                <Plus size={15} /> Post Referral
              </button>

              {/* Notifications round button */}
              <button
                className="round-btn"
                title="Notifications"
                aria-label="Notifications"
                onClick={() => setNotifTrayOpen(!notifTrayOpen)}
              >
                <Bell size={18} />
                {unreadNotifs.length > 0 && (
                  <span className="round-btn__badge">{unreadNotifs.length}</span>
                )}
              </button>

              {/* Notifications Popover Tray */}
              {notifTrayOpen && (
                <div className="coterie-popover-tray">
                  <div className="coterie-popover-header">
                    <h4>Notifications</h4>
                    {unreadNotifs.length > 0 && (
                      <button
                        onClick={onMarkAllNotificationsRead}
                        style={{ fontSize: 11.5, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  <div className="coterie-notif-list">
                    {rawNotifications.length > 0 ? (
                      rawNotifications.slice(0, 8).map(n => (
                        <div
                          className={`coterie-notif-item ${n.unread !== false ? 'unread' : ''}`}
                          key={n.id}
                          onClick={() => {
                            setNotifTrayOpen(false);
                            onOpenNotification(n);
                          }}
                        >
                          {n.unread !== false && <span className="coterie-notif-unread-dot" />}
                          <div style={{ flex: 1 }}>
                            <strong style={{ display: 'block', color: 'var(--ink)' }}>{n.title || 'Notification'}</strong>
                            <span style={{ color: 'var(--dim)' }}>{n.message || n.body || ''}</span>
                            <small style={{ display: 'block', color: 'var(--grey)', marginTop: 2 }}>{formatTimeAgo(n.createdAt)}</small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: 'center', color: 'var(--dim)', fontSize: 12.5, padding: 12 }}>No notifications yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Profile Avatar & Menu */}
              <button
                className="round-btn"
                title="My Account"
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}
              >
                {userInitials}
              </button>

              {/* Profile Popover Menu */}
              {profileMenuOpen && (
                <div className="coterie-popover-tray" style={{ width: 220 }}>
                  <div style={{ paddingBottom: 10, marginBottom: 8, borderBottom: '1px solid var(--line)' }}>
                    <b style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)' }}>{userName}</b>
                    <small style={{ color: 'var(--dim)', fontSize: 11.5 }}>{user?.email}</small>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      className="coterie-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: 12.5 }}
                      onClick={() => { setProfileMenuOpen(false); onOpenProfile(); }}
                    >
                      <User size={14} /> My Profile
                    </button>
                    <button
                      className="coterie-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: 12.5 }}
                      onClick={() => { setProfileMenuOpen(false); onOpenSettings?.(); }}
                    >
                      <Settings size={14} /> Settings
                    </button>
                    <button
                      className="coterie-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: 12.5 }}
                      onClick={() => { setProfileMenuOpen(false); onOpenSupport?.(); }}
                    >
                      <HelpCircle size={14} /> Help & Support
                    </button>
                    <button
                      className="coterie-btn-secondary"
                      style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: 12.5, color: '#dc2626' }}
                      onClick={() => { setProfileMenuOpen(false); onLogout(); }}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* Active View Container with Coterie Transitions */}
          <div
            className={`view ${
              transitionPhase === 'exiting' ? 'coterie-view-exiting' :
              transitionPhase === 'entering' ? 'coterie-view-entering' : ''
            }`}
          >
            {activeView === 'dashboard' && renderDashboardView()}
            {activeView === 'marketplace' && renderMarketplaceView()}
            {activeView === 'my-referrals' && renderMyReferralsView()}
            {activeView === 'my-applications' && renderMyApplicationsView()}
            {activeView === 'agreements' && renderAgreementsView()}
          </div>
        </div>
      </main>
    </div>
  );
}
