import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, Bell, Bookmark, BriefcaseBusiness, Building2, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, CircleHelp, Copy,
  ClipboardCheck, ClipboardList, Clock, Compass, Eye, FileCheck, FileSignature,
  FileSpreadsheet, FileText, Filter, FolderOpen, Globe, Handshake, HelpCircle, History,
  Home, Info, KeyRound, LayoutDashboard, LifeBuoy, LockKeyhole, LogOut,
  Link2, Mail, MapPin, Menu, MessageSquare, Phone, Plus, PlusCircle, RefreshCw, Search, Send, Share2,
  Settings, ShieldAlert, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2,
  Upload, UserCheck, UserRound, Users, X, Loader2
} from 'lucide-react';
import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, writeBatch,
  onSnapshot, query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { updatePassword, updateProfile } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, storage } from './firebase';
import { getBlob, getDownloadURL, ref as storageRef } from 'firebase/storage';
import { PLATFORM_ROLES } from './roles';
import './professional-portal.css';
import './professional-reference.css';
import './professional-dashboard.css';
import './coterie.css';
import './professional-workspace-polish.css';
import CoteriePortal from './CoteriePortal';

const PIPELINE_STAGES = [
  { key: 'SELECTED', label: 'Selected', icon: UserCheck, desc: 'Professional accepted' },
  { key: 'AGREEMENT', label: 'Agreement', icon: FileSignature, desc: 'Referral contract signature' },
  { key: 'REFERRED', label: 'Referred', icon: Send, desc: 'Client intro initiated' },
  { key: 'CLIENT_CONTACT', label: 'Client Contact', icon: MessageSquare, desc: 'Direct agent-client touch' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: Compass, desc: 'Active home tours / listing' },
  { key: 'CLOSING', label: 'Closing', icon: Clock, desc: 'Under contract & escrow' },
  { key: 'COMPLETED', label: 'Completed', icon: CheckCircle2, desc: 'Closed & fee paid' }
];

const displayStatus = s => (s || 'open').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const notificationPreferenceKey = notification => {
  const category = String(notification.category || notification.type || '').toLowerCase();
  if (category.includes('application')) return 'applications';
  if (category.includes('agreement')) return 'agreements';
  if (category.includes('referral')) return 'referrals';
  return 'account';
};
const DEFAULT_NOTIFICATION_PREFERENCES = { referrals: true, applications: true, agreements: true, account: true };
const VIRTUAL_CARD_THEMES = [
  { id: 'coastal', label: 'Coastal blue', gradient: 'linear-gradient(135deg,#0e5e91,#398dc0 58%,#81c6d8)', accent: '#d8f4ff' },
  { id: 'terracotta', label: 'Terracotta', gradient: 'linear-gradient(135deg,#823c32,#c66a4f 58%,#efb182)', accent: '#ffeadb' },
  { id: 'evergreen', label: 'Evergreen', gradient: 'linear-gradient(135deg,#174b42,#287968 58%,#82b99a)', accent: '#ddf7e8' },
  { id: 'midnight', label: 'Midnight', gradient: 'linear-gradient(135deg,#172846,#354d78 58%,#748bb5)', accent: '#e4edff' }
];
const formatMoney = (val) => {
  if (val == null || val === '') return 'Not provided';
  const numericValue = typeof val === 'number' ? val : Number(String(val).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(numericValue)) return String(val);
  const normalizedValue = typeof val === 'number' && numericValue > 1000000 ? numericValue / 100 : numericValue;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(normalizedValue);
};
const formatPostedTime = value => {
  const date = value?.toDate?.() || (value instanceof Date ? value : null);
  if (!date || !Number.isFinite(date.getTime())) return null;
  const hours = Math.max(0, Math.floor((Date.now() - date.getTime()) / 3600000));
  if (hours < 1) return 'Posted just now';
  if (hours < 24) return `Posted ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `Posted ${days}d ago` : `Posted ${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)}`;
};

export default function ProfessionalPanel({ user, profile, connectionError, onLogout }) {
  // Navigation
  const [page, setPage] = useState(() => {
    const route = window.location.pathname.split('/').filter(Boolean)[0];
    return route === 'agreements' ? 'agreements' : ['dashboard', 'marketplace', 'post-referral', 'my-referrals', 'applications', 'saved', 'pipeline', 'notifications', 'profile', 'brokerage', 'verification', 'documents', 'settings', 'support'].includes(route) ? route : 'dashboard';
  });
  const [subTab, setSubTab] = useState('All');
  const [mobileNav, setMobileNav] = useState(false);
  const [marketFiltersExpanded, setMarketFiltersExpanded] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const globalSearchRef = useRef(null);
  const headerControlsRef = useRef(null);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [referralsLoading, setReferralsLoading] = useState(true);
  const [referralsError, setReferralsError] = useState('');
  const [referralsRetry, setReferralsRetry] = useState(0);

  useEffect(() => setProfilePhotoFailed(false), [user?.photoURL]);
  // REAL DATABASE STATE (Initialized empty - loaded purely from Firestore subscriptions)
  const [dbProfile, setDbProfile] = useState(profile || null);
  const [rawReferrals, setRawReferrals] = useState([]);
  const [rawApplications, setRawApplications] = useState([]);
  const [rawSaved, setRawSaved] = useState([]);
  const [rawAgreements, setRawAgreements] = useState([]);
  const [agreementEvents, setAgreementEvents] = useState([]);
  const agreementViewRecordedRef = useRef('');
  const [rawNotifications, setRawNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationsRetry, setNotificationsRetry] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState('All');
  const [notificationSearch, setNotificationSearch] = useState('');
  const [markingNotificationsRead, setMarkingNotificationsRead] = useState(false);
  const [notificationActionError, setNotificationActionError] = useState('');
  const [rawActivity, setRawActivity] = useState([]);
  useEffect(() => {
    let active = true;
    let objectUrl = '';
    const path = dbProfile?.photoStoragePath;
    setProfilePhotoFailed(false);
    if (!path || !storage) { setProfilePhotoUrl(''); return undefined; }
    getBlob(storageRef(storage, path)).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setProfilePhotoUrl(objectUrl);
    }).catch(() => { if (active) setProfilePhotoUrl(''); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [dbProfile?.photoStoragePath]);

  // Modals & Selected items
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [selectedAgreement, setSelectedAgreement] = useState(null);
  const [notificationFromCache, setNotificationFromCache] = useState(true);
  const [signatureName, setSignatureName] = useState('');
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [electronicConsent, setElectronicConsent] = useState(false);
  const [signatureMethod, setSignatureMethod] = useState('typed');
  const [signatureStrokes, setSignatureStrokes] = useState([]);
  const signatureCanvasRef = useRef(null);
  const signatureStrokeRef = useRef(null);
  const signaturePointerDownRef = useRef(false);
  const [signingAgreement, setSigningAgreement] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const [amendmentSummary, setAmendmentSummary] = useState('');
  const [creatingAmendment, setCreatingAmendment] = useState(false);
  useEffect(() => {
    if (!db || !selectedAgreement?.id) { setAgreementEvents([]); return undefined; }
    return onSnapshot(query(collection(db, 'agreements', selectedAgreement.id, 'events'), orderBy('createdAt', 'asc')), snapshot => {
      setAgreementEvents(snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    }, error => console.warn('Agreement audit trail could not be loaded:', error?.code || error?.message));
  }, [selectedAgreement?.id]);
  const trackAgreementView = id => {
    if (!functions || !id || agreementViewRecordedRef.current === id) return;
    agreementViewRecordedRef.current = id;
    httpsCallable(functions, 'recordAgreementView')({ agreementId: id }).catch(error => console.warn('Agreement view audit could not be saved:', error?.code || error?.message));
  };
  const openAgreement = ag => {
    setSelectedAgreement(ag); setSignatureName(''); setSignatureConsent(false); setPrivacyConsent(false); setElectronicConsent(false); setSignatureMethod('typed'); setSignatureStrokes([]); setSignatureError(''); setAmendmentSummary('');
    const isReferring = ag.referringProfessionalId === user?.uid;
    const mySignature = isReferring ? ag.referrerSignature : ag.receiverSignature;
    const status = String(ag.status || '').toUpperCase().replaceAll(' ', '_');
    const canSign = !mySignature?.signedAt && (isReferring ? ['DRAFT', 'PENDING_REFERRER_SIGNATURE'].includes(status) : status === 'PENDING_RECEIVER_SIGNATURE');
    window.history.pushState({}, '', `/agreements/${encodeURIComponent(ag.id)}/${canSign ? 'sign' : 'review'}`);
    trackAgreementView(ag.id);
  };
  const closeAgreement = () => {
    setSelectedAgreement(null);
    agreementViewRecordedRef.current = '';
    if (window.location.pathname.startsWith('/agreements/')) window.history.replaceState({}, '', '/agreements');
  };

  useEffect(() => {
    const handleWorkspaceKeys = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        globalSearchRef.current?.focus();
      }
      if (event.key === 'Escape') {
        setMobileNav(false);
        setShowProfileMenu(false);
        setShowNotificationMenu(false);
        setSelectedReferral(null);
        setSelectedAgreement(null);
        agreementViewRecordedRef.current = '';
        if (window.location.pathname.startsWith('/agreements/')) window.history.replaceState({}, '', '/agreements');
      }
    };
    window.addEventListener('keydown', handleWorkspaceKeys);
    return () => window.removeEventListener('keydown', handleWorkspaceKeys);
  }, []);
  useEffect(() => {
    const closeHeaderMenus = event => {
      if (!headerControlsRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
        setShowNotificationMenu(false);
      }
    };
    document.addEventListener('pointerdown', closeHeaderMenus);
    return () => document.removeEventListener('pointerdown', closeHeaderMenus);
  }, []);
  useEffect(() => {
    const syncWorkspaceRoute = () => {
      const segments = window.location.pathname.split('/').filter(Boolean);
      const target = segments[0] === 'agreements' ? 'agreements' : ['dashboard', 'marketplace', 'post-referral', 'my-referrals', 'applications', 'saved', 'pipeline', 'notifications', 'profile', 'brokerage', 'verification', 'documents', 'settings', 'support'].includes(segments[0]) ? segments[0] : 'dashboard';
      setPage(target);
      if (target === 'agreements' && segments[1]) {
        const agreement = rawAgreements.find(item => item.id === segments[1]) || null;
        setSelectedAgreement(agreement);
        if (agreement) trackAgreementView(agreement.id);
      } else { setSelectedAgreement(null); agreementViewRecordedRef.current = ''; }
    };
    window.addEventListener('popstate', syncWorkspaceRoute);
    syncWorkspaceRoute();
    return () => window.removeEventListener('popstate', syncWorkspaceRoute);
  }, [rawAgreements]);

  const signaturePoint = event => {
    const canvas = signatureCanvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return null;
    return { x: Math.max(0, Math.min(720, (event.clientX - rect.left) * 720 / rect.width)), y: Math.max(0, Math.min(150, (event.clientY - rect.top) * 150 / rect.height)) };
  };
  const beginSignatureStroke = event => {
    const canvas = signatureCanvasRef.current; const point = signaturePoint(event);
    if (!canvas || !point) return;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d'); context.strokeStyle = '#143b6d'; context.lineWidth = 2.2; context.lineCap = 'round'; context.lineJoin = 'round';
    context.beginPath(); context.moveTo(point.x, point.y);
    signaturePointerDownRef.current = true; signatureStrokeRef.current = [point];
  };
  const continueSignatureStroke = event => {
    if (!signaturePointerDownRef.current) return;
    const point = signaturePoint(event); const context = signatureCanvasRef.current?.getContext('2d');
    if (!point || !context) return;
    context.lineTo(point.x, point.y); context.stroke(); signatureStrokeRef.current.push(point);
  };
  const finishSignatureStroke = () => {
    if (!signaturePointerDownRef.current) return;
    signaturePointerDownRef.current = false;
    const strokes = signatureStrokes.slice();
    if (signatureStrokeRef.current?.length) strokes.push(signatureStrokeRef.current);
    signatureStrokeRef.current = null; setSignatureStrokes(strokes);
  };
  const clearDrawnSignature = () => {
    const canvas = signatureCanvasRef.current; canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    signaturePointerDownRef.current = false; signatureStrokeRef.current = null; setSignatureStrokes([]);
  };
  const [applyModalReferral, setApplyModalReferral] = useState(null);
  const [applyPitch, setApplyPitch] = useState('');
  const [applyBrokerName, setApplyBrokerName] = useState('');
  const [applyBrokerEmail, setApplyBrokerEmail] = useState('');
  const [showManageReferralModal, setShowManageReferralModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [editingReferralId, setEditingReferralId] = useState(null);
  const [referralPage, setReferralPage] = useState(1);

  const startApplyProcess = (r) => {
    setSelectedReferral(null);
    if (rawApplications.some(application => application.referralId === r.id && application.applicantProfessionalId === user?.uid)) {
      setNotice('You have already applied to this referral. You can follow its status in My Applications.');
      navigateTo('applications', 'All');
      return;
    }
    setApplyModalReferral(r);
    setApplyPitch('');
    setApplyError('');
    setApplyBrokerName(dbProfile?.brokerName || dbProfile?.brokerageName || '');
    setApplyBrokerEmail(dbProfile?.brokerEmail || user?.email || '');
  };

  // Post Referral Form state
  const [postStep, setPostStep] = useState(0);
  const [postForm, setPostForm] = useState({
    type: 'Buyer',
    city: '',
    state: '',
    zip: '',
    propertyType: 'Residential',
    minValue: '',
    maxValue: '',
    fee: '25',
    preference: '',
    description: ''
  });

  // Settings & Profile Form Local Buffer
  const [editProfileForm, setEditProfileForm] = useState({
    displayName: '',
    title: '',
    brokerageName: '',
    brokerageAddress: '',
    licenseNumber: '',
    licenseState: '',
    yearsExperience: '',
    phone: '',
    website: '',
    bio: '',
    specialties: [],
    serviceAreas: [],
    languages: []
  });
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmPasswordVal, setConfirmPasswordVal] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [virtualCardTheme, setVirtualCardTheme] = useState('coastal');
  const [cardLinkCopied, setCardLinkCopied] = useState(false);
  const virtualCardUrl = typeof window !== 'undefined' && user?.uid ? `${window.location.origin}/agent/${encodeURIComponent(user.uid)}` : '';
  useEffect(() => setVirtualCardTheme(dbProfile?.virtualCard?.theme || 'coastal'), [dbProfile?.virtualCard?.theme]);

  const handleShareVirtualCard = async () => {
    if (!virtualCardUrl) return;
    const saved = await handleSaveProfile();
    if (!saved) return;
    const shareData = { title: `${editProfileForm.displayName || name || 'My'} · AgentReferrals`, text: 'Connect with me on AgentReferrals and share real-estate referral opportunities.', url: virtualCardUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(virtualCardUrl); setCardLinkCopied(true); window.setTimeout(() => setCardLinkCopied(false), 2200); }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(virtualCardUrl); setCardLinkCopied(true); window.setTimeout(() => setCardLinkCopied(false), 2200); }
      catch { setNotice('Could not share automatically. Copy the card URL from the link field.'); }
    }
  };

  // Search & Filter state for Marketplace
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState('All');
  const [propTypeFilter, setPropTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Newest');
  const [feeFilter, setFeeFilter] = useState('All fees');
  const [locationFilter, setLocationFilter] = useState('All locations');
  const [budgetFilter, setBudgetFilter] = useState('All budgets');

  // -------------------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTIONS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!db || !user) return;
    setLoading(true);
    setReferralsLoading(true);
    setReferralsError('');

    // 1. User Profile Realtime Listener
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDbProfile(data);
        setEditProfileForm({
          displayName: data.displayName || user.displayName || '',
          title: data.title || '',
          brokerageName: data.brokerageName || '',
          brokerageAddress: data.brokerageAddress || '',
          licenseNumber: data.licenseNumber || '',
          licenseState: data.licenseState || '',
          yearsExperience: data.yearsExperience || '',
          phone: data.phoneNumber || data.phone || user.phoneNumber || '',
          website: data.website || '',
          bio: data.bio || '',
          specialties: Array.isArray(data.specialties) ? data.specialties : [],
          serviceAreas: Array.isArray(data.serviceAreas) ? data.serviceAreas : [],
          languages: Array.isArray(data.languages) ? data.languages : []
        });
      }
    }, (err) => console.warn('User profile listener notice:', err));

    const subscribeMerged = (queries, setter, label, after) => {
      const batches = queries.map(() => []);
      const settled = new Set();
      const markSettled = index => {
        if (settled.has(index)) return;
        settled.add(index);
        if (settled.size === queries.length) after?.();
      };
      return queries.map((entry, index) => onSnapshot(entry, snap => {
        batches[index] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setter([...new Map(batches.flat().map(item => [item.id, item])).values()]);
        markSettled(index);
      }, err => {
        console.warn(`${label} listener notice:`, err);
        if (label === 'Referrals') setReferralsError('Unable to load referral data. Check your connection and retry.');
        markSettled(index);
      }));
    };

    const unsubs = [
      ...subscribeMerged([
        query(collection(db, 'referrals'), where('status', 'in', ['open', 'Published', 'Active', 'published', 'active'])),
        query(collection(db, 'referrals'), where('creatorProfessionalId', '==', user.uid))
      ], setRawReferrals, 'Referrals', () => { setReferralsLoading(false); setLoading(false); }),
      ...subscribeMerged([
        query(collection(db, 'applications'), where('applicantProfessionalId', '==', user.uid)),
        query(collection(db, 'applications'), where('referralCreatorId', '==', user.uid))
      ], setRawApplications, 'Applications'),
      onSnapshot(query(collection(db, 'saved_referrals'), where('userId', '==', user.uid)), snap => setRawSaved(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn('Saved listener notice:', err)),
      ...subscribeMerged([
        query(collection(db, 'agreements'), where('referringProfessionalId', '==', user.uid)),
        query(collection(db, 'agreements'), where('receivingProfessionalId', '==', user.uid))
      ], setRawAgreements, 'Agreements'),
      ...subscribeMerged([
        query(collection(db, 'activity'), where('userId', '==', user.uid)),
        query(collection(db, 'activity'), where('targetUserId', '==', user.uid))
      ], setRawActivity, 'Activity')
    ];

    return () => {
      unsubUser();
      unsubs.forEach(unsub => unsub());
    };
  }, [user, referralsRetry]);

  // Dedicated realtime inbox listener so a notification read error does not hide the rest of the workspace.
  useEffect(() => {
    if (!db || !user?.uid) {
      setRawNotifications([]);
      setNotificationsLoading(false);
      setNotificationsError('');
      return undefined;
    }
    setNotificationsLoading(true);
    setNotificationsError('');
    return onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', user.uid)),
      { includeMetadataChanges: true },
      snap => {
        const toMillis = value => {
          if (value?.toMillis) return value.toMillis();
          if (value?.toDate) return value.toDate().getTime();
          const date = value instanceof Date ? value : value ? new Date(value) : null;
          return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
        };
        setNotificationFromCache(snap.metadata.fromCache);
        setRawNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)));
        setNotificationsLoading(false);
      },
      err => {
        console.error('Notifications listener failed:', err);
        setNotificationsError('Unable to load notifications. Check your connection and try again.');
        setNotificationsLoading(false);
      }
    );
  }, [user?.uid, notificationsRetry]);

  // Derived Identity & Dynamic Role
  const isSuperAdmin = dbProfile?.role === PLATFORM_ROLES.SUPER_ADMIN || dbProfile?.role === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || dbProfile?.role === PLATFORM_ROLES.ADMIN || dbProfile?.role === 'ADMIN';
  const userRoleLabel = isSuperAdmin ? 'Platform Super Admin' : isAdmin ? 'Platform Admin' : (dbProfile?.verificationStatus === 'approved' ? 'Verified Professional' : 'Professional · Verification Pending');
  const name = dbProfile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Professional';

  // -------------------------------------------------------------
  // DYNAMIC PROFILE COMPLETION CALCULATOR (0 to 100% strictly from database)
  // -------------------------------------------------------------
  const { profilePercent, missingFields, completedFields } = useMemo(() => {
    const checks = [
      { key: 'displayName', label: 'Full Name', done: !!(dbProfile?.displayName || user?.displayName) },
      { key: 'email', label: 'Email Address', done: !!(dbProfile?.email || user?.email) },
      { key: 'phone', label: 'Phone Number', done: !!(dbProfile?.phoneNumber || dbProfile?.phone || user?.phoneNumber) },
      { key: 'licenseNumber', label: 'Real Estate License', done: !!dbProfile?.licenseNumber },
      { key: 'brokerageName', label: 'Brokerage Name', done: !!dbProfile?.brokerageName },
      { key: 'bio', label: 'Professional Biography', done: !!(dbProfile?.bio && dbProfile.bio.trim().length > 10) },
      { key: 'serviceAreas', label: 'Service Areas', done: Array.isArray(dbProfile?.serviceAreas) && dbProfile.serviceAreas.length > 0 },
      { key: 'specialties', label: 'Specialties', done: Array.isArray(dbProfile?.specialties) && dbProfile.specialties.length > 0 },
      { key: 'verificationDocuments', label: 'Verification documents', done: dbProfile?.verificationStatus === 'approved' || (Array.isArray(dbProfile?.verificationDocuments) && dbProfile.verificationDocuments.length > 0) || (Array.isArray(dbProfile?.documents) && dbProfile.documents.length > 0) }
    ];

    const doneCount = checks.filter(c => c.done).length;
    const percent = Math.round((doneCount / checks.length) * 100);
    return {
      profilePercent: percent,
      completedFields: checks.filter(c => c.done),
      missingFields: checks.filter(c => !c.done)
    };
  }, [dbProfile, user]);

  // Derived Referral Subsets from Real Database
  const myReferrals = useMemo(() => {
    return rawReferrals.filter(r => r.creatorProfessionalId === user?.uid || r.creatorId === user?.uid);
  }, [rawReferrals, user]);

  const myApplications = useMemo(() => {
    return rawApplications.filter(a => a.applicantProfessionalId === user?.uid);
  }, [rawApplications, user]);

  const savedReferralIds = useMemo(() => {
    return new Set(rawSaved.map(s => s.referralId));
  }, [rawSaved]);

  const savedReferralsList = useMemo(() => {
    return rawReferrals.filter(r => savedReferralIds.has(r.id));
  }, [rawReferrals, savedReferralIds]);

  const activePipelineDeals = useMemo(() => {
    // Derived strictly from actual agreements and accepted applications
    return rawAgreements.filter(a => a.status !== 'Declined' && a.status !== 'Expired');
  }, [rawAgreements]);

  const unreadNotifCount = useMemo(() => {
    const preferences = dbProfile?.settings?.notificationCategories || DEFAULT_NOTIFICATION_PREFERENCES;
    return rawNotifications.filter(n => n.unread !== false && preferences[notificationPreferenceKey(n)] !== false).length;
  }, [rawNotifications, dbProfile]);

  // Marketplace filtered list
  const marketplaceReferrals = useMemo(() => {
    return rawReferrals.filter(r => {
      const isPublished = ['open', 'published', 'active', 'Published', 'Active'].includes(r.status);
      const matchSearch = `${r.title || ''} ${r.city || ''} ${r.state || ''} ${r.zip || ''} ${r.propertyType || ''} ${r.description || ''}`.toLowerCase().includes(deferredSearch.trim().toLowerCase());
      const matchType = typeFilter === 'All' || r.clientType === typeFilter;
      const matchProp = propTypeFilter === 'All' || (r.propertyType && r.propertyType.toLowerCase().includes(propTypeFilter.toLowerCase()));
      const fee = Number(r.feePercent) || 0;
      const matchFee = feeFilter === 'All fees' || (feeFilter === 'Under 15%' ? fee < 15 : feeFilter === '15–25%' ? fee >= 15 && fee <= 25 : fee > 25);
      const location = [r.city, r.state].filter(Boolean).join(', ') || 'Location not provided';
      const matchLocation = locationFilter === 'All locations' || location === locationFilter;
      const numeric = value => value == null || value === '' ? null : Number(String(value).replace(/[^\d.]/g, ''));
      const low = numeric(r.minValue) ?? 0;
      const high = numeric(r.maxValue) ?? Infinity;
      const matchBudget = budgetFilter === 'All budgets' || (budgetFilter === 'Under $250k' ? low <= 250000 : budgetFilter === '$250k–$500k' ? low <= 500000 && high >= 250000 : high >= 500000);
      return isPublished && matchSearch && matchType && matchProp && matchFee && matchLocation && matchBudget;
    }).sort((a, b) => {
      if (sortBy === 'Highest Fee') return (Number(b.feePercent) || 0) - (Number(a.feePercent) || 0);
      if (sortBy === 'Lowest Fee') return (Number(a.feePercent) || 0) - (Number(b.feePercent) || 0);
      if (sortBy === 'Oldest') return (a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0) - (b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0);
      return (b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0) - (a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0);
    });
  }, [rawReferrals, deferredSearch, typeFilter, propTypeFilter, sortBy, feeFilter, locationFilter, budgetFilter]);

  // Navigation Helper
  const navigateTo = (targetPage, initialSubTab = 'All', preserveDraft = false) => {
    if (targetPage === 'post-referral' && !preserveDraft) {
      setEditingReferralId(null);
      setPostStep(0);
      setPostForm({ type: 'Buyer', city: '', state: '', zip: '', propertyType: 'Residential', minValue: '', maxValue: '', fee: '25', preference: '', description: '' });
    }
    setPage(targetPage);
    setSubTab(initialSubTab);
    const route = targetPage === 'agreements' ? '/agreements' : `/${targetPage}`;
    if (window.location.pathname !== route) window.history.pushState({}, '', route);
    setMobileNav(false);
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // -------------------------------------------------------------
  // REAL DATABASE MUTATIONS
  // -------------------------------------------------------------
  const handleToggleSave = async (referralId) => {
    if (!db || !user) return;
    try {
      const existing = rawSaved.find(s => s.referralId === referralId);
      if (existing) {
        await deleteDoc(doc(db, 'saved_referrals', existing.id));
        setNotice('Referral removed from saved bookmarks.');
      } else {
        await addDoc(collection(db, 'saved_referrals'), {
          userId: user.uid,
          referralId: referralId,
          createdAt: serverTimestamp()
        });
        setNotice('Referral saved to bookmarks.');
      }
    } catch (err) {
      console.error('Error toggling save:', err);
      setNotice('Unable to update bookmark. Please check connection.');
    }
  };

  const handlePublishReferral = async () => {
    if (!db || !user) return;
    const feePercent = Number(postForm.fee);
    const minValue = postForm.minValue ? Number(postForm.minValue.replace(/[^\d.]/g, '')) : null;
    const maxValue = postForm.maxValue ? Number(postForm.maxValue.replace(/[^\d.]/g, '')) : null;
    if (postForm.city.trim().length < 2 || postForm.city.trim().length > 100 || postForm.state.trim().length < 2 || postForm.state.trim().length > 100 || !Number.isFinite(feePercent) || feePercent < 5 || feePercent > 50
      || (postForm.zip.trim() && !/^\d{5}(-\d{4})?$/.test(postForm.zip.trim()))
      || (minValue != null && (!Number.isFinite(minValue) || minValue <= 0)) || (maxValue != null && (!Number.isFinite(maxValue) || maxValue <= 0))
      || (minValue != null && maxValue != null && minValue > maxValue)) {
      setNotice('Check the city/state, optional 5- or 9-digit ZIP, referral fee (5–50%), and positive price range before publishing.');
      setPostStep(!postForm.city.trim() || !postForm.state.trim() ? 1 : 3);
      return;
    }
    setIsSubmitting(true);
    try {
      const newRefPayload = {
        title: `${postForm.city.trim()} ${postForm.propertyType || 'Real Estate'} ${postForm.type} Referral`,
        category: `${postForm.type} referral`,
        clientType: postForm.type,
        city: postForm.city.trim(),
        state: postForm.state.trim(),
        zip: postForm.zip.trim(),
        propertyType: postForm.propertyType,
        minValue: postForm.minValue,
        maxValue: postForm.maxValue,
        estimatedValueCents: maxValue ? Math.round(maxValue * 100) : null,
        feePercent,
        status: 'published',
        description: postForm.description.trim(),
        preferences: postForm.preference.trim(),
        creatorProfessionalId: user.uid,
        creatorName: dbProfile?.displayName || user.displayName || null,
        creatorBrokerage: dbProfile?.brokerageName || null,
        creatorEmail: user.email || null,
        updatedAt: serverTimestamp()
      };

      let referralId = editingReferralId;
      if (referralId) await updateDoc(doc(db, 'referrals', referralId), newRefPayload);
      else {
        const docRef = await addDoc(collection(db, 'referrals'), { ...newRefPayload, createdAt: serverTimestamp() });
        referralId = docRef.id;
      }

      // Add to audit activity log
      await addDoc(collection(db, 'activity'), {
        userId: user.uid,
        type: 'REFERRAL_PUBLISHED',
        title: 'Referral Published',
        description: `You published "${newRefPayload.title}" to the marketplace.`,
        referralId,
        createdAt: serverTimestamp()
      });

      setNotice('✓ Referral created and published to the real database!');
      setPostStep(0);
      setEditingReferralId(null);
      setPostForm({
        type: 'Buyer', city: '', state: '', zip: '',
        propertyType: 'Residential', minValue: '', maxValue: '', fee: '25', preference: '', description: ''
      });
      navigateTo('my-referrals', 'Published');
      setNotice('Referral published successfully.');
    } catch (err) {
      console.error('Error publishing referral:', err);
      setNotice(`Failed to publish referral: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!db || !user) return;
    setIsSubmitting(true);
    try {
      const draftPayload = {
        title: `${postForm.city.trim() ? `${postForm.city.trim()} ` : ''}${postForm.type} Referral`,
        category: `${postForm.type} referral`,
        clientType: postForm.type,
        city: postForm.city.trim(),
        state: postForm.state.trim(),
        zip: postForm.zip.trim(),
        propertyType: postForm.propertyType,
        minValue: postForm.minValue,
        maxValue: postForm.maxValue,
        feePercent: parseInt(postForm.fee) || 25,
        status: 'draft',
        description: postForm.description.trim(),
        preferences: postForm.preference.trim(),
        creatorProfessionalId: user.uid,
        creatorName: dbProfile?.displayName || user.displayName || null,
        creatorBrokerage: dbProfile?.brokerageName || null,
        updatedAt: serverTimestamp()
      };

      let referralId = editingReferralId;
      if (referralId) await updateDoc(doc(db, 'referrals', referralId), draftPayload);
      else referralId = (await addDoc(collection(db, 'referrals'), { ...draftPayload, createdAt: serverTimestamp() })).id;
      await addDoc(collection(db, 'activity'), {
        userId: user.uid, type: 'REFERRAL_DRAFT_SAVED', title: 'Referral draft saved',
        description: draftPayload.title, referralId, createdAt: serverTimestamp()
      });
      setNotice('✓ Draft saved to database.');
      setEditingReferralId(null);
      setPostStep(0);
      setPostForm({ type: 'Buyer', city: '', state: '', zip: '', propertyType: 'Residential', minValue: '', maxValue: '', fee: '25', preference: '', description: '' });
      navigateTo('my-referrals', 'Drafts');
      setNotice('Your referral draft is saved and ready to continue later.');
    } catch (err) {
      console.error('Error saving draft:', err);
      setNotice('Failed to save draft.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditDraft = referral => {
    setPostForm({
      type: referral.clientType || 'Buyer', city: referral.city || '', state: referral.state || '', zip: referral.zip || '',
      propertyType: referral.propertyType || 'Residential', minValue: referral.minValue ?? '', maxValue: referral.maxValue ?? '',
      fee: String(referral.feePercent ?? '25'), preference: referral.preferences || '', description: referral.description || ''
    });
    setEditingReferralId(referral.id);
    setPostStep(0);
    navigateTo('post-referral', 'All', true);
  };

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!db || !functions || !user || !applyModalReferral) {
      setApplyError('Application service is unavailable. Refresh the page and try again.');
      return;
    }
    if (applyPitch.trim().length < 20 || applyPitch.trim().length > 5000) {
      setApplyError('Your application note must be between 20 and 5,000 characters.');
      return;
    }
    if (applyBrokerName.trim().length < 2 || applyBrokerName.trim().length > 100 || !applyBrokerEmail.trim()) {
      setApplyError('Enter the managing broker’s full name (2–100 characters) and email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyBrokerEmail.trim())) {
      setApplyError('Enter a valid managing broker email.');
      return;
    }
    setApplyError('');
    setIsSubmitting(true);
    try {
      const r = applyModalReferral;
      const creatorId = r.creatorProfessionalId || r.creatorId;
      if (!creatorId) {
        throw new Error('The referral owner could not be verified. Contact support before applying.');
      }
      if (creatorId === user.uid) {
        throw new Error('You cannot apply to a referral you posted.');
      }

      // Check if already applied
      const alreadyApplied = rawApplications.some(a => a.referralId === r.id && a.applicantProfessionalId === user.uid);
      if (alreadyApplied) {
        setApplyModalReferral(null);
        setApplyPitch('');
        setApplyError('');
        navigateTo('applications', 'All');
        setNotice('You have already applied to this referral.');
        return;
      }

      const submit = httpsCallable(functions, 'submitReferralApplication');
      const result = await submit({ referralId: r.id, pitchNote: applyPitch.trim(), brokerName: applyBrokerName.trim(), brokerEmail: applyBrokerEmail.trim().toLowerCase() });
      if (result.data?.alreadyApplied) setNotice('You have already applied to this referral.');

      setApplyModalReferral(null);
      setApplyPitch('');
      setApplyError('');
      navigateTo('applications', 'All');
      if (!result.data?.alreadyApplied) setNotice('Application submitted. The referral owner has been notified.');
    } catch (err) {
      console.error('Error submitting application:', err);
      setApplyError(err?.message || 'We could not submit your application. Your details are still here; please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplicantDecision = async (application, newStatus) => {
    if (!functions || !user) return;
    try {
      const decide = httpsCallable(functions, 'decideReferralApplication');
      const result = await decide({ applicationId: application.id, status: newStatus });
      setNotice(newStatus === 'ACCEPTED'
        ? `Applicant accepted. Agreement ${result.data?.agreementNumber || ''} is ready for your review.`
        : `Applicant updated to: ${newStatus}`);
      if (newStatus === 'ACCEPTED') navigateTo('agreements');
      setSelectedApplicant(null);
    } catch (err) {
      console.error('Error updating applicant status:', err);
      setNotice(err?.message || 'Failed to update applicant status. Please try again.');
    }
  };

  const handleSignAgreement = async (agreementId) => {
    if (signingAgreement || !signatureConsent || !privacyConsent || !electronicConsent || signatureName.trim().length < 2 || !functions || !user) return;
    setSigningAgreement(true); setSignatureError('');
    try {
      const sign = httpsCallable(functions, 'signReferralAgreement');
      const drawnSignaturePath = signatureStrokes.map(stroke => stroke.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')).join(' ');
      const result = await sign({ agreementId, signatureName: signatureName.trim(), signatureMethod,
        ...(signatureMethod === 'drawn' ? { drawnSignaturePath } : {}),
        acceptedTerms: signatureConsent, acceptedPrivacy: privacyConsent, acceptedElectronicSignature: electronicConsent });
      setNotice(result.data?.active
        ? (result.data?.pdfReady ? 'Agreement active. The executed PDF is ready for both parties.' : 'Both signatures are recorded. The final PDF is being prepared.')
        : 'Your signature is recorded. The other party has been notified to review and sign.');
      closeAgreement();
    } catch (err) {
      console.error('Error signing agreement:', err);
      setSignatureError(err?.message || 'Signature could not be saved. Please try again.');
    } finally {
      setSigningAgreement(false);
    }
  };

  const handleDownloadAgreement = async ag => {
    if (!storage || !ag?.document?.storagePath) return;
    try {
      const blob = await getBlob(storageRef(storage, ag.document.storagePath));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = ag.document.fileName || `${ag.agreementNumber || ag.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotice(err?.message || 'The executed PDF is not available yet. Please try again shortly.');
    }
  };

  const handleRetryAgreementPdf = async agreementId => {
    if (!functions) return;
    setSigningAgreement(true); setSignatureError('');
    try {
      const finalize = httpsCallable(functions, 'retryAgreementFinalization');
      await finalize({ agreementId });
      setNotice('The executed agreement PDF is ready for both parties.');
      closeAgreement();
    } catch (err) {
      setSignatureError(err?.message || 'The final agreement could not be generated yet. Please try again.');
    } finally { setSigningAgreement(false); }
  };

  const handlePrepareAgreement = async agreementId => {
    if (!functions) return;
    setSigningAgreement(true); setSignatureError('');
    try {
      const prepare = httpsCallable(functions, 'prepareAgreementDraft');
      const result = await prepare({ agreementId });
      setNotice(`Agreement prepared using approved terms version ${result.data.agreementTemplateVersion}. Review the full text before signing.`);
    } catch (err) {
      setSignatureError(err?.message || 'The agreement draft could not be prepared.');
    } finally { setSigningAgreement(false); }
  };

  const handleCreateAgreementAmendment = async agreementId => {
    if (!functions || creatingAmendment || amendmentSummary.trim().length < 20) return;
    setCreatingAmendment(true); setSignatureError('');
    try {
      const createAmendment = httpsCallable(functions, 'createAgreementAmendment');
      const result = await createAmendment({ agreementId, summary: amendmentSummary.trim() });
      closeAgreement(); setAmendmentSummary('');
      setNotice(`Amendment ${result.data.agreementNumber} created as a new version. The original signed agreement remains unchanged.`);
    } catch (error) {
      setSignatureError(error?.message || 'The amendment could not be created.');
    } finally { setCreatingAmendment(false); }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!db || !user) return;
    const profilePhoneDigits = editProfileForm.phone.replace(/\D/g, '');
    if (editProfileForm.displayName.trim() && (editProfileForm.displayName.trim().length < 2 || editProfileForm.displayName.trim().length > 100)) {
      setNotice('Name must be between 2 and 100 characters.');
      return;
    }
    if (editProfileForm.phone.trim() && (profilePhoneDigits.length < 7 || profilePhoneDigits.length > 15)) {
      setNotice('Enter a valid phone number with 7 to 15 digits.');
      return;
    }
    if (editProfileForm.website.trim()) {
      try { const website = new URL(editProfileForm.website.trim()); if (!['http:', 'https:'].includes(website.protocol)) throw new Error(); }
      catch { setNotice('Enter a valid website URL beginning with https://.'); return; }
    }
    if (editProfileForm.bio.trim().length > 2000) {
      setNotice('Your biography must be 2,000 characters or fewer.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        displayName: editProfileForm.displayName.trim(),
        title: editProfileForm.title.trim(),
        brokerageName: editProfileForm.brokerageName.trim(),
        brokerageAddress: editProfileForm.brokerageAddress.trim(),
        licenseNumber: editProfileForm.licenseNumber.trim(),
        licenseState: editProfileForm.licenseState.trim(),
        yearsExperience: editProfileForm.yearsExperience.trim(),
        phoneNumber: editProfileForm.phone.trim(),
        phone: editProfileForm.phone.trim(),
        website: editProfileForm.website.trim(),
        bio: editProfileForm.bio.trim(),
        specialties: editProfileForm.specialties,
        serviceAreas: editProfileForm.serviceAreas,
        languages: editProfileForm.languages,
        virtualCard: { ...(dbProfile?.virtualCard || {}), theme: virtualCardTheme, enabled: true },
        updatedAt: serverTimestamp()
      };

      let publicPhotoURL = user.photoURL || '';
      if (dbProfile?.photoStoragePath && storage) {
        try { publicPhotoURL = await getDownloadURL(storageRef(storage, dbProfile.photoStoragePath)); }
        catch { /* Keep the card usable with initials when the photo is private or unavailable. */ }
      }
      await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
      try {
        await setDoc(doc(db, 'public_agent_cards', user.uid), {
        displayName: payload.displayName || 'AgentReferrals professional',
        title: payload.title,
        brokerageName: payload.brokerageName,
        yearsExperience: payload.yearsExperience,
        website: payload.website,
        bio: payload.bio,
        specialties: payload.specialties,
        serviceAreas: payload.serviceAreas,
        languages: payload.languages,
        photoURL: publicPhotoURL,
        virtualCardTheme,
        updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (cardError) {
        console.error('Profile saved, but the public card could not be published:', cardError);
        setNotice('Profile saved. The shareable card could not be published; check your connection or Firestore rules and try again.');
        return false;
      }
      try { await updateDoc(doc(db, 'users', user.uid), { publicCardPublishedAt: serverTimestamp() }); }
      catch (markerError) { console.warn('Card is published, but its profile marker could not be updated:', markerError); }
      if (editProfileForm.displayName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: editProfileForm.displayName.trim() });
      }

      setNotice('✓ Profile successfully saved to database!');
      return true;
    } catch (err) {
      console.error('Error saving profile:', err);
      setNotice(`Failed to save profile: ${err.message}`);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAllNotifsRead = async () => {
    if (!db || !user) return;
    const unreadList = rawNotifications.filter(n => n.unread !== false);
    if (!unreadList.length) return;
    setMarkingNotificationsRead(true);
    setNotificationActionError('');
    try {
      for (let start = 0; start < unreadList.length; start += 450) {
        const batch = writeBatch(db);
        unreadList.slice(start, start + 450).forEach(n => batch.update(doc(db, 'notifications', n.id), { unread: false }));
        await batch.commit();
      }
      setNotice('All notifications marked as read.');
    } catch (err) {
      console.error('Error marking notifications:', err);
      setNotificationActionError('Some notifications could not be updated. Please try again.');
    } finally {
      setMarkingNotificationsRead(false);
    }
  };

  const handleOpenNotification = async n => {
    setNotificationActionError('');
    try {
      if (n.unread !== false) await updateDoc(doc(db, 'notifications', n.id), { unread: false });
      const category = String(n.category || n.type || '').toLowerCase();
      if (category.includes('application')) navigateTo('my-referrals');
      else if (category.includes('agreement')) navigateTo('agreements');
      else if (category.includes('verification') || category.includes('license')) navigateTo('verification');
      else if (n.referralId) navigateTo(category.includes('application') ? 'my-referrals' : 'marketplace');
    } catch (err) {
      console.error('Unable to open notification:', err);
      setNotificationActionError('This notification could not be opened. Please try again.');
    }
  };

  // -------------------------------------------------------------
  // VIEW: 1. DASHBOARD (Calculated 100% from database)
  // -------------------------------------------------------------
  const renderDashboard = () => {
    const metrics = [
      { label: 'Available referrals', value: referralsLoading ? '—' : marketplaceReferrals.length, hint: 'Live marketplace', icon: Compass, tone: 'blue', action: () => navigateTo('marketplace') },
      { label: 'My referrals', value: referralsLoading ? '—' : myReferrals.length, hint: 'Opportunities you posted', icon: BriefcaseBusiness, tone: 'violet', action: () => navigateTo('my-referrals') },
      { label: 'My applications', value: myApplications.length, hint: 'Applications you submitted', icon: ClipboardList, tone: 'amber', action: () => navigateTo('applications') },
      { label: 'Active agreements', value: activePipelineDeals.length, hint: 'Your referral agreements', icon: Handshake, tone: 'green', action: () => navigateTo('agreements') }
    ];
    const recentActivity = [...rawActivity]
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 4);
    return (
      <div className="pp-dashboard-view">
        <section className="pp-dashboard-welcome">
          <div>
            <span className="pp-eyebrow-chip"><Sparkles size={13} /> PROFESSIONAL WORKSPACE</span>
            <h1>Welcome back, {name}</h1>
            <p>Find opportunities, manage referrals, and keep your deals moving.</p>
          </div>
          <div className="pp-dashboard-building-art" aria-hidden="true">
            <svg viewBox="0 0 720 240" fill="none" role="presentation">
              <defs>
                <linearGradient id="welcomeBuildingWash" x1="360" y1="0" x2="360" y2="240" gradientUnits="userSpaceOnUse"><stop stopColor="#8fbddd" stopOpacity=".36" /><stop offset="1" stopColor="#c6e2f5" stopOpacity=".08" /></linearGradient>
                <pattern id="welcomeBuildingWindows" width="22" height="25" patternUnits="userSpaceOnUse"><path d="M7 5h8v13H7z" fill="#86b5d7" fillOpacity=".2" /></pattern>
              </defs>
              <g stroke="#8bb7d7" strokeOpacity=".5" strokeWidth="1.2">
                <path d="M50 240V135h84v105M142 240V87h106v153M255 240V46h118v194M388 240V104h86v136M486 240V21h119v219M619 240V119h75v121" fill="url(#welcomeBuildingWash)" />
                <path d="M50 240V135h84v105M142 240V87h106v153M255 240V46h118v194M388 240V104h86v136M486 240V21h119v219M619 240V119h75v121" fill="url(#welcomeBuildingWindows)" stroke="none" />
                <path d="M255 46l26-18h92v18M486 21l24-15h95v15M142 87l19-14h87v14M314 46v194M545 21v219M50 135l17-12h67v12M388 104l18-12h68v12M619 119l17-12h58v12M30 239h680" />
              </g>
            </svg>
          </div>
          <div className="pp-dashboard-quick-actions">
            <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('post-referral')}><Plus size={16} /> Post a Referral</button>
            <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('marketplace')}><Compass size={16} /> Explore Marketplace</button>
          </div>
        </section>

        <section className="pp-dashboard-metrics" aria-label="Workspace summary">
          {metrics.map(({ label, value, hint, icon: Icon, tone, action }) => (
            <button type="button" className="pp-dashboard-metric" key={label} onClick={action}>
              <span className={`pp-dashboard-metric-icon ${tone}`}><Icon size={19} /></span>
              <span className="pp-dashboard-metric-copy"><span>{label}</span><strong>{value}</strong><small>{hint}</small></span>
              <ArrowRight size={16} className="pp-dashboard-metric-arrow" />
            </button>
          ))}
        </section>

        {dbProfile?.verificationStatus !== 'approved' && (
          <section className="pp-dashboard-verification">
            <span className="pp-dashboard-verification-icon"><ShieldCheck size={19} /></span>
            <div><b>Complete your professional verification</b><p>Your current status is {displayStatus(dbProfile?.verificationStatus || 'pending')}. Review your license and account details.</p></div>
            <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('verification')}>View status <ArrowRight size={15} /></button>
          </section>
        )}

        <section className="pp-dashboard-content-grid">
          <div className="pp-card pp-dashboard-panel">
            <div className="pp-dashboard-panel-heading"><div><h2>Marketplace opportunities</h2><p>Current referrals available to apply for.</p></div><button className="pp-dashboard-text-link" onClick={() => navigateTo('marketplace')}>View marketplace <ArrowRight size={15} /></button></div>
            {referralsLoading ? <div className="pp-dashboard-opportunity-loading"><i /><i /></div> : referralsError ? <div className="pp-dashboard-empty"><CircleAlert size={20} /><b>Referral data is unavailable</b><button className="pp-dashboard-text-link" onClick={() => { setReferralsLoading(true); setReferralsRetry(value => value + 1); }}>Retry <RefreshCw size={13} /></button></div> : marketplaceReferrals.length ? (
              <div className="pp-dashboard-opportunity-list">
                {marketplaceReferrals.slice(0, 3).map(ref => (
                  <article className="pp-dashboard-opportunity" key={ref.id}>
                    <div className="pp-dashboard-opportunity-copy"><span className="pp-dashboard-tag">{ref.clientType || 'Referral'}{ref.feePercent != null ? ` · ${ref.feePercent}% fee` : ''}</span><h3>{ref.title || 'Referral opportunity'}</h3><p><MapPin size={14} /> {[ref.city, ref.state, ref.zip].filter(Boolean).join(', ') || 'Location not provided'}{ref.propertyType ? ` · ${ref.propertyType}` : ''}</p>{(ref.minValue || ref.maxValue) && <small>Budget: {ref.minValue ? formatMoney(ref.minValue) : '—'} – {ref.maxValue ? formatMoney(ref.maxValue) : '—'}</small>}<small className="pp-dashboard-posted-by">{ref.creatorName ? `Posted by ${ref.creatorName}` : 'Posted by professional'}{formatPostedTime(ref.createdAt) ? ` · ${formatPostedTime(ref.createdAt).replace('Posted ', '')}` : ''}</small></div>
                    <div className="pp-dashboard-opportunity-actions"><button className="pp-btn pp-btn-outline" onClick={() => setSelectedReferral(ref)}>Details</button><button className="pp-btn pp-btn-primary" onClick={() => startApplyProcess(ref)}>Apply <ArrowRight size={14} /></button></div>
                  </article>
                ))}
              </div>
            ) : <div className="pp-dashboard-empty"><Compass size={21} /><b>No available referrals right now</b><span>New published opportunities will appear here.</span></div>}
          </div>

          <div className="pp-dashboard-side-stack">
          <div className="pp-card pp-dashboard-panel">
            <div className="pp-dashboard-panel-heading"><div><h2>My recent applications</h2><p>Track the referrals you have applied to.</p></div><button className="pp-dashboard-text-link" onClick={() => navigateTo('applications')}>View all <ArrowRight size={15} /></button></div>
            {myApplications.length ? (
              <div className="pp-dashboard-application-list">
                {myApplications.slice(0, 4).map(app => <button type="button" className="pp-dashboard-application" key={app.id} onClick={() => navigateTo('applications')}><span className="pp-dashboard-application-icon"><ClipboardCheck size={17} /></span><span><b>{app.referralTitle || 'Referral application'}</b><small>{displayStatus(app.status || 'pending')}</small></span><ArrowRight size={15} /></button>)}
              </div>
            ) : <div className="pp-dashboard-empty"><ClipboardList size={21} /><b>No applications yet</b><span>When you apply to an opportunity, its status appears here.</span><button className="pp-dashboard-text-link" onClick={() => navigateTo('marketplace')}>Browse marketplace <ArrowRight size={14} /></button></div>}
          </div>
          <section className="pp-card pp-dashboard-profile-card">
            <div className="pp-dashboard-profile-ring" style={{ '--profile-progress': `${profilePercent}%` }} role="img" aria-label={`Profile completion ${profilePercent}%`}><span>{profilePercent}%</span></div>
            <div className="pp-dashboard-profile-copy"><span className="pp-eyebrow-chip"><UserRound size={12} /> PROFILE READINESS</span><h2>Complete your professional profile</h2><p>{missingFields.length ? `${missingFields.length} details left before your profile is fully ready.` : 'Your profile is ready to represent your business.'}</p></div>
            <div className="pp-dashboard-profile-checks" aria-label="Profile checklist">
              {[...completedFields.slice(0, 2), ...missingFields.slice(0, 2)].map(field => <span key={field.key} className={field.done ? 'done' : 'todo'}>{field.done ? <CheckCircle2 size={14} /> : <CircleAlert size={14} />}{field.label}</span>)}
            </div>
            <button className="pp-dashboard-text-link" onClick={() => navigateTo('profile')}>{missingFields.length ? 'Finish profile' : 'Review profile'} <ArrowRight size={14} /></button>
          </section>
          </div>
        </section>

        {recentActivity.length > 0 && <section className="pp-card pp-dashboard-activity"><div className="pp-dashboard-panel-heading"><div><h2>Recent activity</h2><p>Updates recorded for your account.</p></div></div><div className="pp-dashboard-activity-list">{recentActivity.map(item => <div className="pp-dashboard-activity-item" key={item.id}><span className="pp-dashboard-activity-dot" /><div><b>{item.title || item.action || item.type || 'Account activity'}</b>{item.description && <p>{item.description}</p>}</div>{item.createdAt?.toDate && <time>{item.createdAt.toDate().toLocaleDateString()}</time>}</div>)}</div></section>}
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 2. MARKETPLACE
  // -------------------------------------------------------------
  const renderMarketplace = () => {
    const activeFilterCount = [typeFilter !== 'All', propTypeFilter !== 'All', feeFilter !== 'All fees', locationFilter !== 'All locations', budgetFilter !== 'All budgets'].filter(Boolean).length;
    const locations = [...new Set(rawReferrals
      .filter(r => ['open', 'published', 'active', 'Published', 'Active'].includes(r.status))
      .map(r => [r.city, r.state].filter(Boolean).join(', '))
      .filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return (
    <div className="pp-marketplace-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><Search size={12} /> DISCOVERY MARKETPLACE</span>
          <h1>Marketplace</h1>
          <p>Your next connection starts here. Find the right opportunity for your expertise.</p>
        </div>
        <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('post-referral')}>
          <Plus size={16} /> Post Referral
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="pp-marketplace-filterbar">
        <div className="pp-search-input-wrap">
          <Search size={18} />
          <input
            type="text"
            aria-label="Search referral opportunities"
            placeholder="Search by city, state, ZIP, property type, or keyword..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="pp-clear-btn" aria-label="Clear search" onClick={() => setSearch('')}><X size={14} /></button>}
        </div>

        <div className="pp-market-toolbar">
          <div className="pp-market-type-tabs" aria-label="Referral type">
            {['All', 'Buyer', 'Seller'].map(type => <button key={type} aria-pressed={typeFilter === type} className={typeFilter === type ? 'active' : ''} onClick={() => setTypeFilter(type)}>{type === 'All' ? 'All opportunities' : `${type} referrals`}</button>)}
          </div>
          <button className={`pp-btn-sm pp-btn-outline ${marketFiltersExpanded ? 'active' : ''}`} aria-expanded={marketFiltersExpanded} aria-controls="market-advanced-filters" onClick={() => setMarketFiltersExpanded(value => !value)}><SlidersHorizontal size={15} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</button>
          <label className="pp-market-sort">Sort by <select aria-label="Sort opportunities" value={sortBy} onChange={e => setSortBy(e.target.value)}>{['Newest', 'Oldest', 'Highest Fee', 'Lowest Fee'].map(sort => <option key={sort}>{sort}</option>)}</select></label>
        </div>

        <div id="market-advanced-filters" className="pp-filter-row pp-market-advanced" hidden={!marketFiltersExpanded}>
          <div className="pp-filter-group">
            <span className="pp-filter-label">Type:</span>
            {['All', 'Buyer', 'Seller'].map(t => (
              <button
                key={t}
                className={`pp-pill-filter ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="pp-filter-group">
            <span className="pp-filter-label">Property:</span>
            {['All', 'Residential', 'Condominium', 'Commercial', 'Land'].map(p => (
              <button
                key={p}
                className={`pp-pill-filter ${propTypeFilter === p ? 'active' : ''}`}
                onClick={() => setPropTypeFilter(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="pp-filter-sort-wrap">
            <span className="pp-filter-label"><SlidersHorizontal size={14} /> Sort:</span>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option>Newest</option>
              <option>Oldest</option>
              <option>Highest Fee</option>
              <option>Lowest Fee</option>
            </select>
          </div>
          <label className="pp-filter-sort-wrap pp-fee-filter"><span className="pp-filter-label">Referral fee:</span>
            <select value={feeFilter} onChange={e => setFeeFilter(e.target.value)}>
              <option>All fees</option><option>Under 15%</option><option>15–25%</option><option>Over 25%</option>
            </select>
          </label>
          <label className="pp-filter-sort-wrap"><span className="pp-filter-label">Location:</span>
            <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}><option>All locations</option>{locations.map(location => <option key={location}>{location}</option>)}</select>
          </label>
          <label className="pp-filter-sort-wrap"><span className="pp-filter-label">Budget:</span>
            <select value={budgetFilter} onChange={e => setBudgetFilter(e.target.value)}><option>All budgets</option><option>Under $250k</option><option>$250k–$500k</option><option>Over $500k</option></select>
          </label>
        </div>
      </div>

      {/* Real Marketplace Grid */}
      {referralsLoading ? <div className="pp-marketplace-grid" aria-label="Loading referral opportunities">{[0, 1, 2, 3].map(i => <div className="pp-market-skeleton" key={i}><i /><i /><i /></div>)}</div> : referralsError ? <div className="pp-empty-state pp-referral-error"><CircleAlert size={30} /><h3>Unable to load opportunities</h3><p>{referralsError}</p><button className="pp-btn pp-btn-outline" onClick={() => { setReferralsLoading(true); setReferralsRetry(value => value + 1); }}>Retry</button></div> : <>
      <div className="pp-marketplace-results-line" aria-live="polite"><span>{marketplaceReferrals.length} {marketplaceReferrals.length === 1 ? 'opportunity' : 'opportunities'}{activeFilterCount > 0 || search ? ' matching your search' : ' to explore'}</span>{(activeFilterCount > 0 || search) ? <button className="pp-dashboard-text-link" onClick={() => { setSearch(''); setTypeFilter('All'); setPropTypeFilter('All'); setFeeFilter('All fees'); setLocationFilter('All locations'); setBudgetFilter('All budgets'); }}>Clear filters <X size={12} /></button> : <span>Updated from your referral network</span>}</div>
      <div className="pp-marketplace-grid">
        {marketplaceReferrals.length > 0 ? (
          marketplaceReferrals.map(r => (
            <article className="pp-market-card" key={r.id}>
              <div className="pp-market-card-top">
                <span className={`pp-type-badge ${r.clientType?.toLowerCase() || 'buyer'}`}>
                  {(r.category || `${r.clientType || 'Buyer'} Referral`).toUpperCase()}
                </span>
                <div className="pp-market-fee-badge">
                  <span>{r.feePercent != null ? `${r.feePercent}% FEE` : 'FEE NOT PROVIDED'}</span>
                  <button
                    className={`pp-save-btn ${savedReferralIds.has(r.id) ? 'saved' : ''}`}
                    onClick={() => handleToggleSave(r.id)}
                    title={savedReferralIds.has(r.id) ? 'Remove bookmark' : 'Save referral'}
                    aria-label={savedReferralIds.has(r.id) ? 'Remove bookmark' : 'Save referral'}
                    aria-pressed={savedReferralIds.has(r.id)}
                  >
                    <Star size={16} fill={savedReferralIds.has(r.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              <h3>{r.title}</h3>
              <p className="pp-market-loc"><MapPin size={14} /> {r.city || 'Location'}{r.state ? `, ${r.state}` : ''} {r.zip && `(${r.zip})`}</p>
              {formatPostedTime(r.createdAt) && <span className="pp-market-posted-time"><Clock size={12} /> {formatPostedTime(r.createdAt)}</span>}

              <div className="pp-market-specs">
                <div><small>Property Type</small><b>{r.propertyType || 'Not provided'}</b></div>
                <div><small>Price Range</small><b>{r.minValue || r.maxValue ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}` : 'Unspecified'}</b></div>
              </div>

              {r.description && <p className="pp-market-desc">{r.description}</p>}

              <div className="pp-market-card-foot">
                <div className="pp-creator-tag">
                  <span className="pp-market-creator-avatar" aria-hidden="true"><UserRound size={18} /></span>
                  <span><b>{r.creatorName || 'Name not provided'}</b><small>{r.creatorBrokerage || 'Referring professional'}</small></span>
                </div>
                <div className="pp-market-actions">
                  <button className="pp-btn-sm pp-btn-outline" onClick={() => setSelectedReferral(r)}>
                    View Details
                  </button>
                  <button className="pp-btn-sm pp-btn-primary" onClick={() => startApplyProcess(r)}>
                    Apply <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="pp-empty-state">
            <Search size={36} />
            <h3>No referral opportunities match your search</h3>
            <p>There are no active postings in the database matching these criteria.</p>
            <button className="pp-btn pp-btn-outline" onClick={() => { setSearch(''); setTypeFilter('All'); setPropTypeFilter('All'); setFeeFilter('All fees'); setLocationFilter('All locations'); setBudgetFilter('All budgets'); setSortBy('Newest'); }}>
              Reset Filters
            </button>
          </div>
        )}
      </div>
      </>}
    </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 3. MY REFERRALS
  // -------------------------------------------------------------
  const renderMyReferrals = () => {
    const tabs = ['All', 'Drafts', 'Published', 'Active', 'Paused', 'Completed', 'Archived'];
    const statusMatchesTab = (referral, tab) => {
      const status = String(referral.status || '').trim().toLowerCase();
      if (tab === 'All') return true;
      if (tab === 'Drafts') return status === 'draft';
      if (tab === 'Published') return ['published', 'open'].includes(status);
      return status === tab.trim().toLowerCase();
    };
    const countForTab = tab => myReferrals.filter(r => statusMatchesTab(r, tab)).length;
    const displayed = myReferrals.filter(r => statusMatchesTab(r, subTab))
      .sort((a, b) => (b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0) - (a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0));
    const pageSize = 10;
    const pageCount = Math.max(1, Math.ceil(displayed.length / pageSize));
    const safePage = Math.min(referralPage, pageCount);
    const pageItems = displayed.slice((safePage - 1) * pageSize, safePage * pageSize);
    const pageStart = displayed.length ? (safePage - 1) * pageSize + 1 : 0;
    const pageEnd = Math.min(safePage * pageSize, displayed.length);

    return (
      <div className="pp-my-referrals-view">
        <div className="pp-page-header">
          <div>
            <span className="pp-eyebrow-chip"><BriefcaseBusiness size={12} /> REFERRAL OWNER WORKSPACE</span>
            <h1>My Referrals</h1>
            <p>Manage opportunities you have created and review incoming candidate applications.</p>
            <span className="pp-referrals-total">{referralsLoading ? 'Loading your referrals…' : `${myReferrals.length} ${myReferrals.length === 1 ? 'referral' : 'referrals'} in your workspace`}</span>
          </div>
          <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('post-referral')}>
            <Plus size={16} /> Post a Referral
          </button>
        </div>

        <div className="pp-tab-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`pp-tab-item ${subTab === t ? 'active' : ''}`}
              onClick={() => { setSubTab(t); setReferralPage(1); }}
            >
              {t}<span className="pp-tab-count">{countForTab(t)}</span>
            </button>
          ))}
        </div>

        {referralsLoading ? <div className="pp-owned-referrals-grid">{[0, 1, 2, 3].map(i => <div className="pp-market-skeleton" key={i}><i /><i /><i /></div>)}</div> : referralsError ? <div className="pp-empty-state pp-referral-error"><CircleAlert size={30} /><h3>Unable to load your referrals</h3><p>{referralsError}</p><button className="pp-btn pp-btn-outline" onClick={() => { setReferralsLoading(true); setReferralsRetry(value => value + 1); }}>Retry</button></div> : displayed.length > 0 ? <>
          <div className="pp-owned-referrals-grid">
            {pageItems.map(r => {
              const applicantsForThis = rawApplications.filter(a => a.referralId === r.id);
              const createdAt = r.createdAt?.toDate?.();
              const dateLabel = createdAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(createdAt) : null;
              const rawStatus = String(r.status || 'unknown').toLowerCase();
              const statusLabel = ['open', 'published'].includes(rawStatus) ? 'Published' : displayStatus(rawStatus);
              const statusClass = ['open', 'published'].includes(rawStatus) ? 'published' : rawStatus;
              return <article className="pp-owned-referral-card" key={r.id}>
                <div className="pp-owned-referral-head"><span className={`pp-status-pill status-${statusClass}`}>{statusLabel}</span>{dateLabel && <span className="pp-owned-referral-date"><Clock size={13} /> {dateLabel}</span>}</div>
                <h2>{r.title || `${r.clientType || 'Referral'} opportunity`}</h2>
                <p className="pp-owned-referral-location"><MapPin size={15} /> {[r.city, r.state, r.zip].filter(Boolean).join(', ') || 'Location not provided'}<span>·</span>{r.clientType || 'Client type not provided'}</p>
                <div className="pp-owned-referral-meta">
                  <div><small>Property type</small><b>{r.propertyType || 'Not provided'}</b></div>
                  <div><small>Budget</small><b>{r.minValue || r.maxValue ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}` : 'Not provided'}</b></div>
                  <div><small>Referral fee</small><b>{r.feePercent != null ? `${r.feePercent}%` : 'Not provided'}</b></div>
                  <button type="button" onClick={() => setShowManageReferralModal(r)}><small>Applications</small><b><Users size={14} /> {applicantsForThis.length} {applicantsForThis.length === 1 ? 'applicant' : 'applicants'}</b></button>
                </div>
                {r.description && <p className="pp-owned-referral-description">{r.description}</p>}
                <div className="pp-owned-referral-actions">
                  {String(r.status || '').toLowerCase() === 'draft' && <button className="pp-btn-sm pp-btn-outline" onClick={() => startEditDraft(r)}>Edit draft</button>}
                  <button className="pp-btn-sm pp-btn-outline" onClick={() => setSelectedReferral(r)}>View details</button>
                  {String(r.status || '').toLowerCase() !== 'draft' && <button className="pp-btn-sm pp-btn-primary" onClick={() => setShowManageReferralModal(r)}>View applications <ArrowRight size={13} /></button>}
                </div>
              </article>;
            })}
          </div>
          {displayed.length > pageSize && <nav className="pp-referrals-pagination" aria-label="My referrals pages"><span>Showing {pageStart}–{pageEnd} of {displayed.length} referrals</span><div><button className="pp-btn-sm pp-btn-outline" disabled={safePage === 1} onClick={() => setReferralPage(safePage - 1)}><ChevronLeft size={14} /> Previous</button><span>Page {safePage} of {pageCount}</span><button className="pp-btn-sm pp-btn-outline" disabled={safePage === pageCount} onClick={() => setReferralPage(safePage + 1)}>Next <ChevronRight size={14} /></button></div></nav>}
        </> : <section className="pp-referrals-empty">
          <div className="pp-referrals-empty-main">
            <span className="pp-referrals-empty-icon"><BriefcaseBusiness size={24} /></span>
            <span className="pp-eyebrow-chip">YOUR REFERRAL WORKSPACE</span>
            <h2>{subTab === 'All' ? 'Your next opportunity starts here' : `No ${subTab.toLowerCase()} referrals`}</h2>
            <p>{subTab === 'All' ? 'Create a referral to share an opportunity with trusted professionals across the network.' : `There are no referrals in the ${subTab.toLowerCase()} stage right now.`}</p>
            <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('post-referral')}><Plus size={16} /> Post a Referral</button>
          </div>
          <div className="pp-referrals-empty-steps">
            <span className="pp-eyebrow-chip">HOW IT WORKS</span>
            <div><i>1</i><span><b>Share the opportunity</b><small>Add the location, client type and referral terms.</small></span></div>
            <div><i>2</i><span><b>Review applications</b><small>Compare interested professionals from your workspace.</small></span></div>
            <div><i>3</i><span><b>Move forward together</b><small>Manage the referral and agreement as it progresses.</small></span></div>
          </div>
        </section>}
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 4. MY APPLICATIONS
  // -------------------------------------------------------------
  const renderMyApplications = () => {
    const tabs = ['All', 'Pending', 'Shortlisted', 'Accepted', 'Rejected', 'Withdrawn'];
    const statusFor = application => String(application.status || '').trim().toLowerCase();
    const filtered = myApplications.filter(a => {
      if (subTab === 'All') return true;
      if (subTab === 'Ready for Signature') return ['ready for signature', 'pending_signatures'].includes(statusFor(a));
      return statusFor(a) === subTab.toLowerCase();
    });

    return (
      <div className="pp-applications-view">
        <div className="pp-page-header">
          <div>
            <span className="pp-eyebrow-chip"><ClipboardList size={12} /> APPLICANT WORKSPACE</span>
            <h1>My Applications</h1>
            <p>Track every opportunity you’ve applied to and see what needs your attention.</p>
          </div>
          <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('marketplace')}>
            <Search size={15} /> Find More Referrals
          </button>
        </div>

        <div className="pp-tab-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`pp-tab-item ${subTab === t ? 'active' : ''}`}
              onClick={() => setSubTab(t)}
            >
              {t}<span className="pp-tab-count">{t === 'All' ? myApplications.length : myApplications.filter(a => statusFor(a) === t.toLowerCase()).length}</span>
            </button>
          ))}
        </div>

        <div className="pp-apps-grid">
          {filtered.length > 0 ? (
            filtered.map(app => (
              <article className="pp-app-card" key={app.id}>
                <div className="pp-app-card-head">
                  <div>
                    <span className="pp-app-ref-kicker">REFERRAL APPLICATION</span>
                    <h3>{app.referralTitle}</h3>
                    <small><MapPin size={13} /> {app.referralCity}, {app.referralState}</small>
                  </div>
                  <span className={`pp-status-pill status-${app.status?.toLowerCase()}`}>
                    {app.status}
                  </span>
                </div>

                <div className="pp-app-card-meta">
                  <div><small>Referral Fee</small><b>{app.referralFeePercent != null ? `${app.referralFeePercent}%` : 'Not provided'}</b></div>
                  <div><small>Status</small><b>{app.status}</b></div>
                </div>

                {app.pitchNote && (
                  <div className="pp-app-pitch-box">
                    <small>Your Submitted Note:</small>
                    <p>"{app.pitchNote}"</p>
                  </div>
                )}

                <div className="pp-app-card-actions">
                  {app.status === 'ACCEPTED' ? (
                    <button className="pp-btn-sm pp-btn-primary" onClick={() => navigateTo('agreements')}>
                      <FileSignature size={14} /> Review & Sign Agreement
                    </button>
                  ) : app.status === 'SHORTLISTED' ? (
                    <span className="pp-tag-alert">⭐ Shortlisted by referring agent</span>
                  ) : app.status !== 'WITHDRAWN' && (
                    <button
                      className="pp-btn-sm pp-btn-ghost text-danger"
                      onClick={async () => {
                        await updateDoc(doc(db, 'applications', app.id), { status: 'WITHDRAWN' });
                        setNotice('Application withdrawn.');
                      }}
                    >
                      Withdraw Application
                    </button>
                  )}
                </div>
              </article>
            ))
          ) : (
            <section className="pp-applications-empty">
              <div className="pp-applications-empty-main">
                <span className="pp-applications-empty-icon"><ClipboardList size={26} /></span>
                <span className="pp-eyebrow-chip">{subTab === 'All' ? 'A FRESH START' : `${subTab.toUpperCase()} APPLICATIONS`}</span>
                <h2>{subTab === 'All' ? 'Your next opportunity is out there' : `No ${subTab.toLowerCase()} applications yet`}</h2>
                <p>{subTab === 'All'
                  ? 'Explore referral opportunities, introduce yourself, and keep every application organized here.'
                  : `When an application moves to ${subTab.toLowerCase()}, it will show up here. You can keep exploring opportunities in the meantime.`}</p>
                <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('marketplace')}>
                  <Search size={15} /> Browse referral opportunities <ArrowRight size={14} />
                </button>
                <small className="pp-applications-empty-note">Your application status updates will appear here.</small>
              </div>
              <aside className="pp-applications-journey">
                <span className="pp-eyebrow-chip">HOW IT WORKS</span>
                <h3>From discovery to decision</h3>
                <div><i>01</i><span><b>Find the right fit</b><small>Browse live referrals by location and property type.</small></span></div>
                <div><i>02</i><span><b>Send your application</b><small>Share a short note with the referring professional.</small></span></div>
                <div><i>03</i><span><b>Follow your progress</b><small>Check back here for status changes and next steps.</small></span></div>
              </aside>
            </section>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 5. SAVED REFERRALS
  // -------------------------------------------------------------
  const renderSavedReferrals = () => (
    <div className="pp-saved-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><Bookmark size={12} /> BOOKMARKS</span>
          <h1>Saved Referrals</h1>
          <p>Referrals you bookmarked from the marketplace.</p>
        </div>
        <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('marketplace')}>
          Browse Marketplace
        </button>
      </div>

      {savedReferralsList.length > 0 ? (
        <div className="pp-marketplace-grid">
          {savedReferralsList.map(r => (
            <article className="pp-market-card" key={r.id}>
              <div className="pp-market-card-top">
                <span className={`pp-type-badge ${r.clientType?.toLowerCase() || 'buyer'}`}>{r.category}</span>
                <div className="pp-market-fee-badge">
                  <span>{r.feePercent != null ? `${r.feePercent}% FEE` : 'FEE NOT PROVIDED'}</span>
                  <button className="pp-save-btn saved" onClick={() => handleToggleSave(r.id)}>
                    <Star size={16} fill="currentColor" />
                  </button>
                </div>
              </div>
              <h3>{r.title}</h3>
              <p className="pp-market-loc"><MapPin size={14} /> {r.city}, {r.state}</p>
              <p className="pp-market-desc">{r.description}</p>
              <div className="pp-market-card-foot">
                <button className="pp-btn-sm pp-btn-ghost text-danger" onClick={() => handleToggleSave(r.id)}>
                  Remove Bookmark
                </button>
                <div className="pp-market-actions">
                  <button className="pp-btn-sm pp-btn-outline" onClick={() => setSelectedReferral(r)}>
                    Details
                  </button>
                  <button className="pp-btn-sm pp-btn-primary" onClick={() => startApplyProcess(r)}>
                    Apply <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pp-empty-state">
          <Bookmark size={34} />
          <h3>No saved referrals yet</h3>
          <p>Click the star (⭐) on any marketplace opportunity to save it here.</p>
          <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('marketplace')}>
            Explore Marketplace <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 6. ACTIVE REFERRALS & PIPELINE (From Real Database)
  // -------------------------------------------------------------
  const renderActiveReferrals = () => {
    const deals = rawAgreements.filter(ag => {
      if (subTab === 'All') return true;
      return (ag.stage || 'AGREEMENT') === subTab;
    });

    return (
      <div className="pp-pipeline-view">
        <div className="pp-page-header">
          <div>
            <span className="pp-eyebrow-chip"><Handshake size={12} /> ACTIVE TRANSACTIONS</span>
            <h1>Active Referrals & Pipeline</h1>
            <p>Live transaction tracking from agreement execution to closing and settlement.</p>
          </div>
          <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('post-referral')}>
            <Plus size={16} /> Post New Referral
          </button>
        </div>

        {/* Dynamic Stage Counter Board */}
        <div className="pp-pipeline-stage-board">
          {PIPELINE_STAGES.map((st, idx) => {
            const Icon = st.icon;
            const count = rawAgreements.filter(a => (a.stage || 'AGREEMENT') === st.key).length;
            const isSelected = subTab === st.key;
            return (
              <div
                key={st.key}
                className={`pp-pipeline-step-box ${isSelected ? 'selected' : ''}`}
                onClick={() => setSubTab(subTab === st.key ? 'All' : st.key)}
              >
                <div className="pp-stage-box-top">
                  <span className="pp-stage-step-num">0{idx + 1}</span>
                  <Icon size={16} />
                </div>
                <b>{st.label.toUpperCase()}</b>
                <strong className="pp-stage-counter">{count}</strong>
                <small>{st.desc}</small>
              </div>
            );
          })}
        </div>

        {/* Deals list */}
        <div className="pp-pipeline-deals-wrap">
          <div className="pp-pipeline-deals-head">
            <h3>{subTab === 'All' ? 'All Active Referral Deals' : `Deals in Stage: ${subTab}`}</h3>
            <span className="pp-badge-count">{deals.length} Deals</span>
          </div>

          <div className="pp-deals-list">
            {deals.length > 0 ? (
              deals.map(deal => (
                <article className="pp-deal-card" key={deal.id}>
                  <div className="pp-deal-top">
                    <div>
                      <span className={`pp-stage-tag stage-${(deal.stage || 'agreement').toLowerCase().replace('_', '-')}`}>
                        STAGE: {deal.stage || 'AGREEMENT'}
                      </span>
                      <h3>{deal.referralTitle}</h3>
                      <p><UserRound size={14} /> Partner: <b>{deal.receivingName || deal.referringName}</b> ({deal.receivingBrokerage || deal.referringBrokerage})</p>
                    </div>
                    <div className="pp-deal-fee-block">
                      <small>Referral Fee</small>
                      <strong>{deal.feePercent}%</strong>
                    </div>
                  </div>

                  <div className="pp-deal-bottom">
                    <div className="pp-deal-status-info">
                      <span>Status: <b>{deal.status}</b></span>
                    </div>
                    <div className="pp-deal-actions">
                      <button className="pp-btn-sm pp-btn-primary" onClick={() => setSelectedAgreement(deal)}>
                        <FileSignature size={14} /> View Agreement
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="pp-empty-state-sm">
                <p>No active referrals in this stage.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 7. AGREEMENTS
  // -------------------------------------------------------------
  const renderAgreements = () => {
    const tabs = ['All', 'Awaiting your signature', 'Awaiting other party', 'Active', 'Completed', 'Declined'];
    const statusFor = agreement => String(agreement.status || '').trim().toLowerCase();
    const matchesAgreementTab = (agreement, tab) => {
      if (tab === 'All') return true;
      const isReferring = agreement.referringProfessionalId === user?.uid;
      const mySignature = isReferring ? agreement.referrerSignature : agreement.receiverSignature;
      const awaitingMe = (isReferring ? ['draft', 'pending_referrer_signature'].includes(statusFor(agreement)) : statusFor(agreement) === 'pending_receiver_signature') && !mySignature?.signedAt && !(isReferring ? agreement.signedByReferring : agreement.signedByReceiving);
      const awaitingOther = (isReferring ? statusFor(agreement) === 'pending_receiver_signature' : statusFor(agreement) === 'pending_referrer_signature') && (isReferring ? agreement.referrerSignature?.signedAt || agreement.signedByReferring : agreement.receiverSignature?.signedAt || agreement.signedByReceiving);
      if (tab === 'Awaiting your signature') return awaitingMe || (['ready for signature', 'pending_signatures'].includes(statusFor(agreement)) && !(isReferring ? agreement.signedByReferring : agreement.signedByReceiving));
      if (tab === 'Awaiting other party') return awaitingOther || (['ready for signature', 'pending_signatures'].includes(statusFor(agreement)) && (isReferring ? agreement.signedByReferring : agreement.signedByReceiving));
      return statusFor(agreement) === tab.toLowerCase();
    };
    const filtered = rawAgreements.filter(a => {
      return matchesAgreementTab(a, subTab);
    });

    return (
      <div className="pp-agreements-view">
        <div className="pp-page-header">
          <div>
            <span className="pp-eyebrow-chip"><FileText size={12} /> LEGAL CONTRACTS</span>
            <h1>Referral Agreements</h1>
            <p>Review referral terms, record your signature, and follow each party’s progress.</p>
          </div>
        </div>

        <div className="pp-agreement-overview">
          <div className="pp-agreement-journey">
            {[['01', 'Review the terms', 'Confirm the referral, parties and fee.'], ['02', 'Sign your copy', 'Enter your legal name and consent.'], ['03', 'Finish together', 'Track signatures from both parties.']].map(([step, title, detail]) => <div key={step}><span>{step}</span><section><b>{title}</b><p>{detail}</p></section></div>)}
          </div>
          <div className="pp-agreement-counts">
            <div><b>{rawAgreements.length}</b><span>Total agreements</span></div>
            <div><b>{rawAgreements.filter(a => ['active', 'completed'].includes(statusFor(a))).length}</b><span>Active or complete</span></div>
            <div><b>{rawAgreements.filter(a => ['draft', 'pending_referrer_signature', 'pending_receiver_signature', 'ready for signature', 'pending_signatures'].includes(statusFor(a))).length}</b><span>In progress</span></div>
          </div>
        </div>
        <div className="pp-tab-bar">
          {tabs.map(t => (
            <button
              key={t}
              className={`pp-tab-item ${subTab === t ? 'active' : ''}`}
              onClick={() => setSubTab(t)}
            >
              {t}<span className="pp-tab-count">{rawAgreements.filter(a => matchesAgreementTab(a, t)).length}</span>
            </button>
          ))}
        </div>

        <div className="pp-agreements-grid">
          {filtered.length > 0 ? (
            filtered.map(ag => (
              <article className="pp-agreement-card" key={ag.id}>
                <div className="pp-agreement-top">
                  <span className="pp-agreement-num">AGREEMENT #{ag.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`pp-status-pill status-${ag.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                    {displayStatus(ag.status)}
                  </span>
                </div>
                <h3>{ag.referralSnapshot?.title || ag.referralTitle || 'Referral agreement'}</h3>
                <small>{ag.agreementNumber || `Agreement #${ag.id.slice(0, 8).toUpperCase()}`}{ag.agreementTemplateVersion ? ` · Version ${ag.agreementTemplateVersion}` : ''}</small>
                <p className="pp-agreement-party">
                  <Users size={14} /> Partner: <b>{ag.referringProfessionalId === user.uid ? ag.receivingName || 'Not provided' : ag.referringName || 'Not provided'}</b>
                </p>
                <div className="pp-agreement-meta-box">
                  <div><small>Referral Fee</small><strong>{ag.referralSnapshot?.referralFee?.percent ?? ag.feePercent ?? '—'}{ag.referralSnapshot?.referralFee?.percent ?? ag.feePercent ? '%' : ''}</strong></div>
                  <div><small>Effective status</small><b>{displayStatus(ag.status)}</b></div>
                </div>
                <div className="pp-agreement-signers"><span className={ag.referrerSignature?.signedAt || ag.signedByReferring ? 'done' : ''}><CheckCircle2 size={15} /> Referring party · {ag.referrerSignature?.signedAt || ag.signedByReferring ? 'Signed' : 'Pending'}</span><span className={ag.receiverSignature?.signedAt || ag.signedByReceiving ? 'done' : ''}><CheckCircle2 size={15} /> Receiving party · {ag.receiverSignature?.signedAt || ag.signedByReceiving ? 'Signed' : 'Pending'}</span></div><div className="pp-agreement-foot">
                  <div className="pp-sign-status-tag">
                    {(ag.referringProfessionalId === user.uid ? ag.referrerSignature?.signedAt || ag.signedByReferring : ag.receiverSignature?.signedAt || ag.signedByReceiving) ? (
                      <span className="text-success"><CheckCircle2 size={14} /> Signed by You</span>
                    ) : (
                      <span className="text-amber"><CircleAlert size={14} /> Awaiting Signature</span>
                    )}
                  </div>
                  {ag.status === 'ACTIVE' && ag.document?.storagePath && <button className="pp-btn-sm pp-btn-outline" onClick={() => handleDownloadAgreement(ag)}><FileText size={14} /> PDF</button>}
                  <button className="pp-btn-sm pp-btn-primary" onClick={() => openAgreement(ag)}>
                    <FileSignature size={14} /> Review agreement
                  </button>
                </div>
              </article>
            ))
          ) : (
            <section className="pp-agreement-empty">
              <div className="pp-agreement-empty-main">
                <span className="pp-agreement-empty-icon"><FileText size={27} /></span>
                <span className="pp-eyebrow-chip">{subTab === 'All' ? 'YOUR CONTRACT WORKSPACE' : `${subTab.toUpperCase()} AGREEMENTS`}</span>
                <h2>{subTab === 'All' ? 'Agreements keep every referral on the same page' : `No ${subTab.toLowerCase()} agreements yet`}</h2>
                <p>{subTab === 'All'
                  ? 'When a referral application is accepted, the agreement and its signing progress will appear here for both parties.'
                  : `Agreements matching ${subTab.toLowerCase()} will appear here. You can review applications and referrals while you wait.`}</p>
                <div className="pp-agreement-empty-actions">
                  <button className="pp-btn pp-btn-primary" onClick={() => navigateTo('applications')}>Review applications <ArrowRight size={15} /></button>
                  <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('my-referrals')}>Manage my referrals</button>
                </div>
              </div>
              <aside className="pp-agreement-empty-side">
                <span className="pp-eyebrow-chip">A CLEAR RECORD FOR EVERYONE</span>
                <h3>What you’ll find in an agreement</h3>
                <div><CheckCircle2 size={17} /><span><b>Referral terms</b><small>Opportunity details and agreed referral fee.</small></span></div>
                <div><CheckCircle2 size={17} /><span><b>Both signatures</b><small>Each party’s signing status and next step.</small></span></div>
                <div><CheckCircle2 size={17} /><span><b>Shared progress</b><small>A single place to review and complete the contract.</small></span></div>
              </aside>
            </section>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 8. NOTIFICATIONS
  // -------------------------------------------------------------
  const renderNotifications = () => {
    const notificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...dbProfile?.settings?.notificationCategories };
    const visibleNotifications = rawNotifications.filter(n => notificationPreferences[notificationPreferenceKey(n)] !== false);
    const unreadCount = visibleNotifications.filter(n => n.unread !== false).length;
    const readCount = visibleNotifications.length - unreadCount;
    const counts = { All: visibleNotifications.length, Unread: unreadCount, Read: readCount };
    const filtered = visibleNotifications.filter(n => {
      const matchesFilter = notificationFilter === 'All' || (notificationFilter === 'Unread' ? n.unread !== false : n.unread === false);
      const haystack = [n.title, n.message, n.body, n.category, n.type].filter(Boolean).join(' ').toLowerCase();
      return matchesFilter && haystack.includes(notificationSearch.trim().toLowerCase());
    });
    const getKind = n => {
      const category = String(n.category || n.type || '').toLowerCase();
      if (category.includes('application')) return { label: 'Application', className: 'applications', Icon: ClipboardCheck };
      if (category.includes('agreement')) return { label: 'Agreement', className: 'agreement', Icon: FileSignature };
      if (category.includes('referral')) return { label: 'Referral', className: 'referral', Icon: BriefcaseBusiness };
      if (category.includes('verification') || category.includes('license')) return { label: 'Verification', className: 'verification', Icon: ShieldCheck };
      return { label: n.category || n.type || 'Update', className: 'notice', Icon: Bell };
    };
    const formatCreatedAt = value => {
      const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
      return date && Number.isFinite(date.getTime())
        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
        : 'Time unavailable';
    };

    return (
      <div className="pp-notifications-view">
        <div className="pp-page-header pp-notifications-header">
          <div>
            <span className="pp-eyebrow-chip"><Bell size={12} /> INBOX & ALERTS</span>
            <h1>Notifications</h1>
            <p>Important updates about your referrals, applications, and agreements.</p>
          </div>
          <div className="pp-notifications-header-actions">
            <span className={`pp-live-indicator ${notificationsError || notificationFromCache ? 'offline' : ''}`} role="status"><i /> {notificationsError ? 'Connection issue' : notificationsLoading ? 'Connecting…' : notificationFromCache ? 'Offline · cached updates' : 'Live inbox'}</span>
            {unreadCount > 0 && (
              <button className="pp-btn pp-btn-outline" onClick={handleMarkAllNotifsRead} disabled={markingNotificationsRead}>
                {markingNotificationsRead ? <Loader2 size={14} className="pp-spin" /> : <CheckCircle2 size={14} />}
                {markingNotificationsRead ? 'Updating…' : 'Mark all as read'}
              </button>
            )}
          </div>
        </div>

        <section className="pp-notifications-panel" aria-label="Notification inbox">
          <div className="pp-notifications-panel-head">
            <div><h2>Your inbox</h2><p>{notificationsLoading ? 'Syncing your latest updates…' : `${rawNotifications.length} updates · ${unreadCount} unread`}</p></div>
            <label className="pp-notification-search"><Search size={16} /><input value={notificationSearch} onChange={event => setNotificationSearch(event.target.value)} aria-label="Search notifications" placeholder="Search notifications" /></label>
          </div>
          <div className="pp-notification-filters" role="tablist" aria-label="Filter notifications">
            {Object.entries(counts).map(([filter, count]) => (
              <button key={filter} role="tab" aria-selected={notificationFilter === filter} className={notificationFilter === filter ? 'active' : ''} onClick={() => setNotificationFilter(filter)}>
                {filter}<span>{count}</span>
              </button>
            ))}
          </div>
          {notificationActionError && <div className="pp-notification-error" role="alert"><CircleAlert size={15} />{notificationActionError}</div>}
          <div className="pp-notif-list">
            {notificationsLoading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="pp-notif-skeleton"><i /><span><b /><small /></span></div>) : notificationsError ? (
              <div className="pp-notifications-state pp-notifications-error-state"><CircleAlert size={25} /><h3>Notifications couldn’t load</h3><p>{notificationsError}</p><button className="pp-btn pp-btn-outline" onClick={() => setNotificationsRetry(value => value + 1)}><RefreshCw size={14} /> Retry</button></div>
            ) : filtered.length ? filtered.map(n => {
              const kind = getKind(n);
              const Icon = kind.Icon;
              return <button key={n.id} type="button" className={`pp-notif-card ${n.unread !== false ? 'unread' : ''}`} onClick={() => handleOpenNotification(n)}>
                <span className={`pp-notif-icon-circle ${kind.className}`}><Icon size={18} /></span>
                <span className="pp-notif-body">
                  <span className="pp-notif-top"><span className="pp-notif-cat">{kind.label}</span><time>{formatCreatedAt(n.createdAt)}</time></span>
                  <b>{n.title || kind.label}</b>
                  <span className="pp-notif-message">{n.message || n.body || 'No additional details were provided.'}</span>
                  <span className="pp-notif-meta">{n.unread !== false ? <span className="pp-notif-unread-tag"><i /> New</span> : <span className="pp-notif-read-tag">Read</span>}{n.referralTitle && <span>Referral · {n.referralTitle}</span>}</span>
                </span>
                <ChevronRight size={17} className="pp-notif-arrow" />
              </button>;
            }) : (
              <div className="pp-notifications-state">
                <span className="pp-notifications-empty-icon"><Bell size={22} /></span>
                <h3>{visibleNotifications.length ? 'No matching notifications' : rawNotifications.length ? 'Your inbox preferences hide these updates' : 'Your inbox is clear'}</h3>
                <p>{visibleNotifications.length ? 'Try another filter or search term.' : rawNotifications.length ? 'Adjust notification categories in Settings to show more updates here.' : 'New updates about your referrals and applications will appear here.'}</p>
                {visibleNotifications.length > 0 && (notificationFilter !== 'All' || notificationSearch) && <button className="pp-btn pp-btn-outline" onClick={() => { setNotificationFilter('All'); setNotificationSearch(''); }}>Clear filters</button>}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 9. MY PROFILE (Calculated Dynamically from Real Data)
  // -------------------------------------------------------------
  const renderProfile = () => (
    <div className="pp-profile-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><UserRound size={12} /> PROFESSIONAL IDENTITY</span>
          <h1>My Profile</h1>
          <p>Shape the professional profile and virtual card referral partners see across your network.</p>
        </div>
        <button className="pp-btn pp-btn-primary" onClick={handleSaveProfile} disabled={isSubmitting}>
          <Check size={15} /> {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <section className="pp-profile-hero">
        <div className="pp-profile-hero-identity">
          <span className="pp-profile-hero-avatar">{(profilePhotoUrl || user?.photoURL) ? <img src={profilePhotoUrl || user.photoURL} alt="" /> : (editProfileForm.displayName || name).slice(0, 1).toUpperCase()}</span>
          <div className="pp-profile-hero-copy">
            <div className="pp-profile-hero-badges"><span className="pp-profile-role-tag"><UserRound size={12} /> PROFESSIONAL PROFILE</span><span className={`pp-profile-verified-tag ${dbProfile?.verificationStatus === 'approved' ? 'verified' : ''}`}><ShieldCheck size={13} /> {dbProfile?.verificationStatus === 'approved' ? 'Verified professional' : `Verification ${displayStatus(dbProfile?.verificationStatus || 'pending').toLowerCase()}`}</span></div>
            <h2>{editProfileForm.displayName || name}</h2>
            <p>{editProfileForm.title || 'Add a professional title'}{editProfileForm.brokerageName ? ` · ${editProfileForm.brokerageName}` : ''}</p>
            <div className="pp-profile-hero-facts"><span><MapPin size={13} /> {editProfileForm.serviceAreas.slice(0, 2).join(' · ') || 'Add your service area'}</span><span><BriefcaseBusiness size={13} /> {editProfileForm.yearsExperience || 'Experience not added'}</span></div>
          </div>
        </div>
        <div className="pp-profile-strength">
          <div className="pp-profile-strength-ring" style={{ '--profile-strength': `${profilePercent}%` }}><span>{profilePercent}<small>%</small></span></div>
          <div className="pp-profile-strength-copy"><b>Profile strength</b><p>{missingFields.length ? `${missingFields.length} detail${missingFields.length === 1 ? '' : 's'} left to complete` : 'Your key details are complete'}</p><div className="pp-profile-strength-track"><i style={{ width: `${profilePercent}%` }} /></div><details className="pp-profile-checklist-details"><summary>View checklist <ChevronDown size={13} /></summary><div className="pp-completion-checklist">{completedFields.map(c => <span key={c.key} className="done"><Check size={12} /> {c.label}</span>)}{missingFields.map(m => <span key={m.key} className="missing"><Info size={12} /> {m.label}</span>)}</div></details></div>
        </div>
      </section>

      <form onSubmit={handleSaveProfile} className="pp-profile-grid">
        <div className="pp-card pp-profile-card">
          <h2>Personal & Contact Information</h2>
          <div className="pp-form-fields-2col">
            <label>Full Name
              <input
                value={editProfileForm.displayName}
                onChange={e => setEditProfileForm({ ...editProfileForm, displayName: e.target.value })}
                placeholder="e.g. Jordan Parker"
              />
            </label>
            <label>Professional Title
              <input
                value={editProfileForm.title}
                onChange={e => setEditProfileForm({ ...editProfileForm, title: e.target.value })}
                placeholder="e.g. Senior Real Estate Advisor"
              />
            </label>
            <label>Email Address
              <input type="email" value={user?.email || ''} disabled />
            </label>
            <label>Phone Number
              <input
                value={editProfileForm.phone}
                onChange={e => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                placeholder="+1 (512) 555-0100"
              />
            </label>
            <label className="span-2">Professional Website
              <input
                value={editProfileForm.website}
                onChange={e => setEditProfileForm({ ...editProfileForm, website: e.target.value })}
                placeholder="https://..."
              />
            </label>
          </div>

          <h2 style={{ marginTop: '20px' }}>Professional Biography</h2>
          <label className="pp-single-field">
            Bio
            <textarea
              rows="4"
              value={editProfileForm.bio}
              onChange={e => setEditProfileForm({ ...editProfileForm, bio: e.target.value })}
              placeholder="Tell other real estate professionals about your experience, client philosophy, and strengths..."
            />
          </label>
        </div>

        <div className="pp-card pp-profile-card">
          <h2>Experience & License Standing</h2>
          <div className="pp-form-fields-2col">
            <label>Years of Experience
              <input
                value={editProfileForm.yearsExperience}
                onChange={e => setEditProfileForm({ ...editProfileForm, yearsExperience: e.target.value })}
                placeholder="e.g. 8 years"
              />
            </label>
            <label>Brokerage Affiliation
              <input
                value={editProfileForm.brokerageName}
                onChange={e => setEditProfileForm({ ...editProfileForm, brokerageName: e.target.value })}
                placeholder="e.g. Apex Realty Group"
              />
            </label>
            <label className="span-2">Brokerage Address
              <input value={editProfileForm.brokerageAddress} onChange={e => setEditProfileForm({ ...editProfileForm, brokerageAddress: e.target.value })} placeholder="Street, city, state and ZIP" />
            </label>
            <label>State License Number
              <input
                value={editProfileForm.licenseNumber}
                onChange={e => setEditProfileForm({ ...editProfileForm, licenseNumber: e.target.value })}
                placeholder="e.g. TX-694821"
              />
            </label>
            <label>License State
              <input
                value={editProfileForm.licenseState}
                onChange={e => setEditProfileForm({ ...editProfileForm, licenseState: e.target.value })}
                placeholder="e.g. Texas"
              />
            </label>
            <label className="span-2">Specialties <small>Separate each specialty with a comma.</small>
              <input value={editProfileForm.specialties.join(', ')} onChange={e => setEditProfileForm({ ...editProfileForm, specialties: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="Luxury homes, first-time buyers, relocation" />
            </label>
            <label className="span-2">Service Areas <small>Separate cities or regions with a comma.</small>
              <input value={editProfileForm.serviceAreas.join(', ')} onChange={e => setEditProfileForm({ ...editProfileForm, serviceAreas: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="Austin, Round Rock, Central Texas" />
            </label>
            <label className="span-2">Languages <small>Languages you can work in, separated by commas.</small>
              <input value={editProfileForm.languages.join(', ')} onChange={e => setEditProfileForm({ ...editProfileForm, languages: e.target.value.split(',').map(value => value.trim()).filter(Boolean) })} placeholder="English, Spanish" />
            </label>
          </div>
        </div>

        <section className="pp-card pp-profile-card pp-virtual-card-builder">
          <div className="pp-virtual-card-heading"><div><span className="pp-eyebrow-chip"><BriefcaseBusiness size={12} /> DIGITAL BUSINESS CARD</span><h2>Make your virtual card</h2><p>Choose a look, preview your professional details, then save your profile to keep this design.</p></div><span className="pp-virtual-card-save-state"><CheckCircle2 size={14} /> Saves with profile</span></div>
          <div className="pp-virtual-card-layout">
            <div className="pp-virtual-card-editor">
              <h3>Choose a theme</h3>
              <div className="pp-virtual-theme-list" role="radiogroup" aria-label="Virtual card theme">
                {VIRTUAL_CARD_THEMES.map(theme => <button type="button" key={theme.id} role="radio" aria-checked={virtualCardTheme === theme.id} className={virtualCardTheme === theme.id ? 'selected' : ''} onClick={() => setVirtualCardTheme(theme.id)}><i style={{ background: theme.gradient }} /><span>{theme.label}</span>{virtualCardTheme === theme.id && <CheckCircle2 size={15} />}</button>)}
              </div>
              <div className="pp-virtual-card-tips"><Info size={15} /><span>Keep your profile details current so your card is ready to share with referral partners.</span></div>
            </div>
            {(() => {
              const theme = VIRTUAL_CARD_THEMES.find(item => item.id === virtualCardTheme) || VIRTUAL_CARD_THEMES[0];
              const displayName = editProfileForm.displayName.trim() || 'Your name';
              const specialtyList = editProfileForm.specialties.slice(0, 3);
              return <article className="pp-virtual-card-preview" style={{ '--virtual-card-gradient': theme.gradient, '--virtual-card-accent': theme.accent }} aria-label="Virtual business card preview">
                <div className="pp-virtual-card-preview-top"><span>AGENTREFERRALS</span><BriefcaseBusiness size={17} /></div>
                <div className="pp-virtual-card-person">
                  <span className="pp-virtual-card-avatar">{(profilePhotoUrl || user?.photoURL) ? <img src={profilePhotoUrl || user.photoURL} alt="" /> : displayName.slice(0, 1).toUpperCase()}</span>
                  <div><h3>{displayName}</h3><p>{editProfileForm.title.trim() || 'Real Estate Professional'}</p></div>
                </div>
                <div className="pp-virtual-card-rule" />
                <b className="pp-virtual-card-brokerage">{editProfileForm.brokerageName.trim() || 'Independent professional'}</b>
                <p className="pp-virtual-card-location">{editProfileForm.serviceAreas.slice(0, 2).join(' · ') || 'Add service areas to your profile'}</p>
                {specialtyList.length > 0 && <div className="pp-virtual-card-specialties">{specialtyList.map(specialty => <span key={specialty}>{specialty}</span>)}</div>}
                <div className="pp-virtual-card-contact"><span>{editProfileForm.phone.trim() || 'Add phone number'}</span><span>{user?.email || 'Add email address'}</span></div>
              </article>;
            })()}
          </div>
          <div className="pp-virtual-card-share"><div><span className="pp-eyebrow-chip"><Share2 size={12} /> YOUR SHAREABLE CARD</span><b>Invite a referral partner to your AgentReferrals card</b><small>Your public card shows the professional details above and links visitors to join using your invite.</small><label className="pp-card-link-field"><Link2 size={15}/><input readOnly value={virtualCardUrl} aria-label="Shareable virtual card link" onFocus={event => event.target.select()} /></label></div><button type="button" className="pp-btn pp-btn-primary" onClick={handleShareVirtualCard}>{cardLinkCopied ? <Check size={15}/> : navigator.share ? <Share2 size={15}/> : <Copy size={15}/>} {cardLinkCopied ? 'Link copied' : navigator.share ? 'Share card' : 'Copy card link'}</button></div>
        </section>
        <div className="pp-profile-save-footer"><div><b>Ready to update your professional profile?</b><small>Your profile details and virtual card theme are saved together.</small></div><button type="submit" className="pp-btn pp-btn-primary" disabled={isSubmitting}><Check size={15} /> {isSubmitting ? 'Saving profile…' : 'Save profile & card'}</button></div>
      </form>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 10. BROKERAGE
  // -------------------------------------------------------------
  const renderBrokerage = () => (
    <div className="pp-brokerage-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><Building2 size={12} /> BROKERAGE AFFILIATION</span>
          <h1>Brokerage Information</h1>
          <p>Your registered sponsoring brokerage.</p>
        </div>
      </div>

      <div className="pp-card pp-brokerage-card">
        <div className="pp-brokerage-header">
          <div className="pp-brokerage-logo-badge"><Building2 size={26} /></div>
          <div>
            <h2>{dbProfile?.brokerageName || 'Brokerage Not Added Yet'}</h2>
            <p>{dbProfile?.brokerageName ? 'Registered Real Estate Brokerage' : 'Add your brokerage in My Profile to display details.'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 11. LICENSE & VERIFICATION
  // -------------------------------------------------------------
  const renderVerification = () => (
    <div className="pp-verification-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><ShieldCheck size={12} /> COMPLIANCE</span>
          <h1>Verification Center</h1>
          <p>Real-time verification status from your account record.</p>
        </div>
      </div>

      <div className="pp-card pp-verification-center-card">
        <div className="pp-verification-status-banner">
          <div className="pp-verify-shield-icon"><ShieldCheck size={32} /></div>
          <div>
            <h2>Status: {displayStatus(dbProfile?.verificationStatus || 'pending')}</h2>
            <p>{dbProfile?.licenseNumber ? `License Number: ${dbProfile.licenseNumber} (${dbProfile.licenseState || 'State'})` : 'License number not added yet.'}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 12. DOCUMENTS
  // -------------------------------------------------------------
  const renderDocuments = () => (
    <div className="pp-documents-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><FolderOpen size={12} /> SECURE DOCUMENTS</span>
          <h1>My Documents</h1>
          <p>Private documents and contracts.</p>
        </div>
      </div>

      <div className="pp-docs-grid">
        {rawAgreements.length > 0 ? (
          rawAgreements.map(ag => (
            <div className="pp-doc-card" key={ag.id}>
              <div className="pp-doc-icon"><FileSignature size={22} /></div>
              <b>Agreement_{ag.id.slice(0, 8)}.pdf</b>
              <small>{ag.referralTitle} · Status: {ag.status}</small>
              <span className="pp-doc-secure"><LockKeyhole size={11} /> Database Record</span>
            </div>
          ))
        ) : (
          <div className="pp-empty-state">
            <FolderOpen size={34} />
            <h3>No documents yet</h3>
            <p>Executed referral agreements and uploaded compliance files will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 13. SETTINGS
  // -------------------------------------------------------------
  const saveUserSettings = async patch => {
    if (!db || !user) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { settings: patch }, { merge: true });
      setNotice('Settings saved.');
    } catch (err) {
      console.error('Unable to save settings:', err);
      setNotice('Settings could not be saved. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  };

  const renderSettings = () => {
    const notificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...dbProfile?.settings?.notificationCategories };
    const securityProvider = auth.currentUser?.providerData?.map(provider => provider.providerId).filter(Boolean) || [];
    const notificationOptions = [
      ['referrals', 'Referral updates', 'New opportunities, changes and referral activity.'],
      ['applications', 'Application updates', 'Shortlists, decisions and application progress.'],
      ['agreements', 'Agreement updates', 'Signature requests and contract progress.'],
      ['account', 'Account and verification', 'Security, profile and verification notices.']
    ];

    return (
      <div className="pp-settings-view">
        <div className="pp-page-header">
          <div><span className="pp-eyebrow-chip"><Settings size={12} /> ACCOUNT PREFERENCES</span><h1>Settings</h1><p>Manage your profile, security, inbox preferences, and workspace display.</p></div>
          <div className="pp-settings-account-chip"><span>{name.slice(0, 1).toUpperCase()}</span><div><b>{name}</b><small>{user?.email || 'Professional account'}</small></div></div>
        </div>

        <nav className="pp-settings-shortcuts" aria-label="Account settings sections">
          <button onClick={() => navigateTo('profile')}><span><UserRound size={17} /></span><div><b>Profile</b><small>Personal and professional details</small></div><ChevronRight size={16} /></button>
          <button onClick={() => navigateTo('verification')}><span><ShieldCheck size={17} /></span><div><b>Verification</b><small>{displayStatus(dbProfile?.verificationStatus || 'pending')} status</small></div><ChevronRight size={16} /></button>
          <button onClick={() => navigateTo('notifications')}><span><Bell size={17} /></span><div><b>Inbox</b><small>{unreadNotifCount} unread updates</small></div><ChevronRight size={16} /></button>
        </nav>

        <div className="pp-settings-grid">
          <section className="pp-card pp-settings-section pp-settings-security">
            <div className="pp-settings-section-heading"><span><KeyRound size={17} /></span><div><h2>Password &amp; security</h2><p>Choose a strong password to protect your account.</p></div></div>
            <div className="pp-settings-password-fields">
              <label className="pp-single-field">New password<input type="password" autoComplete="new-password" placeholder="At least 6 characters" value={newPasswordVal} onChange={e => setNewPasswordVal(e.target.value)} /></label>
              <label className="pp-single-field">Confirm new password<input type="password" autoComplete="new-password" placeholder="Enter the password again" value={confirmPasswordVal} onChange={e => setConfirmPasswordVal(e.target.value)} /></label>
            </div>
            <div className="pp-settings-section-foot"><small>Sign-in method: {securityProvider.length ? securityProvider.join(', ').replace('password', 'email and password') : 'connected account'}.</small><button className="pp-btn pp-btn-primary" disabled={savingSettings || !newPasswordVal || !confirmPasswordVal} onClick={async () => {
              if (newPasswordVal.length < 6) { setNotice('Password must be at least 6 characters.'); return; }
              if (newPasswordVal !== confirmPasswordVal) { setNotice('The passwords do not match.'); return; }
              try {
                if (auth.currentUser) {
                  await updatePassword(auth.currentUser, newPasswordVal);
                  setNewPasswordVal(''); setConfirmPasswordVal(''); setNotice('Password updated successfully.');
                }
              } catch (err) {
                setNotice(err.code === 'auth/requires-recent-login' ? 'For security, sign out and sign back in before changing your password.' : `Password update failed: ${err.message}`);
              }
            }}>Update password</button></div>
          </section>

          <section className="pp-card pp-settings-section pp-settings-notifications">
            <div className="pp-settings-section-heading"><span><Bell size={17} /></span><div><h2>Inbox preferences</h2><p>Choose which updates appear in your inbox and unread count.</p></div></div>
            <div className="pp-setting-toggle-list">
              {notificationOptions.map(([key, label, detail]) => <label className="pp-setting-toggle-row" key={key}><span><b>{label}</b><small>{detail}</small></span><input type="checkbox" checked={notificationPreferences[key] !== false} disabled={savingSettings} onChange={event => saveUserSettings({ notificationCategories: { ...notificationPreferences, [key]: event.target.checked } })} /></label>)}
            </div>
            <div className="pp-settings-note"><Info size={14} /><span>These preferences filter your in-app inbox. Security-critical account notices remain available in account activity.</span></div>
          </section>

          <section className="pp-card pp-settings-section pp-settings-display">
            <div className="pp-settings-section-heading"><span><SlidersHorizontal size={17} /></span><div><h2>Workspace display</h2><p>Adjust how much space content uses across your workspace.</p></div></div>
            <div className="pp-settings-density-options" role="group" aria-label="Workspace density">
              {[
                ['comfortable', 'Comfortable', 'Roomier cards and sections'],
                ['compact', 'Compact', 'More content on screen']
              ].map(([value, label, detail]) => <button type="button" key={value} className={(dbProfile?.settings?.density || 'comfortable') === value ? 'selected' : ''} disabled={savingSettings} onClick={() => saveUserSettings({ density: value })}><span className={`pp-density-preview ${value}`}><i /><i /><i /></span><span><b>{label}</b><small>{detail}</small></span>{(dbProfile?.settings?.density || 'comfortable') === value && <CheckCircle2 size={16} />}</button>)}
            </div>
          </section>

          <section className="pp-card pp-settings-section pp-settings-account-details">
            <div className="pp-settings-section-heading"><span><ShieldCheck size={17} /></span><div><h2>Account status</h2><p>Your verified identity and sign-in details.</p></div></div>
            <div className="pp-settings-detail-list"><div><small>Email address</small><b>{user?.email || 'Not provided'}</b></div><div><small>Verification</small><b>{displayStatus(dbProfile?.verificationStatus || 'pending')}</b></div><div><small>Sign-in method</small><b>{securityProvider.length ? securityProvider.join(', ').replace('password', 'Email and password') : 'Connected account'}</b></div></div>
            <button className="pp-btn pp-btn-outline" onClick={() => navigateTo('verification')}>View verification details <ArrowRight size={14} /></button>
          </section>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // VIEW: 14. HELP & SUPPORT
  // -------------------------------------------------------------
  const renderSupport = () => (
    <div className="pp-support-view">
      <div className="pp-page-header">
        <div>
          <span className="pp-eyebrow-chip"><LifeBuoy size={12} /> ASSISTANCE</span>
          <h1>Help & Support</h1>
          <p>Contact the AgentReferrals team.</p>
        </div>
      </div>
      <div className="pp-card pp-contact-card">
        <h2>Contact Support</h2>
        <p>Email: <a href="mailto:support@agentreferrals.org">support@agentreferrals.org</a></p>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // VIEW: 15. POST REFERRAL (7-STEP WIZARD)
  // -------------------------------------------------------------
  const renderPostReferral = () => {
    const steps = ['Type', 'Location', 'Property', 'Fee', 'Preferences', 'Details', 'Review'];

    return (
      <div className="pp-post-view">
        <div className="pp-page-header">
          <div>
            <span className="pp-eyebrow-chip">STEP {postStep + 1} OF 7 · CREATE REFERRAL</span>
            <h1>{editingReferralId ? 'Edit referral draft' : 'Post a Referral'}</h1>
            <p>{editingReferralId ? 'Continue where you left off, then publish when it is ready.' : 'Publish a client opportunity directly to the real database.'}</p>
          </div>
        </div>

        <div className="pp-form-panel">
          {/* Stepper Header */}
          <div className="pp-stepper-bar">
            {steps.map((st, i) => (
              <div key={st} className={`pp-step-pill ${i === postStep ? 'active' : i < postStep ? 'done' : ''}`}>
                <i>{i < postStep ? <Check size={12} /> : i + 1}</i>
                <span>{st}</span>
              </div>
            ))}
          </div>

          {/* Step 1: Type */}
          {postStep === 0 && (
            <div className="pp-wizard-step">
              <h2>1. What type of referral are you sharing?</h2>
              <div className="pp-type-choice-grid">
                <button
                  type="button"
                  className={`pp-type-card ${postForm.type === 'Buyer' ? 'selected' : ''}`}
                  onClick={() => setPostForm({ ...postForm, type: 'Buyer' })}
                >
                  <UserRound size={28} />
                  <b>Buyer Referral</b>
                  <small>Client looking to buy in destination market</small>
                </button>
                <button
                  type="button"
                  className={`pp-type-card ${postForm.type === 'Seller' ? 'selected' : ''}`}
                  onClick={() => setPostForm({ ...postForm, type: 'Seller' })}
                >
                  <Home size={28} />
                  <b>Seller Referral</b>
                  <small>Client looking to list and sell a property</small>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Location */}
          {postStep === 1 && (
            <div className="pp-wizard-step">
              <h2>2. Where is the opportunity located?</h2>
              <div className="pp-form-fields-2col">
                <label>City *
                  <input
                    required
                    placeholder="e.g. Austin"
                    value={postForm.city}
                    onChange={e => setPostForm({ ...postForm, city: e.target.value })}
                  />
                </label>
                <label>State *
                  <input
                    required
                    placeholder="e.g. Texas"
                    value={postForm.state}
                    onChange={e => setPostForm({ ...postForm, state: e.target.value })}
                  />
                </label>
                <label>ZIP Code
                  <input
                    placeholder="e.g. 78701"
                    value={postForm.zip}
                    onChange={e => setPostForm({ ...postForm, zip: e.target.value })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 3: Property Details */}
          {postStep === 2 && (
            <div className="pp-wizard-step">
              <h2>3. Property Details & Price Range</h2>
              <div className="pp-form-fields-2col">
                <label>Property Type
                  <select value={postForm.propertyType} onChange={e => setPostForm({ ...postForm, propertyType: e.target.value })}>
                    <option>Residential</option>
                    <option>Condominium</option>
                    <option>Townhouse</option>
                    <option>Commercial</option>
                    <option>Land</option>
                  </select>
                </label>
                <label>Minimum Price
                  <input placeholder="$400,000" value={postForm.minValue} onChange={e => setPostForm({ ...postForm, minValue: e.target.value })} />
                </label>
                <label>Maximum Price
                  <input placeholder="$600,000" value={postForm.maxValue} onChange={e => setPostForm({ ...postForm, maxValue: e.target.value })} />
                </label>
              </div>
            </div>
          )}

          {/* Step 4: Referral Fee */}
          {postStep === 3 && (
            <div className="pp-wizard-step">
              <h2>4. Referral Fee Percentage</h2>
              <div className="pp-fee-selector">
                <div className="pp-fee-buttons">
                  {['10', '15', '20', '25', '30', '35'].map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`pp-fee-btn ${postForm.fee === f ? 'selected' : ''}`}
                      onClick={() => setPostForm({ ...postForm, fee: f })}
                    >
                      {f}%
                    </button>
                  ))}
                </div>
                <p className="pp-fee-explainer">Referral fee is the agreed percentage of the receiving agent’s commission for this referral.</p>
                <label style={{ marginTop: '16px' }}>Custom Fee Percentage (%)
                  <input type="number" min="5" max="50" value={postForm.fee} onChange={e => setPostForm({ ...postForm, fee: e.target.value })} />
                </label>
              </div>
            </div>
          )}

          {/* Step 5: Professional Preferences */}
          {postStep === 4 && (
            <div className="pp-wizard-step">
              <h2>5. Preferences for Receiving Agent</h2>
              <label className="pp-single-field">
                Required Experience / Specialties
                <textarea
                  rows="4"
                  placeholder="e.g. 5+ years experience in this neighborhood..."
                  value={postForm.preference}
                  onChange={e => setPostForm({ ...postForm, preference: e.target.value })}
                />
              </label>
            </div>
          )}

          {/* Step 6: Description */}
          {postStep === 5 && (
            <div className="pp-wizard-step">
              <h2>6. Public Opportunity Description</h2>
              <label className="pp-single-field">
                Context (Keep client contact info private)
                <textarea
                  rows="5"
                  required
                  placeholder="Share relevant criteria without disclosing private client phone/email..."
                  value={postForm.description}
                  onChange={e => setPostForm({ ...postForm, description: e.target.value })}
                />
              </label>
            </div>
          )}

          {/* Step 7: Review & Publish */}
          {postStep === 6 && (
            <div className="pp-wizard-step">
              <h2>7. Review Your Referral</h2>
              <div className="pp-review-card">
                <div className="pp-review-row"><b>Type:</b> <span>{postForm.type} Referral</span></div>
                <div className="pp-review-row"><b>Location:</b> <span>{postForm.city}, {postForm.state} {postForm.zip}</span></div>
                <div className="pp-review-row"><b>Property:</b> <span>{postForm.propertyType}</span></div>
                <div className="pp-review-row"><b>Price:</b> <span>{postForm.minValue || postForm.maxValue ? `${postForm.minValue ? formatMoney(postForm.minValue) : 'No minimum'} – ${postForm.maxValue ? formatMoney(postForm.maxValue) : 'No maximum'}` : 'Not provided'}</span></div>
                <div className="pp-review-row"><b>Fee:</b> <span className="text-primary font-bold">{postForm.fee}%</span></div>
                {postForm.preference && <div className="pp-review-row"><b>Preferences:</b> <p>{postForm.preference}</p></div>}
                <div className="pp-review-row"><b>Description:</b> <p>{postForm.description}</p></div>
              </div>
            </div>
          )}

          <div className="pp-wizard-actions">
            <button
              type="button"
              className="pp-btn pp-btn-outline"
              onClick={() => postStep > 0 ? setPostStep(postStep - 1) : navigateTo('dashboard')}
            >
              {postStep === 0 ? 'Cancel' : '← Back'}
            </button>
            <div className="pp-wizard-right-actions">
              <button type="button" className="pp-btn pp-btn-ghost" onClick={handleSaveDraft} disabled={isSubmitting}>
                Save as Draft
              </button>
              {postStep < 6 ? (
                <button
                  type="button"
                  className="pp-btn pp-btn-primary"
                  onClick={() => {
                    if (postStep === 1 && (!postForm.city.trim() || !postForm.state.trim())) {
                      setNotice('Please enter both city and state.');
                      return;
                    }
                    if (postStep === 2) {
                      const min = postForm.minValue ? Number(postForm.minValue.replace(/[^\d.]/g, '')) : null;
                      const max = postForm.maxValue ? Number(postForm.maxValue.replace(/[^\d.]/g, '')) : null;
                      if ((min != null && !Number.isFinite(min)) || (max != null && !Number.isFinite(max)) || (min != null && max != null && min > max)) {
                        setNotice('Enter a valid price range. The maximum must be at least the minimum.');
                        return;
                      }
                    }
                    if (postStep === 3 && (!Number.isFinite(Number(postForm.fee)) || Number(postForm.fee) < 5 || Number(postForm.fee) > 50)) {
                      setNotice('Referral fee must be between 5% and 50%.');
                      return;
                    }
                    setPostStep(postStep + 1);
                  }}
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button type="button" className="pp-btn pp-btn-primary" onClick={handlePublishReferral} disabled={isSubmitting}>
                  {isSubmitting ? (editingReferralId ? 'Publishing...' : 'Publishing...') : editingReferralId ? 'Update & Publish' : 'Publish Referral Now'} <Check size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // MODALS
  // -------------------------------------------------------------
  const renderReferralDetailModal = () => {
    if (!selectedReferral) return null;
    const r = selectedReferral;
    const isReferralOwner = r.creatorProfessionalId === user?.uid || r.creatorId === user?.uid;
    const ownerApplications = isReferralOwner ? rawApplications.filter(application => application.referralId === r.id) : [];
    return (
      <div className="pp-detail-backdrop" onClick={() => setSelectedReferral(null)}>
        <aside className="pp-detail-drawer" role="dialog" aria-modal="true" aria-label="Referral details" onClick={e => e.stopPropagation()}>
          <div className="pp-detail-drawer-head"><div><span className="pp-eyebrow-chip"><BriefcaseBusiness size={12} /> REFERRAL DETAILS</span><span className={`pp-status-pill status-${isReferralOwner ? String(r.status || 'unknown').toLowerCase() : 'published'}`}>{displayStatus(r.status || 'published')}</span></div><button className="pp-modal-close" aria-label="Close referral details" onClick={() => setSelectedReferral(null)}><X size={18} /></button></div>
          <div className="pp-detail-drawer-content">
            <div className="pp-modal-header">
              <span className="pp-type-badge">{r.category || 'Referral Opportunity'}</span>
              <h2>{r.title || `${r.clientType || 'Referral'} opportunity`}</h2>
              <p><MapPin size={14} /> {[r.city, r.state, r.zip].filter(Boolean).join(', ') || 'Location not provided'}</p>
              {formatPostedTime(r.createdAt) && <small className="pp-market-posted-time"><Clock size={12} /> {formatPostedTime(r.createdAt)}</small>}
            </div>
            <div className="pp-modal-specs-grid">
              <div><small>Price Range</small><b>{r.minValue || r.maxValue ? `${r.minValue ? formatMoney(r.minValue) : '—'} – ${r.maxValue ? formatMoney(r.maxValue) : '—'}` : 'Unspecified'}</b></div>
              <div><small>Referral Fee</small><b className="text-primary">{r.feePercent != null ? `${r.feePercent}% Commission` : 'Not provided'}</b></div>
              <div><small>Property Type</small><b>{r.propertyType || 'Not provided'}</b></div>
              <div><small>Status</small><b>{r.status || 'Published'}</b></div>
              {isReferralOwner && <div><small>Applications</small><b>{ownerApplications.length}</b></div>}
            </div>
            <div className="pp-modal-section">
              <h3>Opportunity Description</h3>
              <p>{r.description || 'No description added.'}</p>
            </div>
            {r.preferences && (
              <div className="pp-modal-section">
                <h3>Preferences</h3>
                <p>{r.preferences}</p>
              </div>
            )}
            <div className="pp-modal-section pp-detail-posted-by"><h3>Posted by</h3><div className="pp-detail-author-avatar">{(r.creatorName || 'P').trim().charAt(0).toUpperCase()}</div><div><b>{r.creatorName || 'Professional name not provided'}</b><p>{r.creatorBrokerage || 'Brokerage not provided'}</p></div></div>
          </div>
          <div className="pp-modal-footer pp-detail-drawer-footer">
            {isReferralOwner ? <button className="pp-btn pp-btn-primary" onClick={() => { setSelectedReferral(null); setShowManageReferralModal(r); }}><Users size={15} /> View applications ({ownerApplications.length})</button> : <>
              <button className="pp-btn pp-btn-outline" onClick={() => handleToggleSave(r.id)}><Star size={15} fill={savedReferralIds.has(r.id) ? 'currentColor' : 'none'} />{savedReferralIds.has(r.id) ? 'Saved' : 'Save'}</button>
              <button className="pp-btn pp-btn-primary" onClick={() => startApplyProcess(r)}>Apply for Referral <ArrowRight size={15} /></button>
            </>}
          </div>
        </aside>
      </div>
    );
  };

  const renderApplyModal = () => {
    if (!applyModalReferral) return null;
    const r = applyModalReferral;

    return (
      <div className="pp-modal-overlay" onClick={() => setApplyModalReferral(null)}>
        {/* Single, clear application workspace: referral context beside the application form. */}
        <div className="pp-modal-dialog pp-application-full-dialog" onClick={e => e.stopPropagation()}>
            <div className="pp-app-flow-nav">
              <div className="pp-application-heading">
                <span className="pp-eyebrow-chip"><BriefcaseBusiness size={12} /> REFERRAL APPLICATION</span>
                <h2>Apply to this referral</h2>
                <p>Review the opportunity and send your introduction.</p>
              </div>
              <button type="button" className="pp-back-nav-btn" onClick={() => setApplyModalReferral(null)}>
                <X size={16} /> Close
              </button>
            </div>

            <div className="pp-app-flow-grid">
            {/* TOP CARD: REFERRAL OPPORTUNITY SUMMARY */}
            <div className="pp-opp-summary-card">
              <div className="pp-opp-badge-row">
                <span className="pp-partner-lead-pill">
                  <BriefcaseBusiness size={13} /> Referral Opportunity
                </span>
              </div>

              <h2 className="pp-opp-header-title">
                {r.title || 'Referral opportunity'}
              </h2>

              <p className="pp-opp-location"><MapPin size={15} /> {[r.city, r.state, r.zip].filter(Boolean).join(', ') || 'Location not provided'} <span>·</span> {r.clientType || r.type || r.category || 'Referral opportunity'}</p>

              <div className="pp-opp-price-val">
                <b>
                  {r.minValue != null || r.maxValue != null
                    ? `${r.minValue != null ? formatMoney(r.minValue) : 'No minimum'} – ${r.maxValue != null ? formatMoney(r.maxValue) : 'No maximum'}`
                    : 'Budget not provided'}
                </b>
              </div>

              <div className="pp-opp-meta-strip">
                <span><UserRound size={14} /> {r.clientType || r.type || r.category || 'Client type not provided'}</span>
                <span><FileSignature size={14} /> {r.feePercent != null && r.feePercent !== '' ? `${r.feePercent}% Referral Fee` : 'Referral fee not provided'}</span>
                <span><Clock size={14} /> {r.createdAt?.toDate ? `Posted ${r.createdAt.toDate().toLocaleDateString()}` : 'Post date not provided'}</span>
              </div>

              <details className="pp-opp-description-box pp-apply-description">
                <summary>Description and opportunity context</summary>
                <p>{r.description || 'No description was provided for this referral.'}</p>
              </details>
            </div>

            {/* APPLICATION FORM & BROKER INFO */}
            <form onSubmit={handleApplySubmit} className="pp-app-submission-form-card">
              <div className="pp-app-form-header">
                <h3>Submit Your Application</h3>
                <p>Let the referring agent know why you are a good match</p>
              </div>

              <div className="pp-application-privacy-note"><span><ShieldCheck size={16} /></span><p>Your note and broker contact details will be shared with the professional who posted this referral.</p></div>

              {/* Pitch textarea */}
              <div className="pp-pitch-field-group">
                <textarea
                  rows="4"
                  required
                  maxLength={5000}
                  placeholder="Describe your relevant experience, local knowledge, and how you would support this opportunity..."
                  value={applyPitch}
                  onChange={e => setApplyPitch(e.target.value)}
                  className="pp-full-pitch-textarea"
                />
                <div className="pp-char-counter">
                  <span>{applyPitch.length}/5,000</span>
                </div>
              </div>

              {/* Managing Broker Info */}
              <div className="pp-broker-info-block">
                <h4>Managing Broker Information</h4>
                <p className="pp-broker-caption">Your managing broker will need to sign the referral agreement if you are selected.</p>

                <div className="pp-broker-inputs-grid">
                  <div className="pp-single-input-wrap">
                    <label>Broker Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your managing broker's full name"
                      value={applyBrokerName}
                      onChange={e => setApplyBrokerName(e.target.value)}
                    />
                  </div>

                  <div className="pp-single-input-wrap">
                    <label>Broker Email for E-Signature *</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter your managing broker's email for e-signature"
                      value={applyBrokerEmail}
                      onChange={e => setApplyBrokerEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Submit & Consent */}
              <div className="pp-app-submit-section">
                {applyError && <div className="pp-apply-error" role="alert"><CircleAlert size={16} />{applyError}</div>}
                <button type="submit" className="pp-btn pp-btn-primary pp-btn-lg pp-btn-block" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="pp-spin" /> Submitting Application...
                    </>
                  ) : (
                    <>
                      Submit Application
                    </>
                  )}
                </button>

                <p className="pp-app-consent-disclaimer">
                  By submitting this application, you consent to your email address, phone number, broker name, and broker email being shared with the referring agent for the purpose of contacting you regarding this referral.
                </p>
              </div>
            </form>
            </div>
        </div>
      </div>
    );
  };

  const renderManageReferralModal = () => {
    if (!showManageReferralModal) return null;
    const r = showManageReferralModal;
    const applicantsForThis = rawApplications.filter(a => a.referralId === r.id);

    return (
      <div className="pp-modal-overlay" onClick={() => setShowManageReferralModal(null)}>
        <div className="pp-modal-dialog pp-modal-large" onClick={e => e.stopPropagation()}>
          <button className="pp-modal-close" onClick={() => setShowManageReferralModal(null)}><X size={18} /></button>
          <div className="pp-modal-header">
            <span className="pp-eyebrow-chip"><Users size={12} /> REFERRAL APPLICANTS</span>
            <h2>Manage: {r.title}</h2>
            <p><MapPin size={13} /> {r.city}, {r.state} · Status: <b>{r.status || 'Published'}</b></p>
          </div>
          <div className="pp-modal-body">
            <h3>{applicantsForThis.length} Applicants in Database</h3>
            <div className="pp-applicants-list">
              {applicantsForThis.length > 0 ? (
                applicantsForThis.map(app => (
                  <div className="pp-applicant-card" key={app.id}>
                    <div className="pp-applicant-card-left">
                      <span className="pp-avatar lg">{app.applicantName?.[0]?.toUpperCase()}</span>
                      <div>
                        <div className="pp-applicant-name-row">
                          <b>{app.applicantName}</b>
                          <span className={`pp-status-pill status-${app.status?.toLowerCase()}`}>{app.status}</span>
                        </div>
                        <small>{app.applicantBrokerage} · {app.applicantExp}</small>
                        <p className="pp-applicant-msg">"{app.pitchNote}"</p>
                      </div>
                    </div>
                    <div className="pp-applicant-actions">
                      {app.status !== 'SHORTLISTED' && app.status !== 'ACCEPTED' && (
                        <button className="pp-btn-sm pp-btn-ghost" onClick={() => handleApplicantDecision(app, 'SHORTLISTED')}>
                          Shortlist
                        </button>
                      )}
                      {app.status !== 'ACCEPTED' ? (
                        <button className="pp-btn-sm pp-btn-primary" onClick={() => handleApplicantDecision(app, 'ACCEPTED')}>
                          Accept
                        </button>
                      ) : (
                        <span className="text-success font-bold">✓ Accepted</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="pp-empty-state-sm">
                  <p>No professionals have applied to this referral posting yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAgreementModal = () => {
    if (!selectedAgreement) return null;
    const ag = rawAgreements.find(item => item.id === selectedAgreement.id) || selectedAgreement;
    const isReferring = ag.referringProfessionalId === user?.uid;
    const mySignature = isReferring ? ag.referrerSignature : ag.receiverSignature;
    const hasSigned = !!(mySignature?.signedAt || (isReferring ? ag.signedByReferring : ag.signedByReceiving));
    const status = String(ag.status || '').toUpperCase().replaceAll(' ', '_');
    const canSign = !hasSigned && (isReferring ? ['DRAFT', 'PENDING_REFERRER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(status) : ['PENDING_RECEIVER_SIGNATURE', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(status));
    const snapshot = ag.referralSnapshot || {};
    const terms = ag.termsSnapshot || {};
    const sections = Array.isArray(terms.sections) ? terms.sections : [];

    return (
      <div className="pp-modal-overlay" onClick={closeAgreement}>
        <div className="pp-modal-dialog pp-modal-large pp-agreement-review" role="dialog" aria-modal="true" aria-label="Review referral agreement" onClick={e => e.stopPropagation()}>
          <button className="pp-modal-close" aria-label="Close agreement" onClick={closeAgreement}><X size={18} /></button>
          <div className="pp-modal-header">
            <span className="pp-eyebrow-chip"><FileSignature size={12} /> REFERRAL AGREEMENT</span>
            <h2>{ag.agreementNumber || `Agreement #${ag.id.slice(0, 8).toUpperCase()}`}</h2>
            <p>{displayStatus(ag.status)} · Version {ag.agreementVersion || 1}{ag.agreementTemplateVersion ? ` · Terms v${ag.agreementTemplateVersion}` : ''}</p>
          </div>
          <div className="pp-modal-body">
            <div className="pp-legal-doc-box">
              <h4>AGENTREFERRALS REFERRAL AGREEMENT</h4>
              <p>Referral opportunity: <b>{snapshot.title || ag.referralTitle || 'Referral'}</b></p>
              <p>Created {ag.createdAt?.toDate?.().toLocaleDateString?.() || '—'} · Referral ID {ag.referralId || '—'}</p>
              <h5>PARTIES</h5>
              <div className="pp-signatures-grid">
                {[['Referring professional', ag.referringParty || { name: ag.referringName, email: ag.referringEmail, phone: ag.referringPhone, brokerage: ag.referringBrokerage, brokerageAddress: ag.referringBrokerageAddress, licenseNumber: ag.referringLicenseNumber, licenseState: ag.referringLicenseState }], ['Receiving professional', ag.receivingParty || { name: ag.receivingName, email: ag.receivingEmail, phone: ag.receivingPhone, brokerage: ag.receivingBrokerage, brokerageAddress: ag.receivingBrokerageAddress, licenseNumber: ag.receivingLicenseNumber, licenseState: ag.receivingLicenseState }]].map(([label, party]) => <div className="pp-signature-block" key={label}><small>{label}</small><b>{party?.name || 'Details to be completed'}</b><p>{party?.email || 'Email not provided'} · {party?.phone || 'Phone not provided'}</p><p>{party?.brokerage || 'Brokerage not provided'} · License {party?.licenseNumber || '—'} {party?.licenseState || ''}</p><p>{party?.brokerageAddress || 'Brokerage address not provided'}</p></div>)}
              </div>
              <h5>REFERRAL SNAPSHOT</h5>
              <p>Type: {snapshot.referralType || snapshot.clientType || '—'} · Location: {[snapshot.city, snapshot.state, snapshot.zip].filter(Boolean).join(', ') || '—'} · Property: {snapshot.propertyType || '—'}</p>
              <p>Estimated price: {snapshot.priceRange || [snapshot.minPrice, snapshot.maxPrice].filter(Boolean).join(' – ') || 'Not provided'} · Fee: {snapshot.referralFee?.percent ?? ag.feePercent ?? '—'}{snapshot.referralFee?.percent ?? ag.feePercent ? '%' : ''} · Basis: {snapshot.referralFee?.basis || 'Not specified'} · Payment: {snapshot.referralFee?.paymentCondition || 'Not specified'}</p>
              {snapshot.description && <p>{snapshot.description}</p>}
              {sections.length ? sections.map(section => <section key={section.id || section.title}><h5>{section.title}</h5><p>{section.body || 'Terms not configured.'}</p></section>) : <p className="pp-agreement-terms-warning">The legal terms template is not configured for this agreement. Signing is disabled until an administrator publishes an approved, versioned template.</p>}
              <h5>SIGNATURE RECORD</h5>
              <div className="pp-signatures-grid">
                <div className="pp-signature-block">
                  <small>Referring professional</small>
                  <b>{ag.referrerSignature?.signerName || ag.referringParty?.name || ag.referringName || '—'}</b>
                  <p>{ag.referrerSignature?.signerEmail || ag.referringParty?.email || '—'}</p>
                  <span className={`pp-sig-badge ${ag.referrerSignature?.signedAt || ag.signedByReferring ? 'signed' : 'pending'}`}>
                    {ag.referrerSignature?.signedAt || ag.signedByReferring ? '✓ Signed' : '⏳ Awaiting Signature'}
                  </span>
                </div>
                <div className="pp-signature-block">
                  <small>Receiving professional</small>
                  <b>{ag.receiverSignature?.signerName || ag.receivingParty?.name || ag.receivingName || '—'}</b>
                  <p>{ag.receiverSignature?.signerEmail || ag.receivingParty?.email || '—'}</p>
                  <span className={`pp-sig-badge ${ag.receiverSignature?.signedAt || ag.signedByReceiving ? 'signed' : 'pending'}`}>
                    {ag.receiverSignature?.signedAt || ag.signedByReceiving ? '✓ Signed' : '⏳ Awaiting Signature'}
                  </span>
                </div>
              </div>
              {ag.document?.storagePath && ag.status === 'ACTIVE' && <button type="button" className="pp-btn pp-btn-outline" onClick={() => handleDownloadAgreement(ag)}><FileText size={15} /> Download executed PDF</button>}
              {ag.status === 'ACTIVE' && ag.isImmutable && <div className="pp-agreement-amendment"><h5>Need to change these terms?</h5><p>Create a separate amendment for both parties to review and sign. This will not change this executed agreement.</p><label htmlFor="agreement-amendment-summary">Amendment details</label><textarea id="agreement-amendment-summary" rows={3} maxLength={5000} value={amendmentSummary} onChange={e => setAmendmentSummary(e.target.value)} placeholder="Describe the requested change in at least 20 characters" /><button type="button" className="pp-btn pp-btn-outline" disabled={creatingAmendment || amendmentSummary.trim().length < 20} onClick={() => handleCreateAgreementAmendment(ag.id)}><FileSignature size={15} /> {creatingAmendment ? 'Creating amendment…' : 'Create amendment version'}</button></div>}
              <section className="pp-agreement-audit"><h5><History size={15} /> AUDIT TRAIL</h5>{agreementEvents.length ? <ol>{agreementEvents.map(event => <li key={event.id}><b>{displayStatus(event.eventType)}</b><small>{event.createdAt?.toDate?.().toLocaleString?.() || 'Recorded securely'}{event.actorUid ? ` · ${event.actorUid === user?.uid ? 'You' : 'Other participant'}` : ' · System'}</small></li>)}</ol> : <p>Audit activity will appear here as the parties review and sign.</p>}</section>
            </div>
          </div>
          {canSign && sections.length > 0 && <div className="pp-agreement-consent"><label htmlFor="agreement-signature-name">Your full legal name</label><input id="agreement-signature-name" maxLength={140} value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder={dbProfile?.displayName || user?.displayName || 'Type your full legal name'} autoComplete="name" /><fieldset className="pp-agreement-signature-method"><legend>Signature method</legend><label><input type="radio" name="signature-method" checked={signatureMethod === 'typed'} onChange={() => setSignatureMethod('typed')} /> Type signature</label><label><input type="radio" name="signature-method" checked={signatureMethod === 'drawn'} onChange={() => setSignatureMethod('drawn')} /> Draw signature</label></fieldset>{signatureMethod === 'typed' ? <div className="pp-agreement-typed-preview">{signatureName.trim() || 'Your typed signature preview'}</div> : <div><canvas ref={signatureCanvasRef} width={720} height={150} className="pp-agreement-signature-canvas" onPointerDown={beginSignatureStroke} onPointerMove={continueSignatureStroke} onPointerUp={finishSignatureStroke} onPointerCancel={finishSignatureStroke} /><button type="button" className="pp-btn-sm pp-btn-outline" onClick={clearDrawnSignature}>Clear signature</button></div>}<label className="pp-agreement-consent-check"><input type="checkbox" checked={signatureConsent} onChange={e => setSignatureConsent(e.target.checked)} /> <span>I have reviewed and agree to the agreement terms above. {ag.termsOfServiceUrl && <>Read the <a href={ag.termsOfServiceUrl} target="_blank" rel="noreferrer">Terms of Service</a>.</>}</span></label><label className="pp-agreement-consent-check"><input type="checkbox" checked={privacyConsent} onChange={e => setPrivacyConsent(e.target.checked)} /> <span>I acknowledge the {ag.privacyPolicyUrl ? <a href={ag.privacyPolicyUrl} target="_blank" rel="noreferrer">Privacy Policy</a> : 'Privacy Policy'} and how my information is used for this referral.</span></label><label className="pp-agreement-consent-check"><input type="checkbox" checked={electronicConsent} onChange={e => setElectronicConsent(e.target.checked)} /> <span>I consent to electronic records and electronic signatures for this agreement.</span></label><small>Privacy policy version {ag.privacyPolicyVersion || 'current'} · Terms version {ag.termsOfServiceVersion || 'current'}. Your verified account, signature, consent versions, signing time and device metadata will be recorded.</small></div>}
          {signatureError && <p className="pp-agreement-sign-error" role="alert">{signatureError}</p>}
          <div className="pp-modal-footer">
            <button className="pp-btn pp-btn-outline" onClick={closeAgreement}>Close</button>
            {['DRAFT', 'READY_FOR_SIGNATURE', 'PENDING_SIGNATURES'].includes(status) && sections.length === 0 && isReferring ? <button className="pp-btn pp-btn-primary" disabled={signingAgreement} onClick={() => handlePrepareAgreement(ag.id)}><RefreshCw size={15} /> {signingAgreement ? 'Loading approved terms…' : 'Load approved terms'}</button> : status === 'SIGNED' && !ag.document?.storagePath ? <button className="pp-btn pp-btn-primary" disabled={signingAgreement} onClick={() => handleRetryAgreementPdf(ag.id)}><RefreshCw size={15} /> {signingAgreement ? 'Preparing PDF…' : 'Prepare executed PDF'}</button> : canSign && sections.length > 0 ? (
              <button className="pp-btn pp-btn-primary" disabled={signingAgreement || !signatureConsent || !privacyConsent || !electronicConsent || signatureName.trim().length < 2 || (signatureMethod === 'drawn' && !signatureStrokes.some(stroke => stroke.length > 1))} onClick={() => handleSignAgreement(ag.id)}>
                <FileSignature size={15} /> {signingAgreement ? 'Recording signature…' : 'Confirm & sign'}
              </button>
            ) : (
              <span className="text-success font-bold">{hasSigned ? '✓ You have signed this agreement' : sections.length === 0 ? 'Signing unavailable until approved legal terms are published.' : 'This agreement is not open for your signature yet.'}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCurrentPage = () => {
    switch (page) {
      case 'dashboard': return renderDashboard();
      case 'marketplace': return renderMarketplace();
      case 'my-referrals': return renderMyReferrals();
      case 'applications': return renderMyApplications();
      case 'saved': return renderSavedReferrals();
      case 'pipeline': return renderActiveReferrals();
      case 'agreements': return renderAgreements();
      case 'notifications': return renderNotifications();
      case 'profile': return renderProfile();
      case 'brokerage': return renderBrokerage();
      case 'verification': return renderVerification();
      case 'documents': return renderDocuments();
      case 'settings': return renderSettings();
      case 'support': return renderSupport();
      case 'post-referral': return renderPostReferral();
      default: return renderDashboard();
    }
  };

  return (
    <div className="coterie-theme-wrapper">
      <CoteriePortal
        user={user}
        profile={profile}
        dbProfile={dbProfile}
        rawReferrals={rawReferrals}
        rawAgreements={rawAgreements}
        rawNotifications={rawNotifications}
        rawApplications={rawApplications}
        rawSaved={rawSaved}
        savedReferralIds={savedReferralIds}
        rawActivity={rawActivity}
        onLogout={onLogout}
        onOpenReferral={(r) => setSelectedReferral(r)}
        onApplyReferral={(r) => startApplyProcess(r)}
        onSaveReferral={(r) => handleToggleSave(r.id)}
        onPostReferralClick={() => setPage('post-referral')}
        onOpenProfile={() => setPage('profile')}
        onOpenAgreementModal={(ag) => openAgreement(ag)}
        onDownloadAgreement={(ag) => handleDownloadAgreement(ag)}
        onManageReferral={(r) => setShowManageReferralModal(r)}
        onApplicantDecision={(app, status) => handleApplicantDecision(app, status)}
        onWithdrawApplication={async (appId) => {
          if (!db) return;
          try {
            await updateDoc(doc(db, 'applications', appId), { status: 'WITHDRAWN' });
            setNotice('Application withdrawn.');
          } catch (err) {
            console.error('Withdraw error:', err);
            setNotice('Could not withdraw application.');
          }
        }}
        onPauseReferral={async (r) => {
          if (!db) return;
          try {
            const next = String(r.status || '').toLowerCase() === 'paused' ? 'Active' : 'Paused';
            await updateDoc(doc(db, 'referrals', r.id), { status: next });
            setNotice(`Referral ${next.toLowerCase()}.`);
          } catch (err) {
            console.error('Pause error:', err);
            setNotice('Could not update referral status.');
          }
        }}
        onCloseReferral={async (r) => {
          if (!db) return;
          try {
            await updateDoc(doc(db, 'referrals', r.id), { status: 'Closed' });
            setNotice('Referral marked as closed.');
          } catch (err) {
            console.error('Close error:', err);
            setNotice('Could not close referral.');
          }
        }}
        onOpenSettings={() => setPage('settings')}
        onOpenSupport={() => setPage('support')}
        onMarkAllNotificationsRead={handleMarkAllNotifsRead}
        onOpenNotification={handleOpenNotification}
      />

      {/* Slide-out modal for Post Referral */}
      {page === 'post-referral' && (
        <div className="coterie-modal-backdrop" onClick={() => setPage('dashboard')}>
          <div className="coterie-modal-box coterie-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="coterie-modal-head">
              <h2>Post a Referral</h2>
              <button className="coterie-modal-close" onClick={() => setPage('dashboard')} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {renderPostReferral()}
          </div>
        </div>
      )}

      {/* Slide-out modal for Profile */}
      {page === 'profile' && (
        <div className="coterie-modal-backdrop" onClick={() => setPage('dashboard')}>
          <div className="coterie-modal-box coterie-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="coterie-modal-head">
              <h2>My Agent Profile</h2>
              <button className="coterie-modal-close" onClick={() => setPage('dashboard')} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {renderProfile()}
          </div>
        </div>
      )}

      {/* Slide-out modal for Settings */}
      {page === 'settings' && (
        <div className="coterie-modal-backdrop" onClick={() => setPage('dashboard')}>
          <div className="coterie-modal-box coterie-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="coterie-modal-head">
              <h2>Account Settings</h2>
              <button className="coterie-modal-close" onClick={() => setPage('dashboard')} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {renderSettings()}
          </div>
        </div>
      )}

      {/* Slide-out modal for Support */}
      {page === 'support' && (
        <div className="coterie-modal-backdrop" onClick={() => setPage('dashboard')}>
          <div className="coterie-modal-box" onClick={e => e.stopPropagation()}>
            <div className="coterie-modal-head">
              <h2>Help & Support</h2>
              <button className="coterie-modal-close" onClick={() => setPage('dashboard')} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {renderSupport()}
          </div>
        </div>
      )}

      {/* Render Active Modals */}
      {renderReferralDetailModal()}
      {renderApplyModal()}
      {renderManageReferralModal()}
      {renderAgreementModal()}
    </div>
  );
}
