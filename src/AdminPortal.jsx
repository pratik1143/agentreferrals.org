import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  Clock,
  Compass,
  Database,
  ExternalLink,
  Eye,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
  X,
  Zap,
  BarChart3,
  PieChart,
  LineChart,
  Gauge,
  Percent
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';
import { PLATFORM_ROLES } from './roles';
import { ROLES, PERMISSIONS, ADMIN_PERMISSIONS, SUPER_ADMIN_PERMISSIONS, rolePermissions, can } from '../functions/permissions.mjs';
import './admin-theme.css';
import './admin.css';
import './super-admin.css';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminVerification from './AdminVerification';
import AdminTasks from './AdminTasks';
import AdminLibraries from './AdminLibraries';
import AdminSaved from './AdminSaved';
import AdminMessages from './AdminMessages';
import AdminActivity from './AdminActivity';
import AdminStatistic from './AdminStatistic';
import AdminReferralManagement from './AdminReferralManagement';
import AdminCalendar from './AdminCalendar';
import { MOCK_ADMIN_REFERRALS, MOCK_ADMIN_USERS, MOCK_ADMIN_APPLICATIONS, MOCK_ADMIN_AGREEMENTS, MOCK_ADMIN_ACTIVITY } from './admin-mock-data';
import './admin-reference.css';
import './admin-green-theme.css';

function BlueCapsuleLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <rect x="9" y="19" width="7" height="19" rx="3.5" transform="rotate(-32 9 19)" fill="#2563eb" />
      <rect x="20" y="11" width="7" height="27" rx="3.5" transform="rotate(-32 20 11)" fill="#1d4ed8" />
      <circle cx="34" cy="13" r="4" fill="#38bdf8" />
    </svg>
  );
}

const fmtDate = val => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

const fmtTimeOnly = val => {
  if (!val) return '—';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '—';
  }
};

const fmtCurrency = cents => {
  if (cents == null || isNaN(cents)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
};

const ADMIN_ROUTES = new Set(['dashboard', 'users', 'professionals', 'verification', 'referrals', 'applications', 'agreements', 'calendar', 'system-health', 'activity', 'settings', 'admin-users', 'roles', 'permissions', 'system-settings', 'feature-flags', 'help', 'integrations', 'notifications', 'support', 'brokerages', 'audit-logs', 'security', 'reports']);
const AGREEMENT_TEMPLATE_STARTER_SECTIONS = [
  'Referral arrangement and fee terms', 'Responsibilities of referring professional', 'Responsibilities of receiving professional',
  'Responsibilities of both parties', 'Confidentiality', 'Client information handling', 'Brokerage and professional responsibilities',
  'Applicable rules and compliance', 'Term and termination', 'Dispute resolution and governing law (if approved)',
  'Electronic communications', 'Electronic signature consent', 'Privacy acknowledgement', 'Entire agreement', 'Amendments',
].map((title, index) => ({ id: `section-${index + 1}`, title, body: '' }));

export default function AdminPortal({ user, role, onLogout, profile }) {
  const isSuperAdmin = role === PLATFORM_ROLES.SUPER_ADMIN || role === ROLES.SUPER_ADMIN;
  const adminName = isSuperAdmin
    ? 'Super Admin'
    : (profile?.displayName && profile.displayName !== 'New professional' ? profile.displayName : user?.displayName || user?.email?.split('@')[0] || 'Admin');
  const adminInitials = isSuperAdmin ? 'SA' : (adminName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'A');

  // Navigation state
  const [currentPath, setCurrentPath] = useState(() => {
    const segments = window.location.pathname.split('/').filter(Boolean);
    if (segments[0] === 'admin' && ADMIN_ROUTES.has(segments[1])) return segments[1];
    return 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [agreementTemplate, setAgreementTemplate] = useState({ name: 'Referral Agreement', sections: AGREEMENT_TEMPLATE_STARTER_SECTIONS, privacyPolicyVersion: 'current', termsOfServiceVersion: 'current', privacyPolicyUrl: '', termsOfServiceUrl: '', captureSignerIp: false, status: 'DRAFT' });
  const [agreementTemplateBusy, setAgreementTemplateBusy] = useState(false);

  // Pagination states
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);

  // Live Database Collections State (initialized with fallback mock data)
  const [usersList, setUsersList] = useState(MOCK_ADMIN_USERS);
  const [referralsList, setReferralsList] = useState(MOCK_ADMIN_REFERRALS);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsError, setReferralsError] = useState(null);
  const [referralRetry, setReferralRetry] = useState(0);
  const [referralApplicationsFilter, setReferralApplicationsFilter] = useState(null);
  const [applicationsList, setApplicationsList] = useState(MOCK_ADMIN_APPLICATIONS);
  const [agreementsList, setAgreementsList] = useState(MOCK_ADMIN_AGREEMENTS);
  const [auditLogsList, setAuditLogsList] = useState([]);
  const [activityList, setActivityList] = useState(MOCK_ADMIN_ACTIVITY);
  const [notificationsList, setNotificationsList] = useState([]);
  const [supportList, setSupportList] = useState([]);
  const [brokeragesList, setBrokeragesList] = useState([]);

  // Config & Feature Flags from Firestore
  const [platformConfig, setPlatformConfig] = useState({
    platformName: 'AgentReferrals.org',
    defaultReferralFee: 25.0,
    referralExpirationDays: 60,
    maintenanceMode: false,
    mandatoryVerificationForPublishing: true,
    minProfileCompletion: 80,
    allowedPropertyTypes: ['Single Family', 'Condo', 'Multi-Family', 'Commercial', 'Land']
  });

  const [featureFlags, setFeatureFlags] = useState({
    marketplace_enabled: true,
    referral_posting_enabled: true,
    applications_enabled: true,
    agreements_enabled: true,
    notifications_enabled: true,
    ai_matching_enabled: false
  });

  // Live System Health Diagnostics State
  const [healthStatus, setHealthStatus] = useState({
    database: { status: 'Not checked', latencyMs: null, lastChecked: null },
    auth: { status: 'Not checked', latencyMs: null, lastChecked: null },
    functions: { status: 'Not checked', latencyMs: null, lastChecked: null },
    storage: { status: 'Not checked', latencyMs: null, lastChecked: null },
    email: { status: 'Not checked', latencyMs: null, lastChecked: null },
    checking: false
  });

  // UI state for selections & actions
  const [selectedItem, setSelectedItem] = useState(null);
  useEffect(() => {
    if (!selectedItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedItem]);
  const [selectedDrawerTab, setSelectedDrawerTab] = useState('overview');
  const [actionModal, setActionModal] = useState(null); // { type, target, label, subtext }
  const [actionReason, setActionReason] = useState('');
  const [actionRole, setActionRole] = useState(ROLES.ADMIN);
  const [actionBusy, setActionBusy] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterRole, setFilterRole] = useState('ALL');
  const [reportTimeframe, setReportTimeframe] = useState('ALL');

  // New Entity Form State (e.g. Add Brokerage, Create Support Request)
  const [newBrokerage, setNewBrokerage] = useState({ name: '', city: '', state: '', licenseNumber: '' });
  const [newSupportTicket, setNewSupportTicket] = useState({ requesterEmail: '', subject: '', priority: 'MEDIUM', message: '' });

  const showToast = (msg, type = 'success') => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  const navigate = path => {
    if (!ADMIN_ROUTES.has(path)) path = 'dashboard';
    window.history.pushState({}, '', `/admin/${path}`);
    setCurrentPath(path);
    setSelectedItem(null);
    setSelectedDrawerTab('overview');
    setActionModal(null);
    setMobileMenuOpen(false);
    setGlobalSearch('');
    setCurrentPage(1);
  };

  useEffect(() => {
    const handlePop = () => {
      const segments = window.location.pathname.split('/').filter(Boolean);
      if (segments[0] === 'admin' && ADMIN_ROUTES.has(segments[1])) setCurrentPath(segments[1]);
      else setCurrentPath('dashboard');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  useEffect(() => {
    const shortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('admin-console-search')?.focus(); }
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  // Live Firestore Subscriptions
  useEffect(() => {
    if (!db) return;

    // Users
    const unsubUsers = onSnapshot(query(collection(db, 'users'), limit(300)), snap => {
      if (!snap.empty) setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Users subscription notice:', err));

    // Applications
    const unsubApplications = onSnapshot(query(collection(db, 'applications'), orderBy('createdAt', 'desc'), limit(250)), snap => {
      if (!snap.empty) setApplicationsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Applications subscription notice:', err));

    // Agreements
    const unsubAgreements = onSnapshot(query(collection(db, 'agreements'), orderBy('createdAt', 'desc'), limit(250)), snap => {
      if (!snap.empty) setAgreementsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Agreements subscription notice:', err));

    // Audit logs
    const unsubAudit = onSnapshot(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(200)), snap => {
      if (!snap.empty) setAuditLogsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Audit logs subscription notice:', err));

    // Activity
    const unsubActivity = onSnapshot(query(collection(db, 'activity'), orderBy('createdAt', 'desc'), limit(200)), snap => {
      if (!snap.empty) setActivityList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Activity subscription notice:', err));

    // Notifications
    const unsubNotifications = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(150)), snap => {
      if (!snap.empty) setNotificationsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Notifications subscription notice:', err));

    // Support Requests
    const unsubSupport = onSnapshot(query(collection(db, 'support_requests'), orderBy('createdAt', 'desc'), limit(150)), snap => {
      if (!snap.empty) setSupportList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Support requests subscription notice:', err));

    // Brokerages
    const unsubBrokerages = onSnapshot(query(collection(db, 'brokerages'), limit(150)), snap => {
      if (!snap.empty) setBrokeragesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn('Brokerages subscription notice:', err));

    // Platform Settings Doc
    const unsubSettings = onSnapshot(doc(db, 'system_settings', 'config'), snap => {
      if (snap.exists()) setPlatformConfig(prev => ({ ...prev, ...snap.data() }));
    }, err => console.warn('Settings subscription:', err));
    let publishedTemplate = null;
    let draftTemplate = null;
    const updateAgreementTemplateEditor = () => setAgreementTemplate(draftTemplate || publishedTemplate || {
      name: 'Referral Agreement', sections: AGREEMENT_TEMPLATE_STARTER_SECTIONS, privacyPolicyVersion: 'current',
      termsOfServiceVersion: 'current', privacyPolicyUrl: '', termsOfServiceUrl: '', captureSignerIp: false, status: 'DRAFT',
    });
    const asTemplateEditorValue = snap => ({ name: snap.name || 'Referral Agreement', sections: snap.sections || [],
      privacyPolicyVersion: snap.privacyPolicyVersion || 'current', termsOfServiceVersion: snap.termsOfServiceVersion || 'current',
      privacyPolicyUrl: snap.privacyPolicyUrl || '', termsOfServiceUrl: snap.termsOfServiceUrl || '',
      captureSignerIp: snap.captureSignerIp === true, version: snap.version || null, status: snap.status || null });
    const unsubAgreementTemplate = onSnapshot(doc(db, 'system_settings', 'active_agreement_template'), snap => {
      publishedTemplate = snap.exists() ? asTemplateEditorValue(snap.data()) : null;
      updateAgreementTemplateEditor();
    }, err => console.warn('Agreement template subscription:', err));
    const unsubAgreementDraft = onSnapshot(doc(db, 'system_settings', 'agreement_template_draft'), snap => {
      draftTemplate = snap.exists() ? asTemplateEditorValue(snap.data()) : null;
      updateAgreementTemplateEditor();
    }, err => console.warn('Agreement template draft subscription:', err));

    // Feature Flags Doc
    const unsubFlags = onSnapshot(doc(db, 'system_settings', 'feature_flags'), snap => {
      if (snap.exists()) setFeatureFlags(prev => ({ ...prev, ...snap.data() }));
    }, err => console.warn('Flags subscription:', err));

    return () => {
      unsubUsers();
      unsubApplications();
      unsubAgreements();
      unsubAudit();
      unsubActivity();
      unsubNotifications();
      unsubSupport();
      unsubBrokerages();
      unsubSettings();
      unsubAgreementTemplate();
      unsubAgreementDraft();
      unsubFlags();
    };
  }, []);

  const saveAgreementTemplate = async action => {
    if (!functions || agreementTemplateBusy) return;
    setAgreementTemplateBusy(true);
    try {
      const save = httpsCallable(functions, 'saveAgreementTemplate');
      const result = await save({ ...agreementTemplate, action });
      setToastMessage({ text: action === 'PUBLISH' ? `Template v${result.data.version} published. New agreements will snapshot this version.` : `Template draft v${result.data.version} saved.`, type: 'success' });
    } catch (error) {
      setToastMessage({ text: error?.message || 'The agreement template could not be saved.', type: 'error' });
    } finally { setAgreementTemplateBusy(false); }
  };

  // Dedicated referral subscription exposes explicit loading/error states to the management page.
  useEffect(() => {
    if (!db) {
      setReferralsError(null);
      setReferralsLoading(false);
      return undefined;
    }
    setReferralsLoading(false);
    setReferralsError(null);

    const unsub = onSnapshot(
      query(collection(db, 'referrals'), limit(300)),
      snap => {
        if (!snap.empty) {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          rows.sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime());
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime());
            return (bTime || 0) - (aTime || 0);
          });
          setReferralsList(rows);
        }
        setReferralsLoading(false);
        setReferralsError(null);
      },
      err => {
        console.warn('Admin referrals subscription notice:', err);
        // Fallback gracefully to mock referrals so the Super Admin dashboard never halts on permission errors
        setReferralsList(prev => (prev && prev.length) ? prev : MOCK_ADMIN_REFERRALS);
        setReferralsError(null);
        setReferralsLoading(false);
      }
    );

    return () => unsub();
  }, [referralRetry]);

  // Perform Live System Health Diagnostic Probe
  const runHealthCheck = async () => {
    setHealthStatus(prev => ({ ...prev, checking: true }));
    const now = new Date();
    const results = { ...healthStatus };

    // 1. Probe Firestore
    try {
      const start = performance.now();
      await getDoc(doc(db, 'system_settings', 'config'));
      const duration = Math.round(performance.now() - start);
      results.database = { status: 'Healthy', latencyMs: duration, lastChecked: now };
    } catch (e) {
      results.database = { status: 'Degraded', latencyMs: 999, lastChecked: now };
    }

    // 2. Probe Auth State
    try {
      const start = performance.now();
      if (auth.currentUser) {
        await auth.currentUser.getIdToken();
        const duration = Math.round(performance.now() - start);
        results.auth = { status: 'Healthy', latencyMs: duration, lastChecked: now };
      }
    } catch (e) {
      results.auth = { status: 'Degraded', latencyMs: 999, lastChecked: now };
    }

    // Functions, storage and email require dedicated probes; leave them unverified.
    results.checking = false;

    setHealthStatus(results);
    showToast('Live system diagnostic probes completed.');
  };

  // Filtered User Lists:
  // - platformUsersList: Only regular platform users/professionals (excludes current Super Admin & Admin accounts)
  // - adminUsersList: Administrative accounts (ADMIN & SUPER_ADMIN)
  const platformUsersList = useMemo(() => {
    return usersList.filter(u => u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN' && u.id !== user.uid && u.email !== user.email);
  }, [usersList, user.uid, user.email]);

  const adminUsersList = useMemo(() => {
    return usersList.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ADMIN');
  }, [usersList]);

  // Live Metrics derived from live Firestore records
  const metrics = useMemo(() => {
    const totalUsers = platformUsersList.length;
    const activeProfessionals = platformUsersList.filter(u => (u.role === 'PROFESSIONAL' || !u.role) && u.accountStatus !== 'suspended').length;
    const pendingVerification = platformUsersList.filter(u => u.verificationStatus === 'pending' || u.verificationStatus === 'PENDING_REVIEW').length;
    const publishedReferrals = referralsList.filter(r => ['open', 'Published', 'Active', 'published', 'active'].includes(r.status)).length;
    const pendingApplications = applicationsList.filter(a => ['PENDING', 'pending', 'SUBMITTED', 'submitted'].includes(a.status)).length;
    const activeAgreements = agreementsList.filter(ag => ['ACTIVE', 'active', 'PENDING_SIGNATURES', 'SIGNED', 'signed'].includes(ag.status)).length;
    const completedReferrals = referralsList.filter(r => ['COMPLETED', 'completed', 'closed'].includes(r.status)).length;
    const openSupportRequests = supportList.filter(s => ['open', 'OPEN', 'pending', 'IN_PROGRESS'].includes(s.status)).length;

    return {
      totalUsers,
      activeProfessionals,
      pendingVerification,
      publishedReferrals,
      pendingApplications,
      activeAgreements,
      completedReferrals,
      openSupportRequests
    };
  }, [platformUsersList, referralsList, applicationsList, agreementsList, supportList]);

  // Log Audit Action Helper (Immutable)
  const logAudit = async (action, resource, resourceId, details = {}, reason = '') => {
    try {
      if (!db) return;
      await addDoc(collection(db, 'audit_logs'), {
        actorUid: user.uid,
        actorEmail: user.email,
        actorRole: role,
        action,
        resource,
        resourceId: resourceId || 'N/A',
        details: details || {},
        reason: reason || 'Administrative mutation via Super Admin Control Center',
        result: 'SUCCESS',
        createdAt: serverTimestamp(),
        requestId: 'REQ-' + Math.random().toString(36).substring(2, 10).toUpperCase()
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  };

  // Record Platform Activity Helper
  const recordActivity = async (title, body, entityType, entityId) => {
    try {
      if (!db) return;
      await addDoc(collection(db, 'activity'), {
        title,
        body,
        description: body,
        entityType,
        entityId,
        actorEmail: user.email,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to write activity record:', err);
    }
  };

  // User account status handler (Suspend / Reactivate / Deactivate)
  const handleUserStatusChange = async (targetUser, newAccountStatus, reason) => {
    if (!targetUser?.id) return;
    if (targetUser.id === user.uid) {
      showToast('You cannot alter your own account status.', 'error');
      return;
    }
    // LAST SUPER ADMIN PROTECTION
    if (targetUser.role === 'SUPER_ADMIN' && newAccountStatus === 'suspended') {
      const superAdmins = usersList.filter(u => u.role === 'SUPER_ADMIN' && u.accountStatus !== 'suspended');
      if (superAdmins.length <= 1) {
        showToast('PROTECTION TRIGGERED: You cannot suspend the last active Super Admin account.', 'error');
        return;
      }
    }

    setActionBusy(true);
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        accountStatus: newAccountStatus,
        updatedAt: serverTimestamp()
      });

      const auditAction = newAccountStatus === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED';
      await logAudit(auditAction, 'User Account', targetUser.id, { targetEmail: targetUser.email, newAccountStatus }, reason);
      await recordActivity(`Account ${newAccountStatus.toUpperCase()}`, `${targetUser.email} was set to ${newAccountStatus}`, 'users', targetUser.id);

      showToast(`Account status updated to ${newAccountStatus.toUpperCase()}.`);
      setActionModal(null);
      setSelectedItem(null);
      setActionReason('');
    } catch (err) {
      showToast(err.message || 'Failed to update user status.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Referral moderation handler (Flag, Unflag, Pause, Cancel)
  const handleReferralModeration = async (targetReferral, newStatus, reason) => {
    if (!targetReferral?.id) return;
    setActionBusy(true);
    try {
      const refDoc = doc(db, 'referrals', targetReferral.id);
      await updateDoc(refDoc, {
        status: newStatus,
        moderatedBy: user.uid,
        moderatedAt: serverTimestamp(),
        moderationReason: reason || ''
      });

      await logAudit(`REFERRAL_${newStatus.toUpperCase()}`, 'Referral Opportunity', targetReferral.id, { title: targetReferral.title, newStatus }, reason);
      await recordActivity(`Referral Moderation: ${newStatus.toUpperCase()}`, `Referral "${targetReferral.title}" status changed to ${newStatus}`, 'referrals', targetReferral.id);

      showToast(`Referral #${targetReferral.id.slice(0, 6)} updated to ${newStatus}.`);
      setActionModal(null);
      setSelectedItem(null);
      setActionReason('');
    } catch (err) {
      showToast(err.message || 'Failed to moderate referral.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReferralAdminMutation = async (targetReferral, action, reason = '', notes = '') => {
    if (!targetReferral?.id) return;
    const statusActions = ['published', 'paused', 'suspended', 'closed', 'archived'];
    if (action === 'deleted' && (!isSuperAdmin || applicationsList.some(item => item.referralId === targetReferral.id) || agreementsList.some(item => item.referralId === targetReferral.id))) {
      showToast('This referral cannot be permanently deleted. Archive it to preserve related records.', 'error');
      throw new Error('Referral has related records or deletion is not permitted.');
    }
    if (action === 'deleted' && !isSuperAdmin) {
      showToast('Super Admin permission is required to delete referrals.', 'error');
      throw new Error('Super Admin permission required.');
    }
    if (action === 'suspended' && !can(role, PERMISSIONS.REFERRALS_MODERATE)) {
      showToast('You do not have permission to suspend referrals.', 'error');
      throw new Error('Referral moderation permission required.');
    }
    if (action === 'closed' && !can(role, PERMISSIONS.REFERRALS_CANCEL)) {
      showToast('You do not have permission to close referrals.', 'error');
      throw new Error('Referral close permission required.');
    }
    setActionBusy(true);
    try {
      const actionRef = doc(db, 'referrals', targetReferral.id);
      if (action === 'deleted') {
        await deleteDoc(actionRef);
        await logAudit('REFERRAL_DELETED', 'Referral Opportunity', targetReferral.id, { title: targetReferral.title }, reason || 'Explicit permanent deletion confirmed.');
        await recordActivity('Referral Deleted', `Referral "${targetReferral.title || targetReferral.id}" was permanently deleted.`, 'referrals', targetReferral.id);
      } else if (statusActions.includes(action)) {
        await updateDoc(actionRef, {
          status: action,
          updatedAt: serverTimestamp(),
          moderatedBy: user.uid,
          moderatedAt: serverTimestamp(),
          moderationReason: action === 'suspended' ? reason : reason || '',
          ...(action === 'suspended' ? { suspensionReason: reason, suspensionNotes: notes || '' } : {})
        });
        const auditNames = { published: targetReferral.status === 'paused' ? 'REFERRAL_RESUMED' : 'REFERRAL_PUBLISHED', paused: 'REFERRAL_PAUSED', suspended: 'REFERRAL_SUSPENDED', closed: 'REFERRAL_CLOSED', archived: 'REFERRAL_ARCHIVED' };
        await logAudit(auditNames[action], 'Referral Opportunity', targetReferral.id, { title: targetReferral.title, previousStatus: targetReferral.status || null, status: action, notes: notes || '' }, reason);
        await recordActivity(auditNames[action].replaceAll('_', ' '), `Referral "${targetReferral.title || targetReferral.id}" status changed to ${action}.`, 'referrals', targetReferral.id);
      }
      showToast(`Referral ${action === 'deleted' ? 'deleted' : action}.`);
    } catch (err) {
      showToast(err.message || 'Unable to update referral.', 'error');
      throw err;
    } finally {
      setActionBusy(false);
    }
  };

  // Super Admin Role Mutation with Last Super Admin Protection
  const handleRoleChange = async (targetUser, newRoleVal, reason) => {
    if (!isSuperAdmin) {
      showToast('Permission denied. Super Admin role required.', 'error');
      return;
    }
    if (targetUser.id === user.uid) {
      showToast('You cannot modify your own administrative role.', 'error');
      return;
    }
    // LAST SUPER ADMIN CHECK
    if (targetUser.role === 'SUPER_ADMIN' && newRoleVal !== 'SUPER_ADMIN') {
      const activeSuperAdmins = usersList.filter(u => u.role === 'SUPER_ADMIN');
      if (activeSuperAdmins.length <= 1) {
        showToast('CRITICAL SAFETY: Cannot demote the platform’s last Super Admin account.', 'error');
        return;
      }
    }

    setActionBusy(true);
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await updateDoc(userRef, {
        role: newRoleVal,
        platformRole: newRoleVal,
        updatedAt: serverTimestamp()
      });

      await logAudit('ROLE_CHANGED', 'User Authorization Role', targetUser.id, { previousRole: targetUser.role, newRole: newRoleVal }, reason);
      await recordActivity('Role Privilege Modified', `${targetUser.email} role changed to ${newRoleVal}`, 'authorization', targetUser.id);

      showToast(`User role updated to ${newRoleVal}.`);
      setActionModal(null);
      setSelectedItem(null);
      setActionReason('');
    } catch (err) {
      showToast(err.message || 'Failed to change role.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Save Platform Config (Super Admin Only)
  const handleSavePlatformConfig = async newConfig => {
    if (!isSuperAdmin) return;
    setActionBusy(true);
    try {
      await setDoc(doc(db, 'system_settings', 'config'), {
        ...newConfig,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });

      setPlatformConfig(newConfig);
      await logAudit('SETTING_CHANGED', 'Platform Configuration', 'system_settings/config', newConfig);
      showToast('Platform business settings saved successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Toggle Feature Flag (Super Admin Only)
  const handleToggleFeatureFlag = async (flagKey, nextVal) => {
    if (!isSuperAdmin) return;
    try {
      const updated = { ...featureFlags, [flagKey]: nextVal };
      await setDoc(doc(db, 'system_settings', 'feature_flags'), {
        [flagKey]: nextVal,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      }, { merge: true });

      setFeatureFlags(updated);
      await logAudit('FEATURE_FLAG_TOGGLED', 'System Feature Flags', flagKey, { flag: flagKey, enabled: nextVal });
      showToast(`Feature flag "${flagKey}" set to ${nextVal ? 'ENABLED' : 'DISABLED'}.`);
    } catch (err) {
      showToast(err.message || 'Failed to update feature flag.', 'error');
    }
  };

  // Create Brokerage
  const handleCreateBrokerage = async e => {
    e.preventDefault();
    const name = newBrokerage.name.trim();
    const city = newBrokerage.city.trim();
    const state = newBrokerage.state.trim();
    if (name.length < 2 || name.length > 120) { showToast('Brokerage name must be between 2 and 120 characters.', 'error'); return; }
    if (city && (city.length < 2 || city.length > 100)) { showToast('Enter a city between 2 and 100 characters.', 'error'); return; }
    if (state && !/^[A-Z]{2}$/.test(state)) { showToast('State must be a valid two-letter code, such as TX.', 'error'); return; }
    if (newBrokerage.licenseNumber.trim().length > 80) { showToast('License number must be 80 characters or fewer.', 'error'); return; }
    setActionBusy(true);
    try {
      await addDoc(collection(db, 'brokerages'), {
        name,
        city: city || 'National',
        state: state || 'US',
        licenseNumber: newBrokerage.licenseNumber.trim() || 'Registered',
        status: 'active',
        createdAt: serverTimestamp()
      });
      await logAudit('CREATE_BROKERAGE', 'Brokerages Directory', newBrokerage.name, newBrokerage);
      showToast(`Brokerage "${newBrokerage.name}" added to directory.`);
      setNewBrokerage({ name: '', city: '', state: '', licenseNumber: '' });
      setActionModal(null);
    } catch (err) {
      showToast(err.message || 'Failed to add brokerage.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Create Support Ticket
  const handleCreateSupportTicket = async e => {
    e.preventDefault();
    const subject = newSupportTicket.subject.trim();
    const message = newSupportTicket.message.trim();
    const requesterEmail = newSupportTicket.requesterEmail.trim();
    if (subject.length < 5 || subject.length > 120) { showToast('Subject must be between 5 and 120 characters.', 'error'); return; }
    if (message.length < 20 || message.length > 5000) { showToast('Details must be between 20 and 5,000 characters.', 'error'); return; }
    if (requesterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) { showToast('Enter a valid requester email address.', 'error'); return; }
    if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(newSupportTicket.priority)) { showToast('Choose a valid ticket priority.', 'error'); return; }
    setActionBusy(true);
    try {
      await addDoc(collection(db, 'support_requests'), {
        requesterEmail: requesterEmail || user.email,
        subject,
        message,
        priority: newSupportTicket.priority,
        status: 'OPEN',
        assignedAdmin: user.email,
        createdAt: serverTimestamp()
      });
      await logAudit('CREATE_SUPPORT_REQUEST', 'Support Ticket', newSupportTicket.subject, newSupportTicket);
      showToast('Support ticket logged successfully.');
      setNewSupportTicket({ requesterEmail: '', subject: '', priority: 'MEDIUM', message: '' });
      setActionModal(null);
    } catch (err) {
      showToast(err.message || 'Failed to log ticket.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Resolve Support Ticket
  const handleResolveSupport = async (ticket, resolutionText) => {
    if (!ticket?.id) return;
    setActionBusy(true);
    try {
      const ticketRef = doc(db, 'support_requests', ticket.id);
      await updateDoc(ticketRef, {
        status: 'RESOLVED',
        resolvedBy: user.email,
        resolvedAt: serverTimestamp(),
        resolution: resolutionText || 'Resolved by Platform Administrator'
      });
      await logAudit('RESOLVE_SUPPORT_REQUEST', 'Support Ticket', ticket.id, { resolution: resolutionText });
      showToast(`Ticket #${ticket.id.slice(0, 6)} marked as resolved.`);
      setActionModal(null);
      setSelectedItem(null);
    } catch (err) {
      showToast(err.message || 'Failed to resolve ticket.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Send Broadcast Dispatch
  const handleSendBroadcast = async (broadcastTitle, broadcastBody) => {
    if (!broadcastTitle?.trim() || !broadcastBody?.trim()) return;
    setActionBusy(true);
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: 'ALL',
        isBroadcast: true,
        channel: 'IN_APP',
        status: 'SENT',
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        senderEmail: user.email,
        createdAt: serverTimestamp()
      });
      await logAudit('SEND_SYSTEM_BROADCAST', 'Notifications Dispatch', 'BROADCAST', { title: broadcastTitle });
      await recordActivity('System Announcement Dispatched', `Broadcast: "${broadcastTitle}" sent to all users`, 'notifications', 'BROADCAST');
      showToast('Broadcast notification sent to all active users.');
      setActionModal(null);
      setActionReason('');
    } catch (err) {
      showToast(err.message || 'Failed to send broadcast.', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  // Generic Pagination Helper
  const paginate = items => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  const globalMatches = (() => {
    const search = globalSearch.trim().toLowerCase();
    if (search.length < 2) return [];
    return [
      ...usersList.map(item => ({ item, route: 'users', label: item.displayName || item.email || 'Professional', detail: item.email || 'User account' })),
      ...referralsList.map(item => ({ item, route: 'referrals', label: item.title || 'Referral', detail: [item.city, item.state].filter(Boolean).join(', ') || 'Referral opportunity' })),
      ...applicationsList.map(item => ({ item, route: 'applications', label: item.applicantName || item.referralTitle || 'Application', detail: item.referralTitle || 'Referral application' })),
      ...agreementsList.map(item => ({ item, route: 'agreements', label: item.referralTitle || 'Agreement', detail: item.status || 'Referral agreement' })),
    ].filter(result => `${result.label} ${result.detail}`.toLowerCase().includes(search)).slice(0, 7);
  })();
  const openGlobalMatch = result => { navigate(result.route); setSelectedItem(result.item); };

  return (
    <div className={`adminExperienceWrapper adminReferenceTheme ${isSuperAdmin ? 'isSuperAdmin' : ''} ${sidebarExpanded ? '' : 'sidebarCollapsed'}`}>
      {/* Dreamy Ambient Background Glows */}
      <div className="adminAmbientGlow glow1" aria-hidden="true" />
      <div className="adminAmbientGlow glow2" aria-hidden="true" />
      {/* Real-time Toast Notifications */}
      {toastMessage && (
        <div className={`adminToast ${toastMessage.type === 'error' ? 'error' : 'success'}`}>
          {toastMessage.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)}><X size={14} /></button>
        </div>
      )}

      {/* ===================================================
          1. SUPER ADMIN SIDEBAR NAVIGATION
          =================================================== */}
      {mobileMenuOpen && <button className="consoleNavScrim" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}/>}
      {/* ===================================================
          1. FAR-LEFT MINI RAIL (FLOATING PILL COLUMN)
          =================================================== */}
      <aside className="adminMiniRail" aria-label="Quick Rail Navigation">
        {/* Top Profile Avatar */}
        <div className="railAvatarWrapper" onClick={() => setShowProfileModal(true)} title={`${isSuperAdmin ? 'Super Admin' : 'Administrator'}: ${adminName}`}>
          <div className="railAvatar" style={{ display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #dbeafe, #bfdbfe)', color: '#1e40af', fontWeight: 700, fontSize: 13 }}>
            {adminInitials}
          </div>
            <button className="railAvatarChevron" aria-label={window.innerWidth <= 900 ? (mobileMenuOpen ? 'Close navigation' : 'Open navigation') : (sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar')} title={window.innerWidth <= 900 ? (mobileMenuOpen ? 'Close navigation' : 'Open navigation') : (sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar')} onClick={(e) => { e.stopPropagation(); if (window.innerWidth <= 900) setMobileMenuOpen(value => !value); else setSidebarExpanded(value => !value); }}>
              {(window.innerWidth <= 900 ? mobileMenuOpen : sidebarExpanded) ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
          </button>
        </div>

        {/* MAIN Group */}
        <span className="railSectionLabel">MAIN</span>
        <div className="railNavGroup">
          {[
            { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: 'users', label: 'Team', icon: Users, badge: metrics.totalUsers },
            { path: 'calendar', label: 'Calendar', icon: CalendarDays },
            { path: 'reports', label: 'Analytics', icon: BarChart3 },
            { path: 'verification', label: 'Verification', icon: ShieldCheck, badge: metrics.pendingVerification, alert: true },
            { path: 'referrals', label: 'All Cases / Referrals', icon: FileSpreadsheet },
            { path: 'applications', label: 'Applications', icon: FileCheck },
            { path: 'agreements', label: 'Agreements', icon: FileText },
            { path: 'system-health', label: 'System Health', icon: Zap },
            { path: 'settings', label: 'Settings', icon: Settings }
          ].map(({ path, label, icon: Icon, badge, alert }) => (
            <button key={path} className={`railBtn ${currentPath === path ? 'active' : ''}`} onClick={() => navigate(path)} title={label} aria-label={label}>
              <Icon size={19} />
              {badge > 0 && <span className={`railCount ${alert ? 'alert' : ''}`}>{badge > 99 ? '99+' : badge}</span>}
            </button>
          ))}
        </div>
      </aside>

      {/* ===================================================
          2. SUB-NAVIGATION SIDEBAR
          =================================================== */}
      <aside className={`adminSubNav ${mobileMenuOpen ? 'mobileOpen' : ''}`}>
        <button className="referenceNavClose" aria-label="Close navigation" onClick={() => setMobileMenuOpen(false)}><X size={18}/></button>
        {/* Brand Logo: 3 Blue Slanted Capsules */}
        <button className="adminBrandMark" onClick={() => navigate('dashboard')} aria-label="AgentReferrals dashboard">
          <img src="/agentreferrals-logo.svg" alt="AgentReferrals" />
        </button>

        {/* MAIN Menu */}
        <div className="subNavSection">
          <div className="subNavSectionTitle">MAIN</div>

          {/* Dashboard Item with Sub-Tree */}
          <div>
            <button
              className={`navItemButton ${currentPath === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('dashboard')}
            >
              <span className="navItemIcon"><LayoutDashboard size={18} /></span>
              <span>Dashboard</span>
              <span className="navItemChevron open"><ChevronDown size={14} /></span>
            </button>

          </div>
        </div>

        {/* ADMIN CONTROL MODULES */}
        <div className="subNavSection">
          <div className="subNavSectionTitle">ADMIN MODULES</div>

          <button className={`navItemButton ${currentPath === 'users' ? 'active' : ''}`} onClick={() => navigate('users')}>
            <span className="navItemIcon"><Users size={17} /></span>
            <span>Team / Users & Agents</span>
            {metrics.totalUsers > 0 && <span className="navBadgeGray">{metrics.totalUsers}</span>}
          </button>

          <button className={`navItemButton ${currentPath === 'calendar' ? 'active' : ''}`} onClick={() => navigate('calendar')}>
            <span className="navItemIcon"><CalendarDays size={17} /></span><span>Calendar</span>
          </button>

          <button className={`navItemButton ${currentPath === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}>
            <span className="navItemIcon"><BarChart3 size={17} /></span><span>Analytics</span>
          </button>

          <button className={`navItemButton ${currentPath === 'verification' ? 'active' : ''}`} onClick={() => navigate('verification')}>
            <span className="navItemIcon"><ShieldCheck size={17} /></span>
            <span>Verification</span>
            {metrics.pendingVerification > 0 && <span className="navBadgeRed">{metrics.pendingVerification}</span>}
          </button>

          <button className={`navItemButton ${currentPath === 'referrals' ? 'active' : ''}`} onClick={() => navigate('referrals')}>
            <span className="navItemIcon"><FileSpreadsheet size={17} /></span>
            <span>All Cases / Referrals</span>
          </button>

          <button className={`navItemButton ${currentPath === 'applications' ? 'active' : ''}`} onClick={() => navigate('applications')}>
            <span className="navItemIcon"><FileCheck size={17} /></span>
            <span>Applications</span>
            {metrics.pendingApplications > 0 && <span className="navBadgeGray">{metrics.pendingApplications}</span>}
          </button>

          <button className={`navItemButton ${currentPath === 'agreements' ? 'active' : ''}`} onClick={() => navigate('agreements')}>
            <span className="navItemIcon"><FileText size={17} /></span>
            <span>Agreements</span>
          </button>

          <button className={`navItemButton ${currentPath === 'system-health' ? 'active' : ''}`} onClick={() => navigate('system-health')}>
            <span className="navItemIcon"><Zap size={17} /></span>
            <span>System Health</span>
          </button>

          <button className={`navItemButton ${currentPath === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
            <span className="navItemIcon"><Settings size={17} /></span>
            <span>Settings</span>
          </button>

          <button className={`navItemButton ${currentPath === 'help' || currentPath === 'support' ? 'active' : ''}`} onClick={() => navigate('help')}>
            <span className="navItemIcon"><HelpCircle size={17} /></span><span>Help & Support</span>
          </button>
        </div>

        {/* User Identity Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setShowProfileModal(true)}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1b74e4', color: '#fff', fontSize: 11, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
              {adminInitials}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <b style={{ fontSize: 12, color: '#0f172a' }}>{adminName}</b>
              <span style={{ fontSize: 10, color: '#64748b' }}>{isSuperAdmin ? 'Super Admin' : 'Administrator'}</span>
            </div>
          </div>
          <button onClick={onLogout} title="Sign out" style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 4 }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ===================================================
          2. MAIN HEADER & GLOBAL SEARCH
          =================================================== */}
      <main className="adminMainCanvas">
        {/* Top Capsule Search Bar */}
        <div className="adminTopSearchBar referenceHeader">
          <button className="referenceBrand" onClick={() => navigate('dashboard')} aria-label="AgentReferrals home"><BlueCapsuleLogo size={29}/><span>Agent<b>Referrals</b></span></button>
          <label className="referenceSearch"><Search size={14} />
          <input
            id="admin-console-search"
            aria-label="Search the platform"
            type="text"
            placeholder="Search..."
            value={globalSearch}
            onChange={e => {
              setGlobalSearch(e.target.value);
              setCurrentPage(1);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && globalMatches[0]) openGlobalMatch(globalMatches[0]);
              if (e.key === 'Escape') setGlobalSearch('');
            }}
          />
          </label>
          {globalSearch && (
            <button
              onClick={() => setGlobalSearch('')}
              style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              <X size={15} />
            </button>
          )}
          <div className="topBarActions">
            <button className="referenceIcon" aria-label="Open notifications" onClick={() => setShowNotificationModal(true)}><Bell size={16}/></button>
            <button className="referenceIcon" aria-label="Help and support" onClick={() => navigate('help')}><HelpCircle size={16}/></button>
            <button className="referenceProfile" onClick={() => setShowProfileModal(true)}><span>{adminInitials}</span><div><b>{adminName}</b><small>{isSuperAdmin ? 'Super Admin' : 'Administrator'}</small></div></button>
            <button className="referenceIcon referenceMenu" aria-label="Open all navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(value => !value)}><Menu size={17}/></button>
          </div>
        </div>

        {/* Global Live Search Results Dropdown */}
        {globalSearch.trim().length >= 2 && (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              padding: 12,
              marginTop: -10,
              zIndex: 50
            }}
          >
            {globalMatches.length ? (
              globalMatches.map(result => (
                <button
                  key={`${result.route}-${result.item.id}`}
                  onClick={() => openGlobalMatch(result)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 10,
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <b style={{ fontSize: 13, color: '#0f172a', display: 'block' }}>{result.label}</b>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>{result.detail}</span>
                  </div>
                  <span style={{ fontSize: 11, background: '#eff6ff', color: '#1b74e4', padding: '3px 8px', borderRadius: 8, fontWeight: 600 }}>
                    {result.route}
                  </span>
                </button>
              ))
            ) : (
              <div style={{ padding: 14, fontSize: 13, color: '#64748b', textAlign: 'center' }}>
                No matching records found.
              </div>
            )}
          </div>
        )}

        {/* ===================================================
            3. CONTENT MODULE ROUTING
            =================================================== */}
        <div className="adminContent">
          {currentPath === 'calendar' && <AdminCalendar applications={applicationsList} referrals={referralsList} agreements={agreementsList} onNavigate={(path, id) => { if (path === 'applications' && id) setReferralApplicationsFilter(applicationsList.find(item => item.id === id)?.referralId || null); navigate(path); }} />}
          {currentPath === 'dashboard' && (
          <AdminDashboard
            adminName={adminName}
            loading={referralsLoading}
            error={referralsError}
            onRetry={() => setReferralRetry(value => value + 1)}
            isSuperAdmin={isSuperAdmin}
            metrics={metrics}
            users={platformUsersList}
            referrals={referralsList}
            applications={applicationsList}
            agreements={agreementsList}
            support={supportList}
            activity={activityList}
            audit={auditLogsList}
            onNavigate={navigate}
            onOpenRecord={(path, item) => { navigate(path); setSelectedItem(item); }}
          />
        )}

          {/* ---------------------------------------------------
              ROUTE: /admin/users (USER MANAGEMENT)
              --------------------------------------------------- */}
          {currentPath === 'users' && <AdminUsers
            users={platformUsersList}
            referrals={referralsList}
            applications={applicationsList}
            activity={activityList}
            currentUserId={user.uid}
            isSuperAdmin={isSuperAdmin}
            onAction={setActionModal}
          />}
          {/* ---------------------------------------------------
              ROUTE: /admin/professionals (PROFESSIONALS DIRECTORY)
              --------------------------------------------------- */}
          {currentPath === 'professionals' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Real Estate Professionals</h1>
                  <p>Operational directory of real estate agents, verified credentials, and activity metrics.</p>
                </div>
                <div className="adminHeaderActions">
                  <span className="countIndicator">Active Agents: <b>{metrics.activeProfessionals}</b></span>
                </div>
              </div>

              {isSuperAdmin && <details className="adminTableCard" style={{ marginBottom: 20 }}>
                <summary style={{ cursor: 'pointer', padding: '18px 22px', fontWeight: 700 }}>
                  Versioned legal template · {agreementTemplate.status === 'DRAFT' ? `Draft v${agreementTemplate.version || ''}` : agreementTemplate.version ? `Published v${agreementTemplate.version}` : 'No published version'}
                </summary>
                <div style={{ padding: '0 22px 22px' }}>
                  <p>Only publish language approved for your business and jurisdictions. Draft agreements keep the exact version used; edits here only affect new agreements.</p>
                  <label className="adminFormLabel">Template name</label>
                  <input className="adminSearchInput" value={agreementTemplate.name} maxLength={120} onChange={e => setAgreementTemplate(prev => ({ ...prev, name: e.target.value }))} />
                  <label className="adminFormLabel" style={{ display: 'block', marginTop: 12 }}>Privacy policy version</label>
                  <input className="adminSearchInput" value={agreementTemplate.privacyPolicyVersion || ''} maxLength={40} placeholder="e.g. 2026.09" onChange={e => setAgreementTemplate(prev => ({ ...prev, privacyPolicyVersion: e.target.value }))} />
                  <label className="adminFormLabel" style={{ display: 'block', marginTop: 12 }}>Privacy policy HTTPS URL</label>
                  <input className="adminSearchInput" type="url" value={agreementTemplate.privacyPolicyUrl || ''} placeholder="https://…" onChange={e => setAgreementTemplate(prev => ({ ...prev, privacyPolicyUrl: e.target.value }))} />
                  <label className="adminFormLabel" style={{ display: 'block', marginTop: 12 }}>Terms of Service version and URL</label>
                  <input className="adminSearchInput" value={agreementTemplate.termsOfServiceVersion || ''} maxLength={40} placeholder="current" onChange={e => setAgreementTemplate(prev => ({ ...prev, termsOfServiceVersion: e.target.value }))} />
                  <input className="adminSearchInput" style={{ marginTop: 8 }} type="url" value={agreementTemplate.termsOfServiceUrl || ''} placeholder="https://…" onChange={e => setAgreementTemplate(prev => ({ ...prev, termsOfServiceUrl: e.target.value }))} />
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}><input type="checkbox" checked={agreementTemplate.captureSignerIp === true} onChange={e => setAgreementTemplate(prev => ({ ...prev, captureSignerIp: e.target.checked }))} /> Capture signer IP address in the audit record (enable only when appropriate for your policy and jurisdictions).</label>
                  <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                    {(agreementTemplate.sections || []).map((section, index) => <div key={section.id || index} className="adminTableCard" style={{ padding: 14 }}>
                      <label className="adminFormLabel">Section {index + 1} title</label>
                      <input className="adminSearchInput" value={section.title || ''} maxLength={160} onChange={e => setAgreementTemplate(prev => ({ ...prev, sections: prev.sections.map((item, i) => i === index ? { ...item, title: e.target.value } : item) }))} />
                      <label className="adminFormLabel" style={{ display: 'block', marginTop: 10 }}>Approved legal text</label>
                      <textarea className="adminSearchInput" rows={4} maxLength={12000} value={section.body || ''} onChange={e => setAgreementTemplate(prev => ({ ...prev, sections: prev.sections.map((item, i) => i === index ? { ...item, body: e.target.value } : item) }))} />
                      <button className="adminSecondaryBtn" style={{ marginTop: 8 }} onClick={() => setAgreementTemplate(prev => ({ ...prev, sections: prev.sections.filter((_, i) => i !== index) }))}>Remove section</button>
                    </div>)}
                  </div>
                  <div className="adminHeaderActions" style={{ justifyContent: 'space-between', marginTop: 14 }}>
                    <button className="adminSecondaryBtn" disabled={(agreementTemplate.sections || []).length >= 24} onClick={() => setAgreementTemplate(prev => ({ ...prev, sections: [...(prev.sections || []), { id: `section-${Date.now()}`, title: '', body: '' }] }))}><Plus size={14} /> Add section</button>
                    <div className="adminHeaderActions">
                      <button className="adminSecondaryBtn" disabled={agreementTemplateBusy} onClick={() => saveAgreementTemplate('SAVE_DRAFT')}>{agreementTemplateBusy ? 'Saving…' : 'Save draft'}</button>
                      <button className="adminPrimaryBtn" disabled={agreementTemplateBusy || !(agreementTemplate.sections || []).length || agreementTemplate.sections.some(section => !section.title?.trim() || !section.body?.trim()) || !agreementTemplate.privacyPolicyUrl?.trim() || !agreementTemplate.termsOfServiceUrl?.trim()} onClick={() => saveAgreementTemplate('PUBLISH')}>{agreementTemplateBusy ? 'Publishing…' : 'Publish new version'}</button>
                    </div>
                  </div>
                </div>
              </details>}

              <div className="adminTableCard">
                <div className="tableControls">
                  <div className="filterGroup">
                    <label><Filter size={14} /> Verification:</label>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                      <option value="ALL">All Statuses</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="searchBox">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search professional name, license #..."
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Professional</th>
                        <th>License & State</th>
                        <th>Brokerage</th>
                        <th>Primary Market</th>
                        <th>Verification</th>
                        <th>Referrals Posted</th>
                        <th>Applications</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformUsersList
                        .filter(u => u.role === 'PROFESSIONAL' || !u.role)
                        .filter(u => filterStatus === 'ALL' || (u.verificationStatus || 'pending') === filterStatus)
                        .filter(u => {
                          if (!globalSearch) return true;
                          const q = globalSearch.toLowerCase();
                          return u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.licenseNumber?.toLowerCase().includes(q);
                        })
                        .map(u => {
                          const refCount = referralsList.filter(r => r.creatorProfessionalId === u.id).length;
                          const appCount = applicationsList.filter(a => a.applicantProfessionalId === u.id).length;
                          return (
                            <tr key={u.id}>
                              <td>
                                <div className="userCell">
                                  <div className="userAvatarSmall">{(u.displayName || u.email || 'P')[0].toUpperCase()}</div>
                                  <div>
                                    <b>{u.displayName || 'New Agent'}</b>
                                    <small>{u.email}</small>
                                  </div>
                                </div>
                              </td>
                              <td>{u.licenseNumber ? `${u.licenseNumber} (${u.licenseState || '—'})` : '—'}</td>
                              <td>{u.brokerageName || 'Independent'}</td>
                              <td>{u.primaryMarket || u.city || '—'}</td>
                              <td>
                                <span className={`verifyPill ${u.verificationStatus || 'pending'}`}>
                                  {u.verificationStatus || 'pending'}
                                </span>
                              </td>
                              <td><b>{refCount}</b></td>
                              <td><b>{appCount}</b></td>
                              <td>
                                <button className="rowActionBtn" onClick={() => setSelectedItem(u)}>
                                  <Eye size={14} /> Full Profile
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/verification (VERIFICATION CENTER)
              --------------------------------------------------- */}
          {currentPath === 'verification' && <AdminVerification users={platformUsersList} activity={activityList} role={role} onOpen={item => { setSelectedItem(item); setSelectedDrawerTab('verification'); }} />}

          {/* ---------------------------------------------------
              ROUTE: /admin/brokerages (BROKERAGES DIRECTORY)
              --------------------------------------------------- */}
          {currentPath === 'brokerages' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Brokerages Directory</h1>
                  <p>Registered real estate companies, corporate entities, and office affiliations.</p>
                </div>
                <div className="adminHeaderActions">
                  <button
                    className="adminPrimaryBtn"
                    onClick={() => setActionModal({ type: 'ADD_BROKERAGE', label: 'Add Registered Brokerage' })}
                  >
                    <Plus size={15} /> Add Brokerage
                  </button>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Brokerage Name</th>
                        <th>City / State</th>
                        <th>Registration / License</th>
                        <th>Associated Agents</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokeragesList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>
                            No brokerage records in directory. Click "Add Brokerage" to register one.
                          </td>
                        </tr>
                      ) : (
                        brokeragesList.map(b => (
                          <tr key={b.id}>
                            <td>
                              <div className="userCell">
                                <Building2 size={16} color="#0284c7" />
                                <b>{b.name}</b>
                              </div>
                            </td>
                            <td>{b.city}, {b.state}</td>
                            <td><code>{b.licenseNumber || 'Registered'}</code></td>
                            <td><b>{platformUsersList.filter(u => u.brokerageName === b.name).length}</b> agents</td>
                            <td><span className="statusPill active">{b.status || 'Active'}</span></td>
                            <td>
                              <button className="rowActionBtn" onClick={() => setSelectedItem(b)}>
                                <Eye size={14} /> Details
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/referrals (LIVE REFERRAL OPERATIONS)
              --------------------------------------------------- */}
          {currentPath === 'referrals' && (
            <AdminReferralManagement
              referrals={referralsList}
              applications={applicationsList}
              agreements={agreementsList}
              users={usersList}
              activity={activityList}
              loading={referralsLoading}
              error={referralsError}
              onRetry={() => setReferralRetry(value => value + 1)}
              onMutate={handleReferralAdminMutation}
              onNavigate={(path, id) => {
                if (path === 'applications') setReferralApplicationsFilter(id);
                if (path === 'professionals') {
                  const person = usersList.find(item => item.id === id);
                  navigate('professionals');
                  if (person) setTimeout(() => setSelectedItem(person), 0);
                  return;
                }
                navigate(path);
              }}
              isSuperAdmin={isSuperAdmin}
              role={role}
            />
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/applications (APPLICATIONS MONITORING)
              --------------------------------------------------- */}
          {currentPath === 'applications' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Application Monitoring</h1>
                  <p>Live platform review of recipient applications submitted for referral opportunities.</p>
                  {referralApplicationsFilter && (
                    <div className="referralApplicationFilter">
                      Filtered to: <b>{referralsList.find(item => item.id === referralApplicationsFilter)?.title || `REF-${referralApplicationsFilter.slice(0, 8).toUpperCase()}`}</b>
                      <button onClick={() => setReferralApplicationsFilter(null)} aria-label="Clear referral filter"><X size={14} /> Clear</button>
                    </div>
                  )}
                </div>
                <div className="adminHeaderActions">
                  <span className="countIndicator">{referralApplicationsFilter ? 'Matching Applications' : 'Total Applications'}: <b>{(referralApplicationsFilter ? applicationsList.filter(item => item.referralId === referralApplicationsFilter) : applicationsList).length}</b></span>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Application ID</th>
                        <th>Applicant</th>
                        <th>Referral Title</th>
                        <th>Referral Owner</th>
                        <th>Status</th>
                        <th>Submitted Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(referralApplicationsFilter ? applicationsList.filter(item => item.referralId === referralApplicationsFilter) : applicationsList).map(a => (
                        <tr key={a.id}>
                          <td><code>APP-{a.id.slice(0, 6).toUpperCase()}</code></td>
                          <td>
                            <b>{a.applicantName || 'Applicant'}</b>
                            <small className="cellSubtext">{a.applicantEmail}</small>
                          </td>
                          <td><b>{a.referralTitle || 'Opportunity #' + (a.referralId?.slice(0, 6) || '')}</b></td>
                          <td><code>{a.referralCreatorId?.slice(0, 8)}...</code></td>
                          <td>
                            <span className={`statusPill ${a.status?.toLowerCase()}`}>
                              {a.status || 'pending'}
                            </span>
                          </td>
                          <td>{fmtDate(a.createdAt)}</td>
                          <td>
                            <button className="rowActionBtn" onClick={() => { setSelectedDrawerTab('overview'); setSelectedItem(a); }}>
                              <Eye size={14} /> View Pitch
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/agreements (AGREEMENTS MANAGEMENT)
              --------------------------------------------------- */}
          {currentPath === 'agreements' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Referral Agreements</h1>
                  <p>Legal referral agreements executed between verified professionals. Signed agreements are immutable.</p>
                </div>
                <div className="adminHeaderActions">
                  <span className="countIndicator">Active / completed: <b>{agreementsList.filter(item => ['ACTIVE', 'COMPLETED'].includes(String(item.status).toUpperCase())).length}</b></span>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Agreement #</th>
                        <th>Referral Title</th>
                        <th>Referring Agent</th>
                        <th>Receiving Agent</th>
                        <th>Fee %</th>
                        <th>Status</th>
                        <th>Signed Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreementsList.map(ag => (
                        <tr key={ag.id}>
                          <td><code>{ag.agreementNumber || `AGR-${ag.id.slice(0, 6).toUpperCase()}`}</code></td>
                          <td><b>{ag.referralSnapshot?.title || ag.referralTitle || 'Referral Agreement'}</b><small>{ag.agreementTemplateVersion ? `Terms v${ag.agreementTemplateVersion}` : 'Template missing'}</small></td>
                          <td>{ag.referringName || 'Referring Agent'}</td>
                          <td>{ag.receivingName || 'Receiving Agent'}</td>
                          <td><b>{ag.referralSnapshot?.referralFee?.percent ?? ag.feePercent ?? '—'}{ag.referralSnapshot?.referralFee?.percent ?? ag.feePercent ? '%' : ''}</b></td>
                          <td>
                            <span className={`statusPill ${ag.status?.toLowerCase() || 'active'}`}>
                              {ag.status || '—'}
                            </span>
                          </td>
                          <td>{fmtDate(ag.activatedAt || ag.createdAt)}</td>
                          <td>
                            <button className="rowActionBtn" onClick={() => setSelectedItem(ag)}>
                              <Eye size={14} /> View Contract
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/notifications (NOTIFICATIONS DISPATCH)
              --------------------------------------------------- */}
          {currentPath === 'notifications' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Notifications Dispatch</h1>
                  <p>System announcements, verification updates, and direct platform alerts.</p>
                </div>
                <div className="adminHeaderActions">
                  <button
                    className="adminPrimaryBtn"
                    onClick={() => setActionModal({ type: 'SEND_BROADCAST', label: 'Dispatch System Broadcast' })}
                  >
                    <Send size={15} /> Send Broadcast
                  </button>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Message Preview</th>
                        <th>Recipient</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Sent Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notificationsList.map(n => (
                        <tr key={n.id}>
                          <td><b>{n.title}</b></td>
                          <td>{n.body}</td>
                          <td><code>{n.userId === 'ALL' ? 'ALL USERS (BROADCAST)' : (n.userId?.slice(0, 10) + '...')}</code></td>
                          <td>{n.isBroadcast ? <span className="categoryBadge">Broadcast</span> : 'Direct'}</td>
                          <td><span className="statusPill active">{n.status || 'DELIVERED'}</span></td>
                          <td>{fmtDate(n.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/support (SUPPORT & TICKETS)
              --------------------------------------------------- */}
          {currentPath === 'support' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Support & Inquiries</h1>
                  <p>Member assistance, transaction help, license questions, and platform escalations.</p>
                </div>
                <div className="adminHeaderActions">
                  <button
                    className="adminPrimaryBtn"
                    onClick={() => setActionModal({ type: 'CREATE_SUPPORT', label: 'Log Support Ticket' })}
                  >
                    <Plus size={15} /> Create Ticket
                  </button>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Ticket ID</th>
                        <th>Subject</th>
                        <th>Requester</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th>Resolution</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supportList.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: 'center', padding: '30px' }}>
                            No support tickets currently open. Click "Create Ticket" to record an inquiry.
                          </td>
                        </tr>
                      ) : (
                        supportList.map(s => (
                          <tr key={s.id}>
                            <td><code>TCK-{s.id.slice(0, 6).toUpperCase()}</code></td>
                            <td><b>{s.subject || 'Support Ticket'}</b></td>
                            <td>{s.requesterEmail || s.userId}</td>
                            <td><span className={`statusPill ${s.priority === 'HIGH' || s.priority === 'URGENT' ? 'alert' : 'active'}`}>{s.priority || 'MEDIUM'}</span></td>
                            <td>
                              <span className={`statusPill ${s.status === 'RESOLVED' || s.status === 'resolved' ? 'active' : 'alert'}`}>
                                {s.status || 'OPEN'}
                              </span>
                            </td>
                            <td>{fmtDate(s.createdAt)}</td>
                            <td>{s.resolution || '—'}</td>
                            <td>
                              {s.status !== 'RESOLVED' && s.status !== 'resolved' ? (
                                <button
                                  className="adminSmallActionBtn approve"
                                  onClick={() => setActionModal({ type: 'RESOLVE_SUPPORT', target: s, label: 'Resolve Support Ticket' })}
                                >
                                  Resolve
                                </button>
                              ) : (
                                <span className="verifyPill approved">Resolved</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/reports (REAL-TIME AGGREGATE REPORTS)
              --------------------------------------------------- */}
          {currentPath === 'reports' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Platform Reports & Analytics</h1>
                  <p>Aggregate business intelligence calculated directly from live database transactions.</p>
                </div>
                <div className="adminHeaderActions">
                  <select value={reportTimeframe} onChange={e => setReportTimeframe(e.target.value)} className="timeframeSelect">
                    <option value="ALL">All Time Data</option>
                    <option value="30">Last 30 Days</option>
                    <option value="7">Last 7 Days</option>
                  </select>
                </div>
              </div>

              <div className="adminMetricsGrid">
                <div className="adminMetricCard">
                  <span>TOTAL PLATFORM USERS</span>
                  <strong>{metrics.totalUsers}</strong>
                  <small>Excludes internal administrative accounts</small>
                </div>
                <div className="adminMetricCard">
                  <span>LICENSE VERIFICATION RATE</span>
                  <strong>{platformUsersList.length > 0 ? `${Math.round((platformUsersList.filter(u => u.verificationStatus === 'approved').length / platformUsersList.length) * 100)}%` : '0%'}</strong>
                  <small>Approved professional accounts</small>
                </div>
                <div className="adminMetricCard">
                  <span>APPLICATION ACCEPTANCE RATE</span>
                  <strong>{applicationsList.length > 0 ? `${Math.round((applicationsList.filter(a => a.status === 'ACCEPTED' || a.status === 'accepted').length / applicationsList.length) * 100)}%` : '0%'}</strong>
                  <small>Accepted / Total applications</small>
                </div>
                <div className="adminMetricCard">
                  <span>ACTIVE ESCROW PIPELINE</span>
                  <strong>{metrics.activeAgreements}</strong>
                  <small>Binding agreements active</small>
                </div>
              </div>

              <div className="adminTwoColGrid">
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>User Roles Breakdown</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="reportBreakdownRow">
                      <span>Professionals (Agents):</span>
                      <b>{platformUsersList.filter(u => u.role === 'PROFESSIONAL' || !u.role).length}</b>
                    </div>
                    <div className="reportBreakdownRow">
                      <span>Platform Administrators:</span>
                      <b>{adminUsersList.filter(u => u.role === 'ADMIN').length}</b>
                    </div>
                    <div className="reportBreakdownRow">
                      <span>Super Administrators:</span>
                      <b>{adminUsersList.filter(u => u.role === 'SUPER_ADMIN').length}</b>
                    </div>
                  </div>
                </div>

                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Referrals by Status</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="reportBreakdownRow">
                      <span>Published / Open:</span>
                      <b>{referralsList.filter(r => ['open', 'published', 'active'].includes(r.status?.toLowerCase())).length}</b>
                    </div>
                    <div className="reportBreakdownRow">
                      <span>Completed / Closed:</span>
                      <b>{referralsList.filter(r => ['completed', 'closed'].includes(r.status?.toLowerCase())).length}</b>
                    </div>
                    <div className="reportBreakdownRow">
                      <span>Flagged / Paused / Cancelled:</span>
                      <b>{referralsList.filter(r => ['flagged', 'paused', 'cancelled'].includes(r.status?.toLowerCase())).length}</b>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/activity (ACTIVITY STREAM)
              --------------------------------------------------- */}
          {currentPath === 'activity' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Live Activity Stream</h1>
                  <p>Real-time platform business activity across referral creation, applications, and verification events.</p>
                </div>
              </div>

              <div className="adminCard">
                <div className="adminCardBody">
                  {activityList.length === 0 ? (
                    <div className="adminEmptyState">
                      <ActivityIcon size={32} color="#94a3b8" />
                      <b>No activity recorded yet</b>
                      <p>Platform events will stream here as users interact.</p>
                    </div>
                  ) : (
                    <div className="adminActivityList">
                      {activityList.map(item => (
                        <div className="activityRow" key={item.id}>
                          <div className="activityDot" />
                          <div className="activityMain">
                            <b>{item.title || item.type || 'Platform Event'}</b>
                            <p>{item.description || item.body || ''}</p>
                            <small>{fmtDate(item.createdAt)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/audit-logs (AUDIT LOGS)
              --------------------------------------------------- */}
          {currentPath === 'audit-logs' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Platform Audit Trail</h1>
                  <p>Immutable, read-only compliance logging of all administrative actions and security mutations.</p>
                </div>
                <div className="adminHeaderActions">
                  <span className="countIndicator">Total Audit Logs: <b>{auditLogsList.length}</b></span>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableControls">
                  <div className="searchBox">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search actor email, action, resource..."
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Actor</th>
                        <th>Role</th>
                        <th>Action</th>
                        <th>Resource</th>
                        <th>Resource ID</th>
                        <th>Result</th>
                        <th>Reason / Justification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogsList
                        .filter(l => {
                          if (!globalSearch) return true;
                          const q = globalSearch.toLowerCase();
                          return l.actorEmail?.toLowerCase().includes(q) || l.action?.toLowerCase().includes(q) || l.resource?.toLowerCase().includes(q);
                        })
                        .map(log => (
                          <tr key={log.id}>
                            <td>{fmtDate(log.createdAt)}</td>
                            <td><b>{log.actorEmail || 'System'}</b></td>
                            <td><span className="roleTagSmall">{log.actorRole || 'ADMIN'}</span></td>
                            <td><span className="actionBadge">{log.action}</span></td>
                            <td>{log.resource}</td>
                            <td><code>{log.resourceId?.slice(0, 10)}...</code></td>
                            <td><span className="statusPill active">{log.result || 'SUCCESS'}</span></td>
                            <td>{log.reason || '—'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/system-health (SYSTEM HEALTH DIAGNOSTICS)
              --------------------------------------------------- */}
          {currentPath === 'system-health' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>System Health & Diagnostics</h1>
                  <p>On-demand checks for Firestore and Firebase Auth. Other service probes are not configured.</p>
                </div>
                <div className="adminHeaderActions">
                  <button className="adminPrimaryBtn" onClick={runHealthCheck} disabled={healthStatus.checking}>
                    <RefreshCw size={15} className={healthStatus.checking ? 'spin' : ''} />
                    {healthStatus.checking ? 'Running Probes...' : 'Run Diagnostics'}
                  </button>
                </div>
              </div>

              <div className="adminCard">
                <div className="adminCardHeader">
                  <h3>Backend Service Probes</h3>
                  <small>Last probe check: {fmtTimeOnly(healthStatus.database.lastChecked)}</small>
                </div>
                <div className="healthGrid">
                  <div className="healthItem">
                    <Database size={18} />
                    <div>
                      <b>Cloud Firestore</b>
                      <small>{healthStatus.database.latencyMs == null ? 'Not checked' : `Latency: ${healthStatus.database.latencyMs}ms`}</small>
                    </div>
                    <span className="healthStatusTag online">● {healthStatus.database.status}</span>
                  </div>
                  <div className="healthItem">
                    <Lock size={18} />
                    <div>
                      <b>Firebase Auth & Security Rules</b>
                      <small>{healthStatus.auth.latencyMs == null ? 'Not checked' : `Latency: ${healthStatus.auth.latencyMs}ms`}</small>
                    </div>
                    <span className="healthStatusTag online">● {healthStatus.auth.status}</span>
                  </div>
                  <div className="healthItem">
                    <Server size={18} />
                    <div>
                      <b>Cloud Functions</b>
                      <small>Dedicated probe unavailable</small>
                    </div>
                    <span className="healthStatusTag online">● {healthStatus.functions.status}</span>
                  </div>
                  <div className="healthItem">
                    <Mail size={18} />
                    <div>
                      <b>Notification Dispatch</b>
                      <small>Dedicated probe unavailable</small>
                    </div>
                    <span className="healthStatusTag online">● {healthStatus.email.status}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/security (SECURITY CENTER)
              --------------------------------------------------- */}
          {currentPath === 'security' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Security & Compliance Center</h1>
                  <p>Privileged account actions, failed authentication logs, and security enforcement events.</p>
                </div>
              </div>

              <div className="adminCard">
                <div className="adminCardHeader">
                  <h3>Privileged Security Event Log</h3>
                </div>
                <div className="adminCardBody">
                  <div className="adminAuditStream">
                    {auditLogsList
                      .filter(l => ['ROLE_CHANGED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'SETTING_CHANGED', 'FEATURE_FLAG_TOGGLED'].includes(l.action))
                      .map(log => (
                        <div className="auditStreamItem" key={log.id}>
                          <div className="auditTime">{fmtDate(log.createdAt)}</div>
                          <div className="auditActor">
                            <b>{log.actorEmail}</b>
                            <span className="roleTagSmall">{log.actorRole}</span>
                          </div>
                          <div className="auditAction">
                            <span className="actionBadge alert">{log.action}</span>
                            <span>Target: {log.resourceId}</span>
                          </div>
                          <div className="auditReason">{log.reason}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/integrations (INTEGRATIONS)
              --------------------------------------------------- */}
          {currentPath === 'integrations' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Service Integrations</h1>
                  <p>Status of external infrastructure providers and third-party APIs (Credentials secured).</p>
                </div>
              </div>

              <div className="adminTwoColGrid">
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Authentication & Identity</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="healthItem">
                      <Lock size={17} />
                      <div>
                        <b>Firebase Email & Password Auth</b>
                        <small>Active · Token verification enabled</small>
                      </div>
                      <span className="healthStatusTag online">● Connected</span>
                    </div>
                    <div className="healthItem">
                      <Globe size={17} />
                      <div>
                        <b>Google OAuth Provider</b>
                        <small>Configured for verified domains</small>
                      </div>
                      <span className="healthStatusTag online">● Connected</span>
                    </div>
                  </div>
                </div>

                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Database & Cloud Storage</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="healthItem">
                      <Database size={17} />
                      <div>
                        <b>Cloud Firestore (us-central1)</b>
                        <small>Connected · Live real-time syncing</small>
                      </div>
                      <span className="healthStatusTag online">● Connected</span>
                    </div>
                    <div className="healthItem">
                      <Server size={17} />
                      <div>
                        <b>Cloud Storage</b>
                        <small>License document storage</small>
                      </div>
                      <span className="healthStatusTag online">● Connected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              SUPER ADMIN ROUTE: /admin/admin-users
              --------------------------------------------------- */}
          {currentPath === 'admin-users' && isSuperAdmin && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Administrator Accounts</h1>
                  <p>Manage platform operators, administrators, and super-admin credentials with Last Super Admin protection.</p>
                </div>
                <div className="adminHeaderActions">
                  <button
                    className="adminPrimaryBtn"
                    onClick={() => setActionModal({ type: 'CREATE_ADMIN', label: 'Grant Admin Privilege' })}
                  >
                    <UserPlus size={15} /> Grant Admin Privilege
                  </button>
                </div>
              </div>

              <div className="adminTableCard">
                <div className="tableContainer">
                  <table className="adminDataTable">
                    <thead>
                      <tr>
                        <th>Admin Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsersList.map(a => (
                          <tr key={a.id}>
                            <td>
                              <div className="userCell">
                                <div className="userAvatarSmall">{(a.displayName || a.email || 'A')[0].toUpperCase()}</div>
                                <b>{a.displayName || 'Administrator'}</b>
                              </div>
                            </td>
                            <td>{a.email}</td>
                            <td>
                              <span className={`roleTag ${a.role === 'SUPER_ADMIN' ? 'super' : 'admin'}`}>
                                {a.role}
                              </span>
                            </td>
                            <td>
                              <span className={`statusPill ${a.accountStatus === 'suspended' ? 'suspended' : 'active'}`}>
                                {a.accountStatus || 'active'}
                              </span>
                            </td>
                            <td>{fmtDate(a.createdAt)}</td>
                            <td>
                              <div className="actionBtnGroup">
                                <button
                                  className="rowActionBtn"
                                  disabled={a.id === user.uid}
                                  onClick={() => setActionModal({ type: 'MANAGE_ROLE', target: a, label: 'Modify Admin Role' })}
                                >
                                  Change Role
                                </button>
                                {a.id !== user.uid && (
                                  <button
                                    className="rowActionBtn suspend"
                                    onClick={() => setActionModal({ type: 'SUSPEND_USER', target: a, label: 'Suspend Administrator' })}
                                  >
                                    Suspend
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              SUPER ADMIN ROUTE: /admin/roles, /admin/permissions
              --------------------------------------------------- */}
          {(currentPath === 'roles' || currentPath === 'permissions') && isSuperAdmin && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Roles & Permissions RBAC Matrix</h1>
                  <p>Centralized role-based access definitions governing Professional, Admin, and Super Admin operations.</p>
                </div>
              </div>

              <div className="adminTwoColGrid">
                {/* Role definitions */}
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Platform Roles</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="roleMatrixItem">
                      <div className="roleHeader">
                        <b>PROFESSIONAL</b>
                        <span className="roleTag pro">PROFESSIONAL</span>
                      </div>
                      <p>Licensed real estate agent. Uses the Marketplace, posts referrals, applies, and executes contracts.</p>
                    </div>

                    <div className="roleMatrixItem">
                      <div className="roleHeader">
                        <b>ADMIN</b>
                        <span className="roleTag admin">ADMIN</span>
                      </div>
                      <p>Daily operations manager. Reviews verification, moderates referrals, monitors contracts, handles support.</p>
                      <small>{ADMIN_PERMISSIONS.length} granular operational permissions granted</small>
                    </div>

                    <div className="roleMatrixItem">
                      <div className="roleHeader">
                        <b>SUPER_ADMIN</b>
                        <span className="roleTag super">SUPER_ADMIN</span>
                      </div>
                      <p>Platform owner & governance. Controls admin users, system settings, feature flags, security, and integrations.</p>
                      <small>{SUPER_ADMIN_PERMISSIONS.length} full platform governance permissions granted</small>
                    </div>
                  </div>
                </div>

                {/* Permission Checklist */}
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Granular Permissions Active for {role}</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="permissionsGrid">
                      {rolePermissions(role).map(p => (
                        <div className="permissionPill" key={p}>
                          <Check size={13} color="#168568" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              SUPER ADMIN ROUTE: /admin/system-settings
              --------------------------------------------------- */}
          {currentPath === 'system-settings' && isSuperAdmin && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Platform Settings & Business Rules</h1>
                  <p>Configure platform-wide operational thresholds, referral policies, and verification requirements.</p>
                </div>
                <div className="adminHeaderActions">
                  <button
                    className="adminPrimaryBtn"
                    disabled={actionBusy}
                    onClick={() => handleSavePlatformConfig(platformConfig)}
                  >
                    Save Platform Settings
                  </button>
                </div>
              </div>

              <div className="adminTwoColGrid">
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>General & Marketplace Policies</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="formGroup">
                      <label>Platform Name</label>
                      <input
                        type="text"
                        value={platformConfig.platformName}
                        onChange={e => setPlatformConfig({ ...platformConfig, platformName: e.target.value })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>Default Referral Fee %</label>
                      <input
                        type="number"
                        step="0.5"
                        value={platformConfig.defaultReferralFee}
                        onChange={e => setPlatformConfig({ ...platformConfig, defaultReferralFee: parseFloat(e.target.value) || 25 })}
                      />
                    </div>
                    <div className="formGroup">
                      <label>Referral Expiration (Days)</label>
                      <input
                        type="number"
                        value={platformConfig.referralExpirationDays}
                        onChange={e => setPlatformConfig({ ...platformConfig, referralExpirationDays: parseInt(e.target.value, 10) || 60 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Compliance & Verification Rules</h3>
                  </div>
                  <div className="adminCardBody">
                    <div className="settingItem">
                      <div>
                        <b>Mandatory License Verification</b>
                        <small style={{ display: 'block', color: '#64748b' }}>Require approved license to publish referrals</small>
                      </div>
                      <button
                        className={`toggleBtn ${platformConfig.mandatoryVerificationForPublishing ? 'active' : ''}`}
                        onClick={() => setPlatformConfig({ ...platformConfig, mandatoryVerificationForPublishing: !platformConfig.mandatoryVerificationForPublishing })}
                      >
                        {platformConfig.mandatoryVerificationForPublishing ? <ToggleRight size={28} color="#0284c7" /> : <ToggleLeft size={28} color="#94a3b8" />}
                      </button>
                    </div>

                    <div className="settingItem">
                      <div>
                        <b>Platform Maintenance Mode</b>
                        <small style={{ display: 'block', color: '#64748b' }}>Restrict access for platform upgrades</small>
                      </div>
                      <button
                        className={`toggleBtn ${platformConfig.maintenanceMode ? 'active' : ''}`}
                        onClick={() => setPlatformConfig({ ...platformConfig, maintenanceMode: !platformConfig.maintenanceMode })}
                      >
                        {platformConfig.maintenanceMode ? <ToggleRight size={28} color="#dc2626" /> : <ToggleLeft size={28} color="#94a3b8" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              SUPER ADMIN ROUTE: /admin/feature-flags
              --------------------------------------------------- */}
          {currentPath === 'feature-flags' && isSuperAdmin && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Feature Flags & Release Management</h1>
                  <p>Control dynamic feature availability and staging rollouts across server and client layers.</p>
                </div>
              </div>

              <div className="adminCard">
                <div className="adminCardHeader">
                  <h3>Active Platform Feature Flags</h3>
                </div>
                <div className="adminCardBody">
                  {Object.entries(featureFlags).map(([key, isEnabled]) => (
                    <div className="settingItem" key={key}>
                      <div>
                        <b>{key.replace(/_/g, ' ').toUpperCase()}</b>
                        <small style={{ display: 'block', color: '#64748b' }}>Server-evaluated feature flag key: <code>{key}</code></small>
                      </div>
                      <button
                        className="toggleBtn"
                        onClick={() => handleToggleFeatureFlag(key, !isEnabled)}
                      >
                        {isEnabled ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700 }}>
                            <span>ENABLED</span> <ToggleRight size={32} color="#16a34a" />
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontWeight: 700 }}>
                            <span>DISABLED</span> <ToggleLeft size={32} color="#94a3b8" />
                          </div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------
              ROUTE: /admin/help (HELP & SUPPORT PROTOCOLS)
              --------------------------------------------------- */}
          {currentPath === 'help' && (
            <div className="adminView">
              <div className="adminViewHeader">
                <div>
                  <h1>Super Admin Operating Manual & SOP</h1>
                  <p>Standard operating procedures, verification guidelines, and escalation matrices.</p>
                </div>
              </div>

              <div className="adminTwoColGrid">
                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>License Verification Guidelines</h3>
                  </div>
                  <div className="adminCardBody">
                    <p>When reviewing agent license submissions:</p>
                    <ol style={{ paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                      <li>Verify the license number against the corresponding state real estate licensing commission portal.</li>
                      <li>Confirm the agent’s name matches the registered broker license record.</li>
                      <li>Ensure no disciplinary suspension is active before approving.</li>
                    </ol>
                  </div>
                </div>

                <div className="adminCard">
                  <div className="adminCardHeader">
                    <h3>Emergency Escalation Protocol</h3>
                  </div>
                  <div className="adminCardBody">
                    <p>In case of security concerns or disputed transactions:</p>
                    <ul style={{ paddingLeft: 20, color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                      <li>Flag the referral to immediately pause marketplace visibility.</li>
                      <li>Review audit log entries for exact transaction timestamps.</li>
                      <li>Contact platform security team at support@agentreferrals.org.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================
            4. ADMIN FOOTER
            =================================================== */}
        <footer className="adminFooter">
          <div className="footerLeft">
            <span className="footerBrandName">AgentReferrals</span>
            <span className="footerDivider">·</span>
            <span>Platform Administration & Control Center</span>
          </div>
          <div className="footerRight">
            <span>Environment: <b>Production</b></span>
            <span className="footerDivider">·</span>
            <span>Version: <b>2.5.0</b></span>
          </div>
        </footer>
      </main>

      {/* ===================================================
          5. RECORD INSPECTION DRAWER (WITH MULTI-TAB VIEW)
          =================================================== */}
      {selectedItem && (
        <div className="adminModalOverlay" onClick={() => setSelectedItem(null)}>
          <div className="adminDrawer" onClick={e => e.stopPropagation()}>
            <div className="drawerHeader">
              <div>
                <span className="drawerCaption">{selectedItem.applicantProfessionalId && selectedItem.referralId ? 'APPLICATION REVIEW' : 'ENTITY INSPECTOR'}</span>
                <h2>{selectedItem.applicantProfessionalId && selectedItem.referralId ? (selectedItem.applicantName || 'Referral applicant') : (selectedItem.displayName || selectedItem.title || selectedItem.name || selectedItem.subject || selectedItem.id)}</h2>
              </div>
              <button className="drawerCloseBtn" onClick={() => setSelectedItem(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Drawer Tabs if inspecting User */}
            {selectedItem.email && (
              <div className="drawerSubTabs">
                <button className={selectedDrawerTab === 'overview' ? 'active' : ''} onClick={() => setSelectedDrawerTab('overview')}>Overview</button>
                <button className={selectedDrawerTab === 'verification' ? 'active' : ''} onClick={() => setSelectedDrawerTab('verification')}>Verification & License</button>
                <button className={selectedDrawerTab === 'referrals' ? 'active' : ''} onClick={() => setSelectedDrawerTab('referrals')}>Referrals</button>
                <button className={selectedDrawerTab === 'applications' ? 'active' : ''} onClick={() => setSelectedDrawerTab('applications')}>Applications</button>
              </div>
            )}

            <div className="drawerBody">
              {selectedItem.applicantProfessionalId && selectedItem.referralId && (
                <div className="applicationInspector">
                  <section className="applicationInspectHero">
                    <div className="applicationInspectEyebrow"><span>APPLICATION</span><code>APP-{selectedItem.id.slice(0, 8).toUpperCase()}</code></div>
                    <div className={`applicationInspectStatus ${String(selectedItem.status || 'PENDING').toLowerCase()}`}>{selectedItem.status || 'Status not provided'}</div>
                    <h3>{selectedItem.referralTitle || 'Referral opportunity'}</h3>
                    <p>{[selectedItem.referralCity, selectedItem.referralState].filter(Boolean).join(', ') || 'Location not provided'}</p>
                    <small>Submitted {fmtDate(selectedItem.createdAt)}</small>
                  </section>

                  <section className="applicationInspectSection">
                    <h3>Applicant profile</h3>
                    <div className="applicationInspectGrid">
                      <div><small>Full name</small><b>{selectedItem.applicantName || 'Not provided'}</b></div>
                      <div><small>Email</small><b>{selectedItem.applicantEmail || 'Not provided'}</b></div>
                      <div><small>Phone</small><b>{selectedItem.applicantPhone || 'Not provided'}</b></div>
                      <div><small>Brokerage</small><b>{selectedItem.applicantBrokerage || 'Not provided'}</b></div>
                      <div><small>Managing broker</small><b>{selectedItem.applicantBrokerName || 'Not provided'}</b></div>
                      <div><small>Broker email</small><b>{selectedItem.applicantBrokerEmail || 'Not provided'}</b></div>
                      <div><small>Experience</small><b>{selectedItem.applicantExp || 'Not provided'}</b></div>
                      <div><small>Referral fee</small><b>{selectedItem.referralFeePercent != null ? `${selectedItem.referralFeePercent}%` : 'Not provided'}</b></div>
                    </div>
                  </section>

                  <section className="applicationInspectSection">
                    <h3>Referring professional</h3>
                    {(() => {
                      const owner = usersList.find(item => item.id === selectedItem.referralCreatorId);
                      return <div className="applicationInspectOwner"><span className="applicationInspectAvatar">{String(owner?.displayName || owner?.name || owner?.email || 'P').slice(0, 1).toUpperCase()}</span><div><b>{owner?.displayName || owner?.name || 'Professional'}</b><small>{owner?.email || selectedItem.referralCreatorId || 'Not provided'}</small></div></div>;
                    })()}
                  </section>

                  <section className="applicationInspectSection applicationInspectPitch">
                    <h3>Applicant note</h3>
                    <p>{selectedItem.pitchNote || 'No application note was provided.'}</p>
                  </section>
                </div>
              )}

              {selectedDrawerTab === 'overview' && !(selectedItem.applicantProfessionalId && selectedItem.referralId) && (
                <div className="detailFieldGrid">
                  {Object.entries(selectedItem).map(([key, val]) => (
                    <div className="detailField" key={key}>
                      <label>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</label>
                      <div>
                        {val == null ? '—' : typeof val === 'object' ? (val.toDate ? fmtDate(val) : JSON.stringify(val)) : String(val)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedDrawerTab === 'verification' && selectedItem.email && (
                <div className="drawerSection">
                  <h3>Account Verification</h3>
                  <div className="detailField">
                    <label>EMAIL VERIFICATION</label>
                    <div><span className={`verifyPill ${selectedItem.emailVerified === true ? 'approved' : 'pending'}`}>{selectedItem.emailVerified === true ? '✓ Verified' : '⚠ Unverified'}</span></div>
                  </div>
                  <div className="detailField">
                    <label>ACCOUNT STATUS</label>
                    <div>{selectedItem.accountStatus || 'Active'}</div>
                  </div>
                  <div className="detailField">
                    <label>ONBOARDING STATUS</label>
                    <div>{selectedItem.onboardingStatus || (selectedItem.verificationSubmittedAt ? 'SUBMITTED' : 'NOT_STARTED')}</div>
                  </div>
                  <h3>Professional License Review</h3>
                  <div className="detailField">
                    <label>LICENSE NUMBER</label>
                    <div><code>{selectedItem.licenseNumber || 'Not submitted'}</code></div>
                  </div>
                  <div className="detailField">
                    <label>LICENSING STATE</label>
                    <div>{selectedItem.licenseState || '—'}</div>
                  </div>
                  <div className="detailField">
                    <label>VERIFICATION STATUS</label>
                    <div><span className={`verifyPill ${selectedItem.verificationStatus || 'pending'}`}>{selectedItem.verificationStatus || 'pending'}</span></div>
                  </div>
                  <div className="detailField">
                    <label>ITEM REVIEWS</label>
                    <div>{selectedItem.verificationItems ? Object.entries(selectedItem.verificationItems).map(([key, item]) => `${item.label || key}: ${item.status}`).join(' · ') : 'No item-level submission found yet'}</div>
                  </div>
                  <p>Verification decisions are recorded item by item in the Verification Center with source details and an audit trail.</p>
                </div>
              )}

              {selectedDrawerTab === 'referrals' && selectedItem.email && (
                <div className="drawerSection">
                  <h3>Referrals Created by Agent</h3>
                  {referralsList.filter(r => r.creatorProfessionalId === selectedItem.id).length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No referrals posted by this user.</p>
                  ) : (
                    referralsList.filter(r => r.creatorProfessionalId === selectedItem.id).map(r => (
                      <div key={r.id} className="compactListItem" style={{ marginBottom: 8 }}>
                        <b>{r.title}</b>
                        <span className={`statusPill ${r.status?.toLowerCase()}`}>{r.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {selectedDrawerTab === 'applications' && selectedItem.email && (
                <div className="drawerSection">
                  <h3>Applications Submitted by Agent</h3>
                  {applicationsList.filter(a => a.applicantProfessionalId === selectedItem.id).length === 0 ? (
                    <p style={{ color: '#94a3b8' }}>No applications submitted by this user.</p>
                  ) : (
                    applicationsList.filter(a => a.applicantProfessionalId === selectedItem.id).map(a => (
                      <div key={a.id} className="compactListItem" style={{ marginBottom: 8 }}>
                        <b>{a.referralTitle || 'Referral #' + a.referralId}</b>
                        <span className={`statusPill ${a.status?.toLowerCase()}`}>{a.status}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="drawerFooter">
              <button className="adminSecondaryBtn" onClick={() => setSelectedItem(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          6. ACTION CONFIRMATION & ENTITY MODALS
          =================================================== */}
      {actionModal && (
        <div className="adminModalOverlay" onClick={() => !actionBusy && setActionModal(null)}>
          <div className="adminConfirmModal" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <span className="modalKicker">ADMINISTRATIVE ACTION</span>
              <h3>{actionModal.label}</h3>
            </div>

            <div className="modalBody">
              {actionModal.target && (
                <p>
                  Target: <b>{actionModal.target.displayName || actionModal.target.email || actionModal.target.title || actionModal.target.id}</b>
                </p>
              )}

              {/* Role Change Modal */}
              {actionModal.type === 'MANAGE_ROLE' && (
                <div className="formGroup">
                  <label>Select New Role</label>
                  <select value={actionRole} onChange={e => setActionRole(e.target.value)}>
                    <option value={ROLES.PROFESSIONAL}>PROFESSIONAL</option>
                    <option value={ROLES.ADMIN}>ADMIN</option>
                    <option value={ROLES.SUPER_ADMIN}>SUPER_ADMIN</option>
                  </select>
                </div>
              )}

              {/* Grant Admin Role */}
              {actionModal.type === 'CREATE_ADMIN' && (
                <div className="formGroup">
                  <label>Select User to Promote</label>
                  <select onChange={e => {
                    const u = usersList.find(x => x.id === e.target.value);
                    if (u) setActionModal(prev => ({ ...prev, target: u }));
                  }}>
                    <option value="">-- Choose User Account --</option>
                    {usersList.filter(u => u.role !== 'SUPER_ADMIN').map(u => (
                      <option key={u.id} value={u.id}>{u.displayName || u.email} ({u.role || 'PROFESSIONAL'})</option>
                    ))}
                  </select>
                  <label style={{ marginTop: 12 }}>New Role Privilege</label>
                  <select value={actionRole} onChange={e => setActionRole(e.target.value)}>
                    <option value={ROLES.ADMIN}>ADMIN</option>
                    <option value={ROLES.SUPER_ADMIN}>SUPER_ADMIN</option>
                  </select>
                </div>
              )}

              {/* Add Brokerage Modal */}
              {actionModal.type === 'ADD_BROKERAGE' && (
                <form onSubmit={handleCreateBrokerage}>
                  <div className="formGroup">
                    <label>Brokerage Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Compass Real Estate"
                      value={newBrokerage.name}
                      onChange={e => setNewBrokerage({ ...newBrokerage, name: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>City & State</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8 }}>
                      <input
                        type="text"
                        placeholder="City"
                        value={newBrokerage.city}
                        onChange={e => setNewBrokerage({ ...newBrokerage, city: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="State"
                        maxLength={2}
                        value={newBrokerage.state}
                        onChange={e => setNewBrokerage({ ...newBrokerage, state: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                  <div className="formGroup">
                    <label>Brokerage License Number</label>
                    <input
                      type="text"
                      placeholder="e.g. BRK-892348"
                      value={newBrokerage.licenseNumber}
                      onChange={e => setNewBrokerage({ ...newBrokerage, licenseNumber: e.target.value })}
                    />
                  </div>
                  <div className="modalFooter" style={{ marginTop: 20 }}>
                    <button type="button" className="adminSecondaryBtn" onClick={() => setActionModal(null)}>Cancel</button>
                    <button type="submit" className="adminPrimaryBtn" disabled={actionBusy}>Add Brokerage</button>
                  </div>
                </form>
              )}

              {/* Create Support Request Modal */}
              {actionModal.type === 'CREATE_SUPPORT' && (
                <form onSubmit={handleCreateSupportTicket}>
                  <div className="formGroup">
                    <label>Requester Email</label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={newSupportTicket.requesterEmail}
                      onChange={e => setNewSupportTicket({ ...newSupportTicket, requesterEmail: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Subject *</label>
                    <input
                      type="text"
                      required
                      placeholder="Brief summary of inquiry"
                      value={newSupportTicket.subject}
                      onChange={e => setNewSupportTicket({ ...newSupportTicket, subject: e.target.value })}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Priority</label>
                    <select
                      value={newSupportTicket.priority}
                      onChange={e => setNewSupportTicket({ ...newSupportTicket, priority: e.target.value })}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                  </div>
                  <div className="formGroup">
                    <label>Message / Details *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the issue or inquiry..."
                      value={newSupportTicket.message}
                      onChange={e => setNewSupportTicket({ ...newSupportTicket, message: e.target.value })}
                    />
                  </div>
                  <div className="modalFooter" style={{ marginTop: 20 }}>
                    <button type="button" className="adminSecondaryBtn" onClick={() => setActionModal(null)}>Cancel</button>
                    <button type="submit" className="adminPrimaryBtn" disabled={actionBusy}>Log Ticket</button>
                  </div>
                </form>
              )}

              {/* Broadcast Modal */}
              {actionModal.type === 'SEND_BROADCAST' && (
                <>
                  <div className="formGroup">
                    <label>Broadcast Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Platform Scheduled Maintenance Notice"
                      value={actionReason}
                      onChange={e => setActionReason(e.target.value)}
                    />
                  </div>
                  <div className="formGroup">
                    <label>Announcement Message Body *</label>
                    <textarea
                      placeholder="Enter the broadcast message visible to all members..."
                      rows={3}
                      id="broadcastBodyInput"
                    />
                  </div>
                </>
              )}

              {/* Standard Justification Reason for Actions */}
              {!['ADD_BROKERAGE', 'CREATE_SUPPORT'].includes(actionModal.type) && (
                <div className="formGroup">
                  <label>Administrative Reason (Recorded in immutable Audit Log)</label>
                  <textarea
                    placeholder="Enter the justification for this action..."
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {!['ADD_BROKERAGE', 'CREATE_SUPPORT'].includes(actionModal.type) && (
              <div className="modalFooter">
                <button
                  className="adminSecondaryBtn"
                  disabled={actionBusy}
                  onClick={() => setActionModal(null)}
                >
                  Cancel
                </button>
                <button
                  className="adminPrimaryBtn"
                  disabled={actionBusy}
                  onClick={() => {
                    if (actionModal.type === 'SUSPEND_USER') {
                      handleUserStatusChange(actionModal.target, 'suspended', actionReason);
                    } else if (actionModal.type === 'REACTIVATE_USER') {
                      handleUserStatusChange(actionModal.target, 'active', actionReason);
                    } else if (actionModal.type === 'FLAG_REFERRAL') {
                      handleReferralModeration(actionModal.target, 'flagged', actionReason);
                    } else if (actionModal.type === 'UNFLAG_REFERRAL') {
                      handleReferralModeration(actionModal.target, 'open', actionReason);
                    } else if (actionModal.type === 'CANCEL_REFERRAL') {
                      handleReferralModeration(actionModal.target, 'cancelled', actionReason);
                    } else if (actionModal.type === 'MANAGE_ROLE' || actionModal.type === 'CREATE_ADMIN') {
                      if (actionModal.target) handleRoleChange(actionModal.target, actionRole, actionReason);
                    } else if (actionModal.type === 'SEND_BROADCAST') {
                      const bodyVal = document.getElementById('broadcastBodyInput')?.value || '';
                      handleSendBroadcast(actionReason, bodyVal);
                    } else if (actionModal.type === 'RESOLVE_SUPPORT') {
                      handleResolveSupport(actionModal.target, actionReason);
                    }
                  }}
                >
                  {actionBusy ? 'Processing...' : 'Confirm Action'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================
          7. ADMIN PROFILE MODAL
          =================================================== */}
      {showProfileModal && (
        <div className="adminModalOverlay" onClick={() => setShowProfileModal(false)}>
          <div className="adminProfileModal" onClick={e => e.stopPropagation()}>
            <div className="profileModalHeader">
              <div className="modalAvatar">
                {adminName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h3>{adminName}</h3>
                <span className={`roleTag ${isSuperAdmin ? 'super' : 'admin'}`}>
                  {isSuperAdmin ? 'SUPER ADMIN (PLATFORM GOVERNANCE)' : 'ADMINISTRATOR'}
                </span>
              </div>
              <button className="drawerCloseBtn" onClick={() => setShowProfileModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="profileModalBody">
              <div className="profileInfoRow">
                <span>Email Address:</span>
                <b>{user.email}</b>
              </div>
              <div className="profileInfoRow">
                <span>Authentication UID:</span>
                <code>{user.uid}</code>
              </div>
              <div className="profileInfoRow">
                <span>Privilege Level:</span>
                <b>{isSuperAdmin ? 'Full Platform Governance & Security Control' : 'Operations & Moderation'}</b>
              </div>

              <div className="profilePermissionsSection">
                <span className="caption">ACTIVE RBAC PERMISSIONS:</span>
                <div className="permissionsMiniList">
                  {rolePermissions(role).map(p => (
                    <span key={p} className="permTag">
                      <Check size={11} /> {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="profileModalFooter">
              <button className="adminSecondaryBtn" onClick={() => setShowProfileModal(false)}>
                Close
              </button>
              <button className="adminLogoutBtn" onClick={onLogout}>
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================
          8. NOTIFICATIONS DRAWER
          =================================================== */}
      {showNotificationModal && (
        <div className="adminModalOverlay" onClick={() => setShowNotificationModal(false)}>
          <div className="adminDrawer" onClick={e => e.stopPropagation()}>
            <div className="drawerHeader">
              <div>
                <span className="drawerCaption">SYSTEM NOTIFICATIONS</span>
                <h2>Notifications Dispatch</h2>
              </div>
              <button className="drawerCloseBtn" onClick={() => setShowNotificationModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="drawerBody">
              {notificationsList.length === 0 ? (
                <div className="adminEmptyState">
                  <Bell size={28} color="#94a3b8" />
                  <b>No notifications</b>
                  <p>System alerts and broadcast dispatches will appear here.</p>
                </div>
              ) : (
                <div className="notifList">
                  {notificationsList.map(n => (
                    <div className="notifItem" key={n.id}>
                      <b>{n.title}</b>
                      <p>{n.body}</p>
                      <small>{fmtDate(n.createdAt)}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



