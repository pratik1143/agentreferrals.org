import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, CheckSquare, Calendar, BarChart3, Users, Settings,
  HelpCircle, LogOut, Search, Mail, Bell, Plus, Play, Pause, RotateCcw,
  Clock, ArrowUpRight, TrendingUp, MapPin, Phone, ShieldCheck, X, ChevronLeft, ChevronRight,
  Building2, DollarSign, FileCheck2, UserPlus, FileText, ClipboardList,
  LayoutGrid, List, Eye, Tag, Filter, CheckCircle2, AlertCircle, KeyRound
} from "lucide-react";
import AdminVerification from "./AdminVerification";
import {
  collection, onSnapshot, query, orderBy, limit,
  doc, updateDoc, addDoc, serverTimestamp
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import "./fernly.css";
import "./verification-workspace.css";
import "./admin-security.css";

const TINTS = ["#cdeccf","#f4c9b4","#cfd6f7","#f6c6c2","#f5dfb5","#e5d3f5","#c9ebf0","#fde2c4"];
const tintFor = (str = "") => TINTS[str.charCodeAt(0) % TINTS.length];
const initials = (name = "") => name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() || "??";
const relTime = ts => {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return s + "s ago";
  if (s < 3600) return Math.floor(s/60) + "m ago";
  if (s < 86400) return Math.floor(s/3600) + "h ago";
  return d.toLocaleDateString();
};

function Skeleton({ h = 18, w = "100%", radius = 8 }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: radius,
      background: "linear-gradient(90deg,var(--hair) 25%,var(--panel) 50%,var(--hair) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite",
    }} />
  );
}

const professionalVerificationState = person => {
  const values = [person?.professionalVerificationStatus, person?.verificationStatus].map(value => String(value || "").toLowerCase());
  if (values.some(value => ["approved", "verified"].includes(value))) return "APPROVED";
  if (values.includes("rejected")) return "REJECTED";
  if (values.some(value => ["requires_changes", "changes_requested"].includes(value))) return "CHANGES_REQUESTED";
  if (values.some(value => ["pending", "pending_review", "submitted", "under_review"].includes(value))) return "PENDING";
  return "NOT_SUBMITTED";
};

function useLiveStats() {
  const [stats, setStats] = useState({ loading: true, errors: { users: "", referrals: "" }, totalUsers: 0, verifiedUsers: 0, pendingUsers: 0, totalReferrals: 0, openReferrals: 0 });
  useEffect(() => {
    if (!db) { setStats(s => ({ ...s, loading: false })); return; }
    const onError = key => err => {
      console.warn(`Live ${key} fetch note:`, err?.message);
      setStats(s => ({ ...s, loading: false, errors: { ...s.errors, [key]: err?.code || "load-error" } }));
    };
    const u1 = onSnapshot(query(collection(db, "users")), snap => {
      const pros = snap.docs.map(d => d.data()).filter(p => String(p.role || "PROFESSIONAL").toUpperCase() === "PROFESSIONAL");
      setStats(s => ({ ...s, totalUsers: pros.length,
        verifiedUsers: pros.filter(p => professionalVerificationState(p) === "APPROVED").length,
        pendingUsers: pros.filter(p => professionalVerificationState(p) === "PENDING").length,
        loading: false, errors: { ...s.errors, users: "" } }));
    }, onError("users"));
    const u2 = onSnapshot(query(collection(db, "referrals")), snap => {
      const statuses = snap.docs.map(d => String(d.data().status || "").toLowerCase());
      setStats(s => ({ ...s, totalReferrals: snap.size, openReferrals: statuses.filter(status => ["open", "active", "published"].includes(status)).length, loading: false, errors: { ...s.errors, referrals: "" } }));
    }, onError("referrals"));
    return () => { try { u1(); u2(); } catch(_) {} };
  }, []);
  return stats;
}

export default function FernlySuperAdmin({ user, role, onLogout, profile }) {
  const [activeView, setActiveView] = useState(() => {
    const hash = window.location.hash.replace(/^#/, "");
    return ["dashboard","tasks","calendar","analytics","team","verification","applications","agreements","settings","help"].includes(hash) ? hash : "dashboard";
  });
  const [settingsTab, setSettingsTab] = useState("Profile");
  const [passwordValues, setPasswordValues] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({ type: "", text: "" });
  const navigateTo = view => { setActiveView(view); window.location.hash = "#" + view; window.scrollTo({ top: 0, behavior: "smooth" }); };
  useEffect(() => {
    const h = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (["dashboard","tasks","calendar","analytics","team","verification","applications","agreements","settings","help"].includes(hash)) setActiveView(hash);
    };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const stats = useLiveStats();

  const [agents, setAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState({});
  useEffect(() => {
    if (!db) { setAgentsLoading(false); return; }
    const q = query(collection(db, "users"), orderBy("createdAt","desc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgentsLoading(false);
      setDataErrors(errors => ({ ...errors, users: "" }));
    }, err => { setAgentsLoading(false); setDataErrors(errors => ({ ...errors, users: err?.code || "load-error" })); });
    return unsub;
  }, []);

  const [referrals, setReferrals] = useState([]);
  const [referralsLoading, setReferralsLoading] = useState(true);
  useEffect(() => {
    if (!db) { setReferralsLoading(false); return; }
    const q = query(collection(db, "referrals"), orderBy("createdAt","desc"), limit(50));
    const unsub = onSnapshot(q, snap => {
      setReferrals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReferralsLoading(false);
      setDataErrors(errors => ({ ...errors, referrals: "" }));
    }, err => { setReferralsLoading(false); setDataErrors(errors => ({ ...errors, referrals: err?.code || "load-error" })); });
    return unsub;
  }, []);

  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);
  useEffect(() => {
    if (!db) { setApplicationsLoading(false); return; }
    return onSnapshot(query(collection(db, "applications"), orderBy("createdAt", "desc"), limit(100)), snap => {
      setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setApplicationsLoading(false);
      setDataErrors(errors => ({ ...errors, applications: "" }));
    }, err => { setApplicationsLoading(false); setDataErrors(errors => ({ ...errors, applications: err?.code || "load-error" })); });
  }, []);

  const [agreements, setAgreements] = useState([]);
  const [agreementsLoading, setAgreementsLoading] = useState(true);
  useEffect(() => {
    if (!db) { setAgreementsLoading(false); return; }
    return onSnapshot(query(collection(db, "agreements"), orderBy("createdAt", "desc"), limit(100)), snap => {
      setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setAgreementsLoading(false);
      setDataErrors(errors => ({ ...errors, agreements: "" }));
    }, err => { setAgreementsLoading(false); setDataErrors(errors => ({ ...errors, agreements: err?.code || "load-error" })); });
  }, []);

  const [notifications, setNotifications] = useState([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "adminNotifications"), orderBy("createdAt","desc"), limit(20));
    return onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn(err?.message));
  }, []);
  const unreadCount = notifications.filter(n => !n.read).length;
  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = window.setInterval(() => setTimerSeconds(seconds => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);
  const formatSessionTime = seconds => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(part => String(part).padStart(2, "0")).join(":");
  const markAllRead = () => {
    if (!db) return;
    notifications.filter(n => !n.read).forEach(n => updateDoc(doc(db,"adminNotifications",n.id),{ read: true }));
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(new Date().getDate());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const filteredAgents = useMemo(() => agents.filter(a => {
    const q = searchQuery.toLowerCase();
    const ms = !q || [a.displayName, a.email, a.role, a.brokerageName, a.licenseNumber, a.primaryMarket].some(v => String(v || "").toLowerCase().includes(q));
    const mf = statusFilter === "All" || professionalVerificationState(a) === statusFilter;
    return ms && mf;
  }), [agents, searchQuery, statusFilter]);

  useEffect(() => {
    if (activeView === "verification") setStatusFilter("PENDING");
    else if (activeView === "team") setStatusFilter("All");
  }, [activeView]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({ name:"", email:"", brokerage:"", city:"" });
  const [inviting, setInviting] = useState(false);
  const handleInvite = async e => {
    e.preventDefault();
    if (!newAgent.name || !newAgent.email) return;
    setInviting(true);
    try {
      if (db) await addDoc(collection(db,"agentInvites"), {
        displayName: newAgent.name, email: newAgent.email,
        brokerageName: newAgent.brokerage, primaryMarket: newAgent.city,
        invitedAt: serverTimestamp(), invitedBy: user?.email || "super-admin", status: "invited"
      });
      alert("Invitation sent to " + newAgent.email);
      setInviteOpen(false);
      setNewAgent({ name:"", email:"", brokerage:"", city:"" });
    } catch(err) { alert("Error: " + err.message); }
    finally { setInviting(false); }
  };

  const [postRefOpen, setPostRefOpen] = useState(false);
  const [newRef, setNewRef] = useState({ title:"", clientName:"", city:"", budget:"", fee:"25%" });
  const [posting, setPosting] = useState(false);
  const handlePostRef = async e => {
    e.preventDefault();
    if (!newRef.title) return;
    setPosting(true);
    try {
      if (db) await addDoc(collection(db,"referrals"), {
        title: newRef.title, clientName: newRef.clientName,
        targetCity: newRef.city, budget: newRef.budget,
        referralFee: newRef.fee, status: "Open",
        postedBy: user?.email || "super-admin", createdAt: serverTimestamp()
      });
      alert(`Referral "${newRef.title}" published!`);
      setPostRefOpen(false);
      setNewRef({ title:"", clientName:"", city:"", budget:"", fee:"25%" });
    } catch(err) { alert("Error: " + err.message); }
    finally { setPosting(false); }
  };

  const adminDisplayName = profile?.displayName || user?.displayName || "Super Admin";
  const adminEmail = user?.email || "support@agentreferrals.org";

  const handleAdminPasswordChange = async event => {
    event.preventDefault();
    setPasswordFeedback({ type: "", text: "" });
    if (!auth?.currentUser || !user?.email) {
      setPasswordFeedback({ type: "error", text: "Your sign-in session is unavailable. Sign in again and retry." });
      return;
    }
    if (passwordValues.next.length < 8) {
      setPasswordFeedback({ type: "error", text: "Use at least 8 characters for your new password." });
      return;
    }
    if (passwordValues.next !== passwordValues.confirm) {
      setPasswordFeedback({ type: "error", text: "The new password and confirmation do not match." });
      return;
    }
    if (passwordValues.current === passwordValues.next) {
      setPasswordFeedback({ type: "error", text: "Choose a new password that differs from your current one." });
      return;
    }

    setPasswordBusy(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordValues.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordValues.next);
      setPasswordValues({ current: "", next: "", confirm: "" });
      setPasswordFeedback({ type: "success", text: "Your password has been changed." });
    } catch (error) {
      const message = error?.code === "auth/invalid-credential" || error?.code === "auth/wrong-password"
        ? "Current password is incorrect. Check it and try again."
        : error?.code === "auth/weak-password"
          ? "Choose a stronger password with at least 8 characters."
          : error?.code === "auth/requires-recent-login"
            ? "For security, sign out and sign in again before changing your password."
            : error?.code === "auth/operation-not-allowed"
              ? "Password sign-in is not enabled for this account. Use the account recovery option or contact support."
              : error?.message || "Password could not be changed. Please try again.";
      setPasswordFeedback({ type: "error", text: message });
    } finally {
      setPasswordBusy(false);
    }
  };

  const [selectedReferral, setSelectedReferral] = useState(null);
  const [refViewMode, setRefViewMode] = useState("board"); // "board" or "list"
  const [refSearch, setRefSearch] = useState("");
  const [refStatusFilter, setRefStatusFilter] = useState("All");

  const handleUpdateRefStatus = async (refId, nextStatus) => {
    if (!db || !refId) return;
    try {
      await updateDoc(doc(db, "referrals", refId), {
        status: nextStatus,
        updatedAt: serverTimestamp()
      });
      if (selectedReferral?.id === refId) {
        setSelectedReferral(prev => prev ? ({ ...prev, status: nextStatus }) : null);
      }
    } catch(err) {
      alert("Error updating referral status: " + err.message);
    }
  };

  const normalizeStatus = s => (s || "").toString().trim().toLowerCase();

  const getRefDisplayStatus = s => {
    const st = normalizeStatus(s);
    if (st === "closed" || st === "completed" || st === "archived") return "Closed";
    if (st === "under review" || st === "under_review" || st === "review" || st === "agreement") return "Under Review";
    if (st === "matched" || st === "in progress" || st === "in_progress" || st === "assigned") return "Matched";
    return "Live";
  };

  const getRefBudget = r => {
    if (r.budget) return r.budget;
    if (r.minValue && r.maxValue) return `$${Number(r.minValue).toLocaleString()} - $${Number(r.maxValue).toLocaleString()}`;
    if (r.maxValue) return `Up to $${Number(r.maxValue).toLocaleString()}`;
    if (r.estimatedValueCents) return `$${Math.round(r.estimatedValueCents / 100).toLocaleString()}`;
    return "Market Price";
  };

  const getRefFee = r => {
    if (r.referralFee) return r.referralFee;
    if (r.feePercent) return `${r.feePercent}% Fee`;
    return "25% Fee";
  };

  const getRefLocation = r => {
    if (r.targetCity) return r.targetCity;
    if (r.city) return `${r.city}${r.state ? ", " + r.state : ""}`;
    return "United States";
  };

  const kanbanCols = useMemo(() => {
    const open = [];
    const matched = [];
    const review = [];
    const closed = [];

    const query = refSearch.trim().toLowerCase();

    referrals.forEach(r => {
      if (query) {
        const titleMatch = (r.title || "").toLowerCase().includes(query);
        const cityMatch = (r.targetCity || r.city || "").toLowerCase().includes(query);
        const creatorMatch = (r.creatorName || r.creatorBrokerage || r.postedBy || "").toLowerCase().includes(query);
        const typeMatch = (r.propertyType || r.clientType || "").toLowerCase().includes(query);
        if (!titleMatch && !cityMatch && !creatorMatch && !typeMatch) return;
      }

      const st = normalizeStatus(r.status);
      if (st === "closed" || st === "completed" || st === "archived" || st === "cancelled" || st === "rejected") {
        closed.push(r);
      } else if (st === "under review" || st === "under_review" || st === "review" || st === "agreement" || st === "negotiating" || st === "pending_signature") {
        review.push(r);
      } else if (st === "matched" || st === "in progress" || st === "in_progress" || st === "assigned") {
        matched.push(r);
      } else {
        // 'published', 'open', 'active', 'live', 'new', 'available', or any live ad
        open.push(r);
      }
    });

    return { open, matched, review, closed };
  }, [referrals, refSearch]);

  const filteredReferrals = useMemo(() => {
    const query = refSearch.trim().toLowerCase();
    return referrals.filter(r => {
      if (refStatusFilter !== "All") {
        const disp = getRefDisplayStatus(r.status);
        if (disp !== refStatusFilter) return false;
      }
      if (!query) return true;
      const titleMatch = (r.title || "").toLowerCase().includes(query);
      const cityMatch = (r.targetCity || r.city || "").toLowerCase().includes(query);
      const creatorMatch = (r.creatorName || r.creatorBrokerage || r.postedBy || "").toLowerCase().includes(query);
      const typeMatch = (r.propertyType || r.clientType || "").toLowerCase().includes(query);
      return titleMatch || cityMatch || creatorMatch || typeMatch;
    });
  }, [referrals, refSearch, refStatusFilter]);

  const now = new Date();
  const monthDays = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth()+1, 0).getDate();
  const monthOffset = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay()+6)%7;
  const applicationsOnDay = day => applications.filter(application => {
    const raw = application.createdAt;
    const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
    return date && !Number.isNaN(date.getTime()) && date.getFullYear()===calendarMonth.getFullYear() && date.getMonth()===calendarMonth.getMonth() && date.getDate()===day;
  });
  const weekBuckets = Array(7).fill(0);
  referrals.forEach(r => {
    const raw = r.createdAt;
    const date = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) return;
    const diff = Math.floor((now - date) / 86400000);
    if (diff >= 0 && diff < 7) weekBuckets[6-diff]++;
  });
  const maxBucket = Math.max(...weekBuckets, 1);
  const dayLabels = ["S","M","T","W","T","F","S"];
  const navItems = [
    { view:"dashboard", icon:<LayoutDashboard size={20}/>, label:"Dashboard" },
    { view:"tasks", icon:<CheckSquare size={20}/>, label:"Referrals", badge: referrals.length || null },
    { view:"applications", icon:<ClipboardList size={20}/>, label:"Applications", badge: applications.length || null },
    { view:"agreements", icon:<FileText size={20}/>, label:"Agreements", badge: agreements.length || null },
    { view:"calendar", icon:<Calendar size={20}/>, label:"Calendar" },
    { view:"analytics", icon:<BarChart3 size={20}/>, label:"Analytics" },
    { view:"team", icon:<Users size={20}/>, label:"Users & Agents", badge: stats.totalUsers || null },
    { view:"verification", icon:<ShieldCheck size={20}/>, label:"Verification", badge: stats.pendingUsers || null },
  ];

  return (
    <div id="fernly-superadmin-view">
      <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      <div className="fernly-root fernly-app app" id="app">

        {/* SIDEBAR */}
        <aside className="sidebar" id="sidebar" aria-label="Primary">
          <div className="sidebar__top">
            <a className="brand" href="#dashboard" onClick={e => { e.preventDefault(); navigateTo("dashboard"); }} style={{ display:"inline-flex", alignItems:"center", gap:11, textDecoration:"none", padding:"2px 0" }}>
              <img src="/agentreferrals-mark.svg" alt="AgentReferrals" style={{ width:38, height:38, flexShrink:0, display:"block", filter:"drop-shadow(0 2px 6px rgba(7,85,217,0.25))" }} />
              <div style={{ display:"flex", flexDirection:"column", lineHeight: 1.15 }}>
                <span className="brand__name" style={{ letterSpacing:"-0.03em", fontSize:19, fontWeight:800, color:"#101c31" }}>
                  Agent<span style={{ color:"#0878f9" }}>Referrals</span>
                </span>
                <span style={{ fontSize:9.5, fontWeight:750, letterSpacing:"0.07em", color:"#647068", textTransform:"uppercase", marginTop:2 }}>
                  Super Admin
                </span>
              </div>
            </a>
          </div>
          <div className="sidebar__navs">
            <nav className="nav" aria-labelledby="nav-menu">
              <p className="nav__label" id="nav-menu">Menu</p>
              <ul>
                {navItems.map(({ view, icon, label, badge }) => (
                  <li key={view}>
                    <a className="nav__link" href={"#"+view} aria-current={activeView===view?"page":undefined} onClick={e => { e.preventDefault(); navigateTo(view); }}>
                      {icon}{label}
                      {badge ? <span className="nav__badge">{badge}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav className="nav" aria-labelledby="nav-general">
              <p className="nav__label" id="nav-general">General</p>
              <ul>
                {[{view:"settings",icon:<Settings size={20}/>,label:"Settings"},{view:"help",icon:<HelpCircle size={20}/>,label:"Help"}].map(({ view, icon, label }) => (
                  <li key={view}>
                    <a className="nav__link" href={"#"+view} aria-current={activeView===view?"page":undefined} onClick={e => { e.preventDefault(); navigateTo(view); }}>
                      {icon}{label}
                    </a>
                  </li>
                ))}
                <li><button className="nav__link" type="button" onClick={onLogout}><LogOut size={20}/>Logout</button></li>
              </ul>
            </nav>
          </div>
          <div className="promo">
            <span className="promo__icon"><Building2 size={16}/></span>
            <p className="promo__title">Keep reviews moving</p>
            <p className="promo__sub">Check pending professional credentials and marketplace access.</p>
            <button className="promo__btn" type="button" onClick={() => navigateTo("verification")}>Open Verification</button>
          </div>
        </aside>

        {/* SHELL */}
        <div className="shell">
          <header className="topbar">
            <form className="search" onSubmit={e => e.preventDefault()}>
              <Search className="search__icon" size={20}/>
              <input id="search" type="search" placeholder="Search agents, referrals, cities…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoComplete="off"/>
              <kbd className="search__kbd" aria-hidden="true"><span>⌘</span> K</kbd>
            </form>
            <div className="topbar__actions">
              <div className="tray-wrap">
                <button className="icon-btn icon-btn--round" type="button" aria-label="Notifications" onClick={() => setTrayOpen(o => !o)}>
                  <Bell size={20}/>{unreadCount > 0 && <span className="dot" aria-hidden="true"/>}
                </button>
                {trayOpen && (
                  <div className="tray" role="dialog" aria-label="Notifications">
                    <div className="tray__head">
                      <p className="tray__title">Notifications</p>
                      <button className="link-btn" type="button" onClick={markAllRead}>Mark all read</button>
                    </div>
                    <ul className="tray__list">
                      {notifications.length === 0 && <li style={{ color:"var(--muted)", fontSize:13, padding:8 }}>No notifications yet</li>}
                      {notifications.map(n => (
                        <li key={n.id} className={n.read ? "" : "is-unread"}>
                          <span className="avatar" style={{ "--av": tintFor(n.actorName || n.title || "") }}>{initials(n.actorName || n.title || "N")}</span>
                          <div><b>{n.actorName || "System"}</b> {n.message || n.title}<span className="tray__ago">{relTime(n.createdAt)}</span></div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="profile">
                <span className="avatar avatar--lg" style={{ "--av":"#f4c9b4" }}>SA</span>
                <span className="profile__text">
                  <span className="profile__name">{adminDisplayName}</span>
                  <span className="profile__mail">{adminEmail}</span>
                </span>
              </div>
            </div>
          </header>

          <main className="board" id="main" tabIndex="-1">

            {/* DASHBOARD */}
            {activeView === "dashboard" && (
              <section className="view" data-view="dashboard" aria-labelledby="h-dashboard">
                <div className="board__head">
                  <div>
                    <h1 className="board__title" id="h-dashboard">Dashboard</h1>
                    <p className="board__sub">A clear view of your AgentReferrals network and the work that needs attention.</p>
                  </div>
                  <div className="board__actions">
                    <button className="btn btn--primary" type="button" onClick={() => setPostRefOpen(true)}><Plus size={16}/> Post Referral</button>
                  </div>
                </div>
                <div className="grid">
                  <article className="card stat stat--hero" style={{ gridArea:"s1", cursor:"pointer" }} onClick={() => navigateTo("tasks")}>
                    <div className="stat__head"><h2 className="stat__title">Total Referrals</h2><span className="arrow"><ArrowUpRight size={18}/></span></div>
                    <p className="stat__num">{stats.loading || stats.errors.referrals ? "—" : stats.totalReferrals}</p>
                    <p className="stat__note">{stats.errors.referrals ? "Unavailable · " + stats.errors.referrals : <><TrendingUp size={14}/> Live from Firestore</>}</p>
                  </article>
                  <article className="card stat" style={{ gridArea:"s2", cursor:"pointer" }} onClick={() => navigateTo("team")}>
                    <div className="stat__head"><h2 className="stat__title">Verified Professionals</h2><span className="arrow"><ArrowUpRight size={18}/></span></div>
                    <p className="stat__num">{stats.loading || stats.errors.users ? "—" : stats.verifiedUsers}</p>
                    <p className="stat__note"><TrendingUp size={14}/> Approved professionals</p>
                  </article>
                  <article className="card stat" style={{ gridArea:"s3", cursor:"pointer" }} onClick={() => navigateTo("team")}>
                    <div className="stat__head"><h2 className="stat__title">Total Professionals</h2><span className="arrow"><ArrowUpRight size={18}/></span></div>
                    <p className="stat__num">{stats.loading || stats.errors.users ? "—" : stats.totalUsers}</p>
                    <p className="stat__note"><TrendingUp size={14}/> All registered users</p>
                  </article>
                  <article className="card stat" style={{ gridArea:"s4", cursor:"pointer" }} onClick={() => navigateTo("team")}>
                    <div className="stat__head"><h2 className="stat__title">Pending Reviews</h2><span className="arrow"><ArrowUpRight size={18}/></span></div>
                    <p className="stat__num">{stats.loading || stats.errors.users ? "—" : stats.pendingUsers}</p>
                    <p className="stat__note" style={{ color:"#b06d0a" }}>Awaiting verification</p>
                  </article>

                  <article className="card analytics" style={{ gridArea:"an" }}>
                    <div className="card__head">
                      <div><h2 className="card__title">Referral Activity This Week</h2><p className="card__sub">New referrals posted by day, based on live records.</p></div>
                    </div>
                    {referralsLoading ? <div style={{marginTop:20}}><Skeleton h={150}/></div> : dataErrors.referrals ? <p className="empty" role="alert">Chart unavailable ({dataErrors.referrals}).</p> : (
                      <ol className="bars">
                        {weekBuckets.map((count, i) => <li key={i}>
                          <div className="bar" style={{ "--h": count/maxBucket || 0.04 }} title={`${count} referrals on ${dayLabels[i]}`}><span className="bar__fill"/></div>
                          <span className="bar__day">{dayLabels[i]}</span>
                        </li>)}
                      </ol>
                    )}
                  </article>

                  <article className="card reminder" style={{ gridArea:"re" }}>
                    <h2 className="card__title">Pending Reviews</h2>
                    {stats.errors.users ? (
                      <>
                        <p className="reminder__what">Queue unavailable</p>
                        <p className="reminder__when">Could not load verification cases ({stats.errors.users}).</p>
                        <button className="btn btn--ghost reminder__btn" type="button" onClick={() => navigateTo("verification")}>Open Verification Center</button>
                      </>
                    ) : stats.pendingUsers > 0 ? (
                      <>
                        <p className="reminder__what">{stats.pendingUsers} Agent{stats.pendingUsers !== 1 ? "s" : ""} Waiting</p>
                        <p className="reminder__when">License &amp; credential verification required</p>
                        <button className="btn btn--primary reminder__btn" type="button" onClick={() => navigateTo("team")}>
                          <ShieldCheck size={16}/> Review Agents
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="reminder__what">No reviews waiting</p>
                        <p className="reminder__when">New submissions will appear here.</p>
                        <button className="btn btn--ghost reminder__btn" type="button" onClick={() => navigateTo("verification")}>Open Verification Center</button>
                      </>
                    )}
                  </article>

                  <article className="card tracker" style={{ gridArea:"tr" }}>
                    <div className="sessionTimerHead">
                      <span className="sessionTimerIcon"><Clock size={19}/></span>
                      <span className="sessionTimerState"><i className={timerRunning ? "is-running" : ""}/>{timerRunning ? "Session in progress" : "Focus session"}</span>
                    </div>
                    <h2 className="card__title sessionTimerTitle">Admin Session</h2>
                    <p className="sessionTimerHint">Keep track of your platform review time.</p>
                    <div key={timerSeconds} className={"sessionTimerDisplay " + (timerRunning ? "is-running" : "")} role="timer" aria-label={`Elapsed session time ${formatSessionTime(timerSeconds)}`}>
                      {formatSessionTime(timerSeconds).split(":").map((part, index) => <React.Fragment key={index}><span>{part}</span>{index < 2 && <i>:</i>}</React.Fragment>)}
                    </div>
                    <div className="sessionTimerControls">
                      <button className="sessionTimerToggle" type="button" onClick={() => setTimerRunning(value => !value)} aria-label={timerRunning ? "Pause session timer" : "Start session timer"}>
                        {timerRunning ? <Pause size={17}/> : <Play size={17} fill="currentColor"/>}{timerRunning ? "Pause" : timerSeconds ? "Resume" : "Start session"}
                      </button>
                      <button className="sessionTimerReset" type="button" onClick={() => { setTimerRunning(false); setTimerSeconds(0); }} disabled={!timerSeconds && !timerRunning} aria-label="Reset session timer"><RotateCcw size={17}/></button>
                    </div>
                  </article>

                  <article className="card team" style={{ gridArea:"tm" }}>
                    <div className="card__head"><div><h2 className="card__title">Action Center</h2><p className="card__sub">Work queues that need attention.</p></div></div>
                    <ul className="actionQueue">
                      <li><ShieldCheck size={18}/><span><b>Verification</b><small>{stats.errors.users ? "Unavailable · " + stats.errors.users : `${stats.pendingUsers} awaiting review`}</small></span><button type="button" onClick={() => navigateTo("verification")}>Review</button></li>
                      <li><ClipboardList size={18}/><span><b>Applications</b><small>{dataErrors.applications ? "Unavailable · " + dataErrors.applications : `${applications.filter(a => ["pending", "submitted", "under_review"].includes(String(a.status || "").toLowerCase())).length} pending`}</small></span><button type="button" onClick={() => navigateTo("applications")}>Open</button></li>
                      <li><FileText size={18}/><span><b>Agreements</b><small>{dataErrors.agreements ? "Unavailable · " + dataErrors.agreements : `${agreements.filter(a => ["pending", "pending_signatures", "draft"].includes(String(a.status || "").toLowerCase())).length} awaiting action`}</small></span><button type="button" onClick={() => navigateTo("agreements")}>Open</button></li>
                      <li><CheckSquare size={18}/><span><b>Reported referrals</b><small>{dataErrors.referrals ? "Unavailable · " + dataErrors.referrals : `${referrals.filter(r => r.reported === true || Number(r.reportCount) > 0 || r.moderationStatus === "reported").length} reported`}</small></span><button type="button" onClick={() => navigateTo("tasks")}>Review</button></li>
                    </ul>
                  </article>

                  <article className="card projects" style={{ gridArea:"sd" }}>
                    <div className="card__head"><h2 className="card__title">Latest Referrals</h2></div>
                    {referralsLoading ? (
                      <div style={{ marginTop:16, display:"grid", gap:12 }}>{[1,2,3].map(i => <Skeleton key={i} h={44} radius={12}/>)}</div>
                    ) : dataErrors.referrals ? (
                      <p className="empty" role="alert">Could not load referrals ({dataErrors.referrals}).</p>
                    ) : referrals.length === 0 ? (
                      <p className="empty" style={{ marginTop:16 }}>No referrals yet. Post the first one!</p>
                    ) : (
                      <ul className="plist">
                        {referrals.slice(0,6).map(r => (
                          <li key={r.id} className="pitem">
                            <span className="pico pico--api"/>
                            <div>
                              <span className="pitem__name">{r.title || r.propertyType || "Referral"}</span>
                              <span className="pitem__due">{r.targetCity || r.city || ""}{r.referralFee ? " · Fee: " + r.referralFee : ""} · {r.status || "Open"}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>

                  <article className="card progress" style={{ gridArea:"pg" }}>
                    <h2 className="card__title">Verification Rate</h2>
                    <div className="gauge">
                      <div style={{ textAlign:"center", marginTop:10 }}>
                        <p className="gauge__pct" style={{ fontSize:52, fontWeight:700, color:"#155a37" }}>
                          {stats.totalUsers > 0 ? Math.round((stats.verifiedUsers/stats.totalUsers)*100)+"%" : "—"}
                        </p>
                        <p className="gauge__lbl">Agents Approved</p>
                      </div>
                    </div>
                    <ul className="legend">
                      <li><span className="sw sw--done"/> Approved</li>
                      <li><span className="sw sw--prog"/> Pending</li>
                      <li><span className="sw sw--pend"/> Rejected</li>
                    </ul>
                  </article>
                </div>
              </section>
            )}

            {/* AGENT NETWORK */}
            {activeView === "verification" && (agentsLoading ? (
              <section className="view"><div className="board__head"><div><h1 className="board__title">Verification Center</h1><p className="board__sub">Loading professional submissions…</p></div></div><div className="card data-loading"><Skeleton h={52}/><Skeleton h={52}/><Skeleton h={52}/></div></section>
            ) : dataErrors.users ? (
              <section className="view"><div className="board__head"><div><h1 className="board__title">Verification Center</h1><p className="board__sub">Review identity, licenses, brokerage and submitted supporting documents.</p></div></div><div className="card empty empty--block" role="alert">Could not load verification submissions ({dataErrors.users}). Confirm the signed-in account is an email-verified administrator and that current Firestore rules are deployed.</div></section>
            ) : <AdminVerification users={agents} role={role} />)}

            {activeView === "team" && (
              <section className="view" data-view="team" aria-labelledby="h-team">
                <div className="board__head">
                  <div>
                    <h1 className="board__title" id="h-team">Users &amp; Agents</h1>
                    <p className="board__sub">Manage registered professionals and review account profiles. Credential decisions live in Verification Center.</p>
                  </div>
                  <div className="board__actions">
                    <button className="btn btn--primary" type="button" onClick={() => setInviteOpen(true)}><UserPlus size={16}/> Invite Agent</button>
                  </div>
                </div>
                <div className="toolbar">
                  <div className="seg" role="group" aria-label="Status filter">
                    {["All","APPROVED","PENDING","REJECTED"].map(f => (
                      <button key={f} type="button" className="seg__btn" aria-pressed={statusFilter===f} onClick={() => setStatusFilter(f)}>
                        {f==="All" ? "All" : f==="APPROVED" ? "Verified" : f==="PENDING" ? "Pending" : "Rejected"}
                      </button>
                    ))}
                  </div>
                  <div className="toolbar__meta">
                    <b>{agents.filter(a => professionalVerificationState(a)==="APPROVED").length}</b> verified · <b>{stats.errors.users ? "Unavailable" : stats.totalUsers}</b> total
                  </div>
                </div>
                {agentsLoading ? (
                  <div className="people">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="card member">
                        <Skeleton h={76} w={76} radius="50%"/>
                        <div style={{ marginTop:14, width:"100%", display:"grid", gap:8 }}>
                          <Skeleton h={18} w="60%"/>
                          <Skeleton h={14} w="80%"/>
                          <Skeleton h={32} radius={99}/>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : dataErrors.users ? (
                  <div className="empty empty--block" role="alert">Could not load professionals ({dataErrors.users}). Check admin access and retry.</div>
                ) : filteredAgents.length === 0 ? (
                  <p className="empty empty--block">No agents match that filter.</p>
                ) : (
                  <ul className="people">
                    {filteredAgents.map(agent => (
                      <li key={agent.id} className="card member">
                        <div className="member__av">
                          <span className="avatar avatar--xl" style={{ "--av": tintFor(agent.displayName) }}>{initials(agent.displayName)}</span>
                          <span className={"status " + (professionalVerificationState(agent)==="APPROVED" ? "status--online" : professionalVerificationState(agent)==="REJECTED" ? "status--offline" : "status--away")} title={professionalVerificationState(agent)}/>
                        </div>
                        <h3 className="member__name">{agent.displayName || "Unnamed Agent"}</h3>
                        <p className="member__role">{agent.role || agent.professionalTitle || "Licensed Professional"}</p>
                        <span className="member__dept">{agent.brokerageName || "Independent"}</span>
                        <div className="member__stats">
                          <div><p>Market</p><b style={{ fontSize:13 }}>{agent.primaryMarket || "—"}</b></div>
                          <div><p>License</p><b style={{ fontSize:13 }}>{agent.licenseNumber || "—"}</b></div>
                        </div>
                        <div style={{ width:"100%", marginTop:10, fontSize:12, color:"var(--muted)" }}>{agent.email}</div>
                        <div className="member__actions">
                          <button className="btn btn--ghost" type="button" style={{ flex:1, height:42, fontSize:14 }} onClick={() => setSelectedAgent(agent)}>
                            {professionalVerificationState(agent) === "APPROVED" ? "Profile" : "Details"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedAgent && (
                  <>
                    <div className="panel-scrim" onClick={() => setSelectedAgent(null)}/>
                    <aside className="panel" role="dialog" aria-label="Agent details">
                      <button className="icon-btn panel__close" type="button" onClick={() => setSelectedAgent(null)}><X size={18}/></button>
                      <div className="panel__hero">
                        <span className="avatar" style={{ "--av": tintFor(selectedAgent.displayName), width:96, height:96, fontSize:28 }}>{initials(selectedAgent.displayName)}</span>
                        <h2 className="panel__name">{selectedAgent.displayName}</h2>
                        <p className="member__role">{selectedAgent.role || "Licensed Professional"}</p>
                        <span className="member__dept">{selectedAgent.brokerageName || "Independent"}</span>
                        <div className="panel__meta">
                          {selectedAgent.primaryMarket && <span><MapPin size={14}/> {selectedAgent.primaryMarket}</span>}
                          {selectedAgent.email && <span><Mail size={14}/> {selectedAgent.email}</span>}
                          {selectedAgent.phoneNumber && <span><Phone size={14}/> {selectedAgent.phoneNumber}</span>}
                        </div>
                      </div>
                      <div className="panel__stats">
                        <div><b>{professionalVerificationState(selectedAgent)==="APPROVED" ? "✓" : "?"}</b><span>Verification</span></div>
                        <div><b>{selectedAgent.licenseNumber || "—"}</b><span>License</span></div>
                        <div><b>{selectedAgent.profileCompletion || 0}%</b><span>Profile</span></div>
                      </div>
                      {selectedAgent.licenseNumber && (
                        <>
                          <h4 className="panel__h">State License</h4>
                          <div style={{ background:"var(--panel)", padding:14, borderRadius:14, marginBottom:16 }}>
                            <p style={{ margin:"0 0 4px", fontSize:13, fontWeight:600 }}>License #: {selectedAgent.licenseNumber}</p>
                            <p style={{ margin:0, fontSize:12, color:"var(--muted)" }}>Status: {professionalVerificationState(selectedAgent).replaceAll("_", " ")}</p>
                          </div>
                        </>
                      )}
                      <h4 className="panel__h">Professional details</h4>
                      <div className="review-details">
                        <div><span>License region</span><b>{selectedAgent.licenseRegion || selectedAgent.licenseState || selectedAgent.primaryMarket || "Not provided"}</b></div>
                        <div><span>Brokerage</span><b>{selectedAgent.brokerageName || "Not provided"}</b></div>
                        <div><span>Professional website</span><b>{selectedAgent.website || selectedAgent.professionalWebsite || "Not provided"}</b></div>
                      </div>
                      <div className="panel__actions">
                        <button className="btn btn--ghost" type="button" style={{ flex:1 }} onClick={() => setSelectedAgent(null)}>Close</button>
                        {professionalVerificationState(selectedAgent) === "APPROVED" ? (
                          <button className="btn btn--primary" type="button" style={{ flex:1 }} onClick={() => { setSelectedAgent(null); setPostRefOpen(true); }}>Send Referral</button>
                        ) : (
                          <button className="btn btn--primary" type="button" style={{ flex:1 }} onClick={() => { setSelectedAgent(null); navigateTo("verification"); }}>Open Verification Center</button>
                        )}
                      </div>
                    </aside>
                  </>
                )}

                {inviteOpen && (
                  <div style={{ position:"fixed", inset:0, zIndex:90, background:"rgba(13,24,17,0.45)", backdropFilter:"blur(4px)", display:"grid", placeItems:"center", padding:16 }}>
                    <div className="card" style={{ width:"min(460px,100%)", padding:28, borderRadius:24 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                        <h3 style={{ fontSize:20, fontWeight:600 }}>Invite Agent</h3>
                        <button onClick={() => setInviteOpen(false)} style={{ border:"none", background:"transparent", cursor:"pointer" }}><X size={20}/></button>
                      </div>
                      <form onSubmit={handleInvite} style={{ display:"grid", gap:14 }}>
                        <div className="field"><span>Full name</span><input required placeholder="e.g. Jordan Parker" value={newAgent.name} onChange={e => setNewAgent({...newAgent,name:e.target.value})}/></div>
                        <div className="field"><span>Email</span><input type="email" required placeholder="agent@brokerage.com" value={newAgent.email} onChange={e => setNewAgent({...newAgent,email:e.target.value})}/></div>
                        <div className="field"><span>Brokerage</span><input placeholder="e.g. Compass" value={newAgent.brokerage} onChange={e => setNewAgent({...newAgent,brokerage:e.target.value})}/></div>
                        <div className="field"><span>Market / City</span><input placeholder="e.g. Austin, TX" value={newAgent.city} onChange={e => setNewAgent({...newAgent,city:e.target.value})}/></div>
                        <div style={{ display:"flex", gap:10, marginTop:8 }}>
                          <button className="btn btn--ghost" type="button" onClick={() => setInviteOpen(false)} style={{ flex:1, height:46 }}>Cancel</button>
                          <button className="btn btn--primary" type="submit" disabled={inviting} style={{ flex:1, height:46 }}>{inviting ? "Sending…" : "Send Invite"}</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* REFERRALS & MARKETPLACE ADS */}
            {activeView === "tasks" && (
              <section className="view" data-view="tasks" aria-labelledby="h-tasks">
                <div className="board__head" style={{ marginBottom:18 }}>
                  <div>
                    <h1 className="board__title" id="h-tasks">Referrals &amp; Marketplace Ads</h1>
                    <p className="board__sub">Track live client opportunities, active listings, and referral pipeline from Firestore.</p>
                  </div>
                  <div className="board__actions">
                    <button className="btn btn--primary" type="button" onClick={() => setPostRefOpen(true)}><Plus size={16}/> Post Referral</button>
                  </div>
                </div>

                {/* Toolbar: Search, View Mode, Status Filter */}
                <div className="toolbar" style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", flex:1, minWidth:280, maxWidth:520 }}>
                    <div style={{ position:"relative", width:"100%", maxWidth:360 }}>
                      <Search size={16} style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"var(--faint)", pointerEvents:"none" }}/>
                      <input
                        type="text"
                        placeholder="Search referrals by title, city, agent…"
                        value={refSearch}
                        onChange={e => setRefSearch(e.target.value)}
                        style={{
                          width:"100%", height:42, paddingLeft:38, paddingRight:14,
                          borderRadius:999, border:"1px solid var(--hair)", background:"var(--card)",
                          fontSize:13, outline:"none", boxSizing:"border-box"
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    {refViewMode === "list" && (
                      <div className="seg" role="group" aria-label="Status filter">
                        {["All", "Live", "Matched", "Under Review", "Closed"].map(tab => (
                          <button key={tab} type="button" className="seg__btn" aria-pressed={refStatusFilter === tab} onClick={() => setRefStatusFilter(tab)}>
                            {tab}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="seg" role="group" aria-label="View mode">
                      <button type="button" className="seg__btn" aria-pressed={refViewMode === "board"} onClick={() => setRefViewMode("board")} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                        <LayoutGrid size={15}/> Board
                      </button>
                      <button type="button" className="seg__btn" aria-pressed={refViewMode === "list"} onClick={() => setRefViewMode("list")} style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                        <List size={15}/> List
                      </button>
                    </div>
                    <span className="toolbar__meta" style={{ fontSize:13, color:"var(--muted)", whiteSpace:"nowrap" }}>
                      <b>{referrals.length}</b> total ads
                    </span>
                  </div>
                </div>

                {referralsLoading ? (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16 }}>
                    {[1,2,3,4].map(i => <Skeleton key={i} h={340} radius={20}/>)}
                  </div>
                ) : refViewMode === "board" ? (
                  /* KANBAN BOARD VIEW */
                  <div className="kanban">
                    {[
                      { col:"open", title:"Live / Open Ads", dot:"#27865a", items:kanbanCols.open },
                      { col:"matched", title:"Matched", dot:"#2563eb", items:kanbanCols.matched },
                      { col:"review", title:"Under Review", dot:"#d97706", items:kanbanCols.review },
                      { col:"closed", title:"Closed", dot:"#6b7280", items:kanbanCols.closed }
                    ].map(column => (
                      <div key={column.col} className="col">
                        <div className="col__head">
                          <span className="col__dot" style={{ "--c": column.dot }}/>
                          <h2 className="col__title">{column.title}</h2>
                          <span className="col__count">{column.items.length}</span>
                        </div>
                        <div className="col__list">
                          {column.items.length === 0 ? (
                            <p className="col__empty">No referrals in this stage</p>
                          ) : column.items.map(r => (
                            <div
                              key={r.id}
                              className="task"
                              onClick={() => setSelectedReferral(r)}
                              style={{
                                cursor:"pointer",
                                transition:"transform 0.2s ease, box-shadow 0.2s ease",
                                border:"1px solid var(--hair)",
                                borderRadius:16,
                                padding:16
                              }}
                            >
                              <div className="task__top" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, marginBottom:10 }}>
                                <span style={{
                                  display:"inline-flex", alignItems:"center", gap:5,
                                  padding:"3px 8px", borderRadius:999,
                                  background: column.col==="open" ? "#e3f2e9" : column.col==="matched" ? "#eff6ff" : column.col==="review" ? "#fef3c7" : "#f3f4f6",
                                  color: column.col==="open" ? "#155a37" : column.col==="matched" ? "#1e40af" : column.col==="review" ? "#b45309" : "#4b5563",
                                  fontSize:11, fontWeight:750
                                }}>
                                  <span style={{
                                    width:6, height:6, borderRadius:"50%",
                                    background: column.col==="open" ? "#27865a" : column.col==="matched" ? "#2563eb" : column.col==="review" ? "#d97706" : "#6b7280"
                                  }}/>
                                  {column.col==="open" ? "Live Ad" : column.col==="matched" ? "Matched" : column.col==="review" ? "In Review" : "Closed"}
                                </span>
                                <span className="tag" style={{ "--fg":"#155a37", "--bg":"#e3f2e9", fontWeight:750 }}>
                                  {getRefFee(r)}
                                </span>
                              </div>

                              <h3 className="task__title" style={{ fontSize:15, fontWeight:650, margin:"0 0 6px", color:"var(--ink)", lineHeight:1.3 }}>
                                {r.title || r.propertyType || "Client Referral"}
                              </h3>

                              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, flexWrap:"wrap" }}>
                                <span style={{ fontSize:11, fontWeight:600, color:"#3b82f6", background:"#eff6ff", padding:"2px 8px", borderRadius:6 }}>
                                  {r.clientType ? (r.clientType.toUpperCase() + " LEAD") : (r.category || "REFERRAL")}
                                </span>
                                {r.propertyType && (
                                  <span style={{ fontSize:11, color:"var(--muted)", background:"var(--panel)", padding:"2px 8px", borderRadius:6 }}>
                                    {r.propertyType}
                                  </span>
                                )}
                              </div>

                              <div style={{ display:"grid", gap:4, fontSize:12, color:"var(--muted)", marginBottom:10 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                                  <MapPin size={13} style={{ color:"var(--g-700)", flexShrink:0 }}/>
                                  <span>{getRefLocation(r)}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:5, fontWeight:600, color:"var(--ink)" }}>
                                  <DollarSign size={13} style={{ color:"var(--g-700)", flexShrink:0 }}/>
                                  <span>{getRefBudget(r)}</span>
                                </div>
                              </div>

                              <div className="task__foot" style={{ borderTop:"1px solid var(--hair)", paddingTop:10, marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, color:"var(--faint)" }}>
                                <span className="task__due" style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                                  <Clock size={12}/> {relTime(r.createdAt)}
                                </span>
                                <span style={{ maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={r.creatorName || r.postedBy || "Agent"}>
                                  {r.creatorName || r.postedBy ? `By: ${r.creatorName || r.postedBy}` : "Active Ad"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* LIST / TABLE VIEW */
                  <div className="card data-card">
                    {filteredReferrals.length === 0 ? (
                      <p className="empty empty--block" style={{ padding:40 }}>No referrals match your current search.</p>
                    ) : (
                      <div className="data-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Referral Ad</th>
                              <th>Location</th>
                              <th>Type</th>
                              <th>Price Range</th>
                              <th>Fee</th>
                              <th>Posted By</th>
                              <th>Status</th>
                              <th>Published</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredReferrals.map(r => {
                              const dispStatus = getRefDisplayStatus(r.status);
                              return (
                                <tr key={r.id} style={{ cursor:"pointer" }} onClick={() => setSelectedReferral(r)}>
                                  <td>
                                    <strong style={{ fontSize:14 }}>{r.title || r.propertyType || "Referral Ad"}</strong>
                                    <small>{r.propertyType || "Real Estate Opportunity"}</small>
                                  </td>
                                  <td>
                                    <span style={{ display:"inline-flex", alignItems:"center", gap:4 }}>
                                      <MapPin size={13} style={{ color:"var(--g-700)" }}/>
                                      {getRefLocation(r)}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ fontSize:11.5, fontWeight:650, color:"#2563eb", background:"#eff6ff", padding:"3px 8px", borderRadius:6 }}>
                                      {r.clientType ? (r.clientType.charAt(0).toUpperCase() + r.clientType.slice(1)) : "Referral"}
                                    </span>
                                  </td>
                                  <td><strong>{getRefBudget(r)}</strong></td>
                                  <td><span className="data-status" style={{ background:"#e3f2e9", color:"#155a37" }}>{getRefFee(r)}</span></td>
                                  <td>
                                    <strong>{r.creatorName || r.postedBy || "Verified Agent"}</strong>
                                    <small>{r.creatorBrokerage || r.creatorEmail || "Brokerage"}</small>
                                  </td>
                                  <td>
                                    <span className="data-status" style={{
                                      background: dispStatus==="Live" ? "#e3f2e9" : dispStatus==="Matched" ? "#eff6ff" : dispStatus==="Under Review" ? "#fef3c7" : "#f3f4f6",
                                      color: dispStatus==="Live" ? "#155a37" : dispStatus==="Matched" ? "#1e40af" : dispStatus==="Under Review" ? "#b45309" : "#4b5563"
                                    }}>
                                      {dispStatus === "Live" ? "🟢 Live Ad" : dispStatus}
                                    </span>
                                  </td>
                                  <td>{relTime(r.createdAt)}</td>
                                  <td>
                                    <button
                                      className="btn btn--ghost"
                                      type="button"
                                      style={{ height:34, padding:"0 12px", fontSize:12 }}
                                      onClick={e => { e.stopPropagation(); setSelectedReferral(r); }}
                                    >
                                      View
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* REFERRAL DETAILS SLIDEOUT DRAWER */}
                {selectedReferral && (
                  <>
                    <div className="panel-scrim" onClick={() => setSelectedReferral(null)}/>
                    <aside className="panel" role="dialog" aria-label="Referral Ad Details" style={{ zIndex:100, width:"min(480px, 100vw - 24px)" }}>
                      <button className="icon-btn panel__close" type="button" onClick={() => setSelectedReferral(null)}><X size={18}/></button>
                      
                      <div style={{ padding:"10px 0 16px", borderBottom:"1px solid var(--hair)" }}>
                        <span style={{
                          display:"inline-flex", alignItems:"center", gap:6,
                          padding:"4px 10px", borderRadius:999,
                          background: getRefDisplayStatus(selectedReferral.status)==="Live" ? "#e3f2e9" : "#eff6ff",
                          color: getRefDisplayStatus(selectedReferral.status)==="Live" ? "#155a37" : "#1e40af",
                          fontSize:12, fontWeight:750, marginBottom:10
                        }}>
                          <span style={{ width:7, height:7, borderRadius:"50%", background: getRefDisplayStatus(selectedReferral.status)==="Live" ? "#27865a" : "#2563eb" }}/>
                          {getRefDisplayStatus(selectedReferral.status) === "Live" ? "🟢 Live Marketplace Ad" : getRefDisplayStatus(selectedReferral.status)}
                        </span>
                        <h2 style={{ fontSize:22, fontWeight:750, letterSpacing:"-0.02em", color:"var(--ink)", margin:"0 0 6px" }}>
                          {selectedReferral.title || "Referral Opportunity"}
                        </h2>
                        <p style={{ display:"flex", alignItems:"center", gap:5, fontSize:13, color:"var(--muted)", margin:0 }}>
                          <MapPin size={14} style={{ color:"var(--g-700)" }}/> {getRefLocation(selectedReferral)}
                        </p>
                      </div>

                      {/* Key metrics grid */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, margin:"18px 0" }}>
                        <div style={{ background:"var(--panel)", padding:12, borderRadius:14, textAlign:"center" }}>
                          <span style={{ fontSize:11, color:"var(--muted)", display:"block" }}>Estimated Budget</span>
                          <b style={{ fontSize:15, color:"var(--ink)", display:"block", marginTop:3 }}>{getRefBudget(selectedReferral)}</b>
                        </div>
                        <div style={{ background:"var(--panel)", padding:12, borderRadius:14, textAlign:"center" }}>
                          <span style={{ fontSize:11, color:"var(--muted)", display:"block" }}>Referral Fee</span>
                          <b style={{ fontSize:15, color:"var(--g-800)", display:"block", marginTop:3 }}>{getRefFee(selectedReferral)}</b>
                        </div>
                        <div style={{ background:"var(--panel)", padding:12, borderRadius:14, textAlign:"center" }}>
                          <span style={{ fontSize:11, color:"var(--muted)", display:"block" }}>Client Type</span>
                          <b style={{ fontSize:15, color:"var(--ink)", display:"block", marginTop:3 }}>
                            {selectedReferral.clientType ? (selectedReferral.clientType.charAt(0).toUpperCase() + selectedReferral.clientType.slice(1)) : "Buyer"}
                          </b>
                        </div>
                      </div>

                      {/* Ad Details Specification */}
                      <h4 className="panel__h" style={{ margin:"18px 0 10px", fontSize:14, fontWeight:700 }}>Listing Information</h4>
                      <div className="review-details" style={{ display:"grid", gap:1, borderRadius:14, overflow:"hidden", background:"var(--hair)" }}>
                        <div style={{ display:"grid", gap:4, background:"var(--panel)", padding:"12px 14px" }}>
                          <span style={{ color:"var(--muted)", fontSize:12 }}>Property Category</span>
                          <b style={{ fontSize:13, fontWeight:600 }}>{selectedReferral.propertyType || selectedReferral.category || "Residential Property"}</b>
                        </div>
                        <div style={{ display:"grid", gap:4, background:"var(--panel)", padding:"12px 14px" }}>
                          <span style={{ color:"var(--muted)", fontSize:12 }}>Market &amp; Location</span>
                          <b style={{ fontSize:13, fontWeight:600 }}>{getRefLocation(selectedReferral)} {selectedReferral.zip ? `(${selectedReferral.zip})` : ""}</b>
                        </div>
                        <div style={{ display:"grid", gap:4, background:"var(--panel)", padding:"12px 14px" }}>
                          <span style={{ color:"var(--muted)", fontSize:12 }}>Date Published</span>
                          <b style={{ fontSize:13, fontWeight:600 }}>{selectedReferral.createdAt?.toDate ? selectedReferral.createdAt.toDate().toLocaleString() : "Real-time listing"}</b>
                        </div>
                      </div>

                      {/* Description & Requirements */}
                      {selectedReferral.description && (
                        <div style={{ marginTop:18 }}>
                          <h4 className="panel__h" style={{ margin:"0 0 8px", fontSize:14, fontWeight:700 }}>Client Overview &amp; Notes</h4>
                          <div style={{ background:"var(--panel)", padding:14, borderRadius:14, fontSize:13, color:"var(--ink)", lineHeight:1.55 }}>
                            {selectedReferral.description}
                          </div>
                        </div>
                      )}

                      {/* Special Preferences */}
                      {selectedReferral.preferences && (
                        <div style={{ marginTop:14 }}>
                          <h4 className="panel__h" style={{ margin:"0 0 8px", fontSize:14, fontWeight:700 }}>Agent Preferences &amp; Timeline</h4>
                          <div style={{ background:"var(--panel)", padding:14, borderRadius:14, fontSize:13, color:"var(--ink)", lineHeight:1.55 }}>
                            {selectedReferral.preferences}
                          </div>
                        </div>
                      )}

                      {/* Posted by agent */}
                      <div style={{ marginTop:20 }}>
                        <h4 className="panel__h" style={{ margin:"0 0 10px", fontSize:14, fontWeight:700 }}>Posted by Professional</h4>
                        <div style={{ display:"flex", alignItems:"center", gap:12, padding:12, borderRadius:14, background:"var(--panel)" }}>
                          <span className="avatar" style={{ "--av": tintFor(selectedReferral.creatorName || "Agent"), width:44, height:44 }}>
                            {initials(selectedReferral.creatorName || selectedReferral.postedBy || "Agent")}
                          </span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <strong style={{ display:"block", fontSize:14 }}>{selectedReferral.creatorName || selectedReferral.postedBy || "Licensed Agent"}</strong>
                            <small style={{ display:"block", color:"var(--muted)", fontSize:12 }}>
                              {selectedReferral.creatorBrokerage || "Member Brokerage"}
                            </small>
                            {selectedReferral.creatorEmail && (
                              <small style={{ display:"block", color:"var(--g-800)", fontSize:11.5, marginTop:2 }}>
                                {selectedReferral.creatorEmail}
                              </small>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Action Buttons for Super Admin */}
                      <div style={{ marginTop:24 }}>
                        <h4 className="panel__h" style={{ margin:"0 0 10px", fontSize:14, fontWeight:700 }}>Manage Ad Status</h4>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            style={{ height:40, fontSize:12.5 }}
                            onClick={() => handleUpdateRefStatus(selectedReferral.id, "published")}
                          >
                            Mark Live / Open
                          </button>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            style={{ height:40, fontSize:12.5 }}
                            onClick={() => handleUpdateRefStatus(selectedReferral.id, "Matched")}
                          >
                            Mark as Matched
                          </button>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            style={{ height:40, fontSize:12.5 }}
                            onClick={() => handleUpdateRefStatus(selectedReferral.id, "Under Review")}
                          >
                            Move to Review
                          </button>
                          <button
                            className="btn btn--ghost"
                            type="button"
                            style={{ height:40, fontSize:12.5, color:"var(--rose)" }}
                            onClick={() => handleUpdateRefStatus(selectedReferral.id, "Closed")}
                          >
                            Close / Archive Ad
                          </button>
                        </div>
                      </div>

                      <div className="panel__actions" style={{ marginTop:24 }}>
                        <button className="btn btn--primary btn--block" type="button" onClick={() => setSelectedReferral(null)}>
                          Done
                        </button>
                      </div>
                    </aside>
                  </>
                )}
              </section>
            )}

            {activeView === "applications" && (
              <section className="view" aria-labelledby="h-applications">
                <div className="board__head">
                  <div><h1 className="board__title" id="h-applications">Applications</h1><p className="board__sub">Incoming applications for AgentReferrals opportunities.</p></div>
                  <div className="board__actions"><span className="toolbar__meta"><b>{applications.length}</b> total applications</span></div>
                </div>
                <div className="card data-card">
                    {applicationsLoading ? <div className="data-loading"><Skeleton h={44}/><Skeleton h={44}/><Skeleton h={44}/></div> : dataErrors.applications ? <p className="empty empty--block" role="alert">Could not load applications ({dataErrors.applications}).</p> : applications.length === 0 ? <p className="empty empty--block">No applications have arrived yet.</p> : (
                    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Applicant</th><th>Referral</th><th>Owner</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
                      {applications.map(a => <tr key={a.id}><td><strong>{a.applicantName || "Applicant"}</strong><small>{a.applicantEmail || "Email not provided"}</small></td><td>{a.referralTitle || `Opportunity ${a.referralId ? "#" + a.referralId.slice(0, 7) : ""}`}</td><td>{a.referralCreatorId || "—"}</td><td><span className="data-status">{a.status || "Pending"}</span></td><td>{a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : "—"}</td></tr>)}
                    </tbody></table></div>
                  )}
                </div>
              </section>
            )}

            {activeView === "agreements" && (
              <section className="view" aria-labelledby="h-agreements">
                <div className="board__head">
                  <div><h1 className="board__title" id="h-agreements">Agreements</h1><p className="board__sub">Track referral agreements and signature progress.</p></div>
                  <div className="board__actions"><span className="toolbar__meta"><b>{agreements.length}</b> total agreements</span></div>
                </div>
                <div className="card data-card">
                    {agreementsLoading ? <div className="data-loading"><Skeleton h={44}/><Skeleton h={44}/><Skeleton h={44}/></div> : dataErrors.agreements ? <p className="empty empty--block" role="alert">Could not load agreements ({dataErrors.agreements}).</p> : agreements.length === 0 ? <p className="empty empty--block">No agreements have been created yet.</p> : (
                    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Agreement</th><th>Referral</th><th>Referring professional</th><th>Receiving professional</th><th>Fee</th><th>Status</th><th>Date</th></tr></thead><tbody>
                      {agreements.map(a => { const fee = a.referralSnapshot?.referralFee?.percent ?? a.feePercent; return <tr key={a.id}><td><strong>{a.agreementNumber || `AGR-${a.id.slice(0, 7).toUpperCase()}`}</strong><small>{a.agreementTemplateVersion ? `Terms v${a.agreementTemplateVersion}` : "Referral agreement"}</small></td><td>{a.referralSnapshot?.title || a.referralTitle || "Referral Agreement"}</td><td>{a.referringName || "—"}</td><td>{a.receivingName || "—"}</td><td>{fee == null ? "—" : `${fee}%`}</td><td><span className="data-status">{a.status || "—"}</span></td><td>{(a.activatedAt || a.createdAt)?.toDate ? (a.activatedAt || a.createdAt).toDate().toLocaleDateString() : "—"}</td></tr>; })}
                    </tbody></table></div>
                  )}
                </div>
              </section>
            )}

            {/* CALENDAR */}
            {activeView === "calendar" && (
              <section className="view" data-view="calendar" aria-labelledby="h-calendar">
                <div className="board__head">
                  <div>
                    <h1 className="board__title" id="h-calendar">Calendar</h1>
                    <p className="board__sub">Referral milestones and application arrivals, organized by date.</p>
                  </div>
                </div>
                <div className="cal">
                  <div className="card cal__month">
                    <div className="card__head"><h2 className="cal__label">{calendarMonth.toLocaleString("default",{month:"long",year:"numeric"})}</h2><div className="cal__nav"><button className="icon-btn icon-btn--soft" aria-label="Previous month" type="button" onClick={()=>{setCalendarMonth(month=>new Date(month.getFullYear(),month.getMonth()-1,1));setSelectedCalendarDay(1);}}><ChevronLeft size={18}/></button><button className="icon-btn icon-btn--soft" aria-label="Next month" type="button" onClick={()=>{setCalendarMonth(month=>new Date(month.getFullYear(),month.getMonth()+1,1));setSelectedCalendarDay(1);}}><ChevronRight size={18}/></button></div></div>
                    <div className="cal__dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
                    <div className="cal__grid">
                      {Array.from({length:monthOffset},(_,i)=><span key={`pad-${i}`} className="day day--empty" aria-hidden="true"/>)}
                      {Array.from({length:monthDays},(_,i)=>i+1).map(day=>{
                        const dayApplications=applicationsOnDay(day);
                        return <button key={day} type="button" onClick={()=>setSelectedCalendarDay(day)} aria-pressed={selectedCalendarDay===day} className={"day "+(day===now.getDate()?"day--today ":"")+(selectedCalendarDay===day?"day--selected":"")}>
                          <span className="day__n">{day}</span>
                          {dayApplications.length>0&&<span className="day__dots" aria-label={`${dayApplications.length} applications received`}>{Array.from({length:Math.min(dayApplications.length,3)},(_,index)=><i key={index} className="day__dot" style={{"--c":"var(--g-600)"}}/>)}</span>}
                          {dayApplications.length>0&&<span className="day__evt">{dayApplications.length} application{dayApplications.length===1?"":"s"}</span>}
                        </button>;
                      })}
                    </div>
                  </div>
                  <div className="card cal__agenda">
                    <p className="cal__eyebrow">Applications received</p>
                    <h3 className="cal__day">{new Date(calendarMonth.getFullYear(),calendarMonth.getMonth(),selectedCalendarDay).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</h3>
                    {applicationsLoading ? <Skeleton h={100}/> : (
                      <ul className="agenda">
                        {applicationsOnDay(selectedCalendarDay).slice(0,5).map(a=>(
                          <li key={a.id} style={{ "--c":"#27865a" }}>
                            <div className="agenda__time" style={{ fontSize:11 }}>{a.createdAt?.toDate?a.createdAt.toDate().toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):"Received"}</div>
                            <div><div className="agenda__t">{a.applicantName||"New applicant"}</div><div className="agenda__k">{a.referralTitle||"Referral application"}</div></div>
                          </li>
                        ))}
                        {applicationsOnDay(selectedCalendarDay).length===0&&(
                          <li style={{ "--c":"var(--muted)" }}><div className="agenda__time"/><div><div className="agenda__t" style={{color:"var(--muted)"}}>No applications on this date</div></div></li>
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="card cal__next">
                    <h3 className="card__title">Recently Closed</h3>
                    <div className="upnext">
                      {referrals.filter(r=>r.status==="Closed"||r.status==="Completed").slice(0,3).map(r=>(
                        <button key={r.id} type="button">
                          <div className="upnext__date">
                            <b>{r.createdAt?.toDate ? r.createdAt.toDate().getDate() : "—"}</b>
                            <small>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString("default",{month:"short"}) : ""}</small>
                          </div>
                          <div>
                            <div className="upnext__t">{r.title||r.propertyType}</div>
                            <div className="upnext__s">{r.referralFee||""} {r.targetCity||""}</div>
                          </div>
                        </button>
                      ))}
                      {referrals.filter(r=>r.status==="Closed"||r.status==="Completed").length===0&&(
                        <p style={{fontSize:13,color:"var(--muted)",padding:8}}>No closed referrals yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ANALYTICS */}
            {activeView === "analytics" && (
              <section className="view" data-view="analytics" aria-labelledby="h-analytics">
                <div className="board__head">
                  <div><h1 className="board__title" id="h-analytics">Analytics</h1><p className="board__sub">Platform-wide metrics from your live Firestore data.</p></div>
                </div>
                <div className="an-grid">
                  <div className="card kpi"><span className="kpi__label">Total Referrals</span><strong className="kpi__num">{stats.loading?"—":stats.totalReferrals}</strong><span className="kpi__delta"><TrendingUp size={14}/> Live count</span></div>
                  <div className="card kpi"><span className="kpi__label">Verified Agents</span><strong className="kpi__num">{stats.loading?"—":stats.verifiedUsers}</strong><span className="kpi__delta"><TrendingUp size={14}/> Approved professionals</span></div>
                  <div className="card kpi"><span className="kpi__label">Pending Reviews</span><strong className="kpi__num">{stats.loading?"—":stats.pendingUsers}</strong><span className="kpi__delta" style={{color:stats.pendingUsers>0?"var(--amber)":"var(--g-700)"}}>{stats.pendingUsers>0?"Action needed":"All clear"}</span></div>
                  <div className="card kpi"><span className="kpi__label">Verification Rate</span><strong className="kpi__num">{stats.totalUsers>0?Math.round((stats.verifiedUsers/stats.totalUsers)*100)+"%":"—"}</strong><span className="kpi__delta"><TrendingUp size={14}/> Approved vs total</span></div>
                  <div className="card trend-card">
                    <div className="card__head"><h3 className="card__title">Referral Activity — Past 7 Days</h3></div>
                    {referralsLoading ? <div style={{marginTop:16}}><Skeleton h={200}/></div> : (
                      <div style={{height:200,display:"flex",alignItems:"flex-end",gap:14,paddingTop:20}}>
                        {weekBuckets.map((v,i)=>(
                          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:"100%",justifyContent:"flex-end"}}>
                            <div style={{width:"100%",height:(v/maxBucket*100||4)+"%",background:i>=4?"var(--g-950)":i>=2?"var(--g-700)":"var(--g-400)",borderRadius:"8px 8px 0 0",minHeight:4}}/>
                            <small style={{marginTop:6,fontSize:11,color:"var(--muted)"}}>{dayLabels[i]}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="card donut-card">
                    <div className="card__head"><h3 className="card__title">Pipeline Breakdown</h3></div>
                    <ul style={{margin:"16px 0 0",padding:0,listStyle:"none",display:"grid",gap:10}}>
                      {[{label:"Open / Active",count:kanbanCols.open.length,color:"#646d67"},{label:"Matched",count:kanbanCols.matched.length,color:"#27865a"},{label:"Under Review",count:kanbanCols.review.length,color:"#b06d0a"},{label:"Closed",count:kanbanCols.closed.length,color:"#1d7347"}].map(row=>(
                        <li key={row.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:14}}>
                          <span style={{display:"flex",alignItems:"center",gap:8}}><span style={{width:10,height:10,borderRadius:"50%",background:row.color,flexShrink:0}}/>{row.label}</span>
                          <b>{row.count}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {/* SETTINGS */}
            {activeView === "settings" && (
              <section className="view" data-view="settings" aria-labelledby="h-settings">
                <div className="board__head"><div><h1 className="board__title" id="h-settings">Settings</h1><p className="board__sub">Super admin profile and platform configuration.</p></div></div>
                <div className="settings">
                  <div className="card set-nav"><div className="set-nav__tabs">
                    {["Profile", "Commission Rules", "Security"].map(tab => <button key={tab} className="set-nav__tab" type="button" aria-selected={settingsTab === tab} onClick={() => {
                      setSettingsTab(tab);
                      if (tab === "Security") window.setTimeout(() => document.getElementById("admin-change-password")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
                      else if (tab === "Commission Rules") window.setTimeout(() => document.getElementById("admin-commission-rules")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
                      else window.setTimeout(() => document.getElementById("admin-settings-profile")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
                    }}>{tab}</button>)}
                  </div></div>
                  <div className="card set-body">
                    <div className="pane__head" id="admin-settings-profile"><div><h2 className="pane__title">Super Admin Profile</h2><p className="pane__sub">AgentReferrals Platform Operations &amp; Governance.</p></div></div>
                    <form onSubmit={e=>{e.preventDefault();alert("Settings saved!");}} className="form-grid">
                      <div className="field"><span>Display name</span><input type="text" defaultValue={adminDisplayName}/></div>
                      <div className="field"><span>Email address</span><input type="email" defaultValue={adminEmail} disabled/></div>
                      <div className="field field--wide"><span>Platform Role</span><input type="text" defaultValue="Super Administrator · AgentReferrals" disabled/></div>
                      <div className="field" id="admin-commission-rules"><span>Standard Referral Fee (%)</span><input type="number" defaultValue="25" min="10" max="50"/></div>
                      <div className="field"><span>Escrow Holding Period (Days)</span><input type="number" defaultValue="30"/></div>
                      <div className="pane__foot" style={{gridColumn:"1 / -1"}}><button className="btn btn--primary" type="submit">Save changes</button></div>
                    </form>
                    <section className="admin-password-section" id="admin-change-password" aria-labelledby="admin-password-title">
                      <div className="admin-password-heading">
                        <span className="admin-password-icon"><KeyRound size={19}/></span>
                        <div><h3 id="admin-password-title">Change password</h3><p>Confirm your current password before setting a new one.</p></div>
                      </div>
                      <form className="form-grid" onSubmit={handleAdminPasswordChange}>
                        <label className="field field--wide"><span>Current password</span><input type="password" autoComplete="current-password" required value={passwordValues.current} onChange={event => setPasswordValues(values => ({...values, current: event.target.value}))}/></label>
                        <label className="field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={passwordValues.next} onChange={event => setPasswordValues(values => ({...values, next: event.target.value}))}/></label>
                        <label className="field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={passwordValues.confirm} onChange={event => setPasswordValues(values => ({...values, confirm: event.target.value}))}/></label>
                        <div className="admin-password-foot">
                          <p className={`admin-password-feedback ${passwordFeedback.type}`} role={passwordFeedback.type === "error" ? "alert" : "status"} aria-live="polite">{passwordFeedback.text || "Use at least 8 characters. You will remain signed in after the update."}</p>
                          <button className="btn btn--primary" type="submit" disabled={passwordBusy}>{passwordBusy ? "Updating password…" : "Update password"}</button>
                        </div>
                      </form>
                    </section>
                  </div>
                </div>
              </section>
            )}

            {/* HELP */}
            {activeView === "help" && (
              <section className="view" data-view="help" aria-labelledby="h-help">
                <div className="board__head"><div><h1 className="board__title" id="h-help">Operations Knowledgebase</h1><p className="board__sub">Guides for referral agreements, licensing compliance, and broker payouts.</p></div></div>
                <div className="help">
                  <div className="card help__hero">
                    <h2 className="help__q">How can platform operations assist you today?</h2>
                    <p className="help__hint">Guides on referral agreement generation, RESPA compliance, and broker payouts.</p>
                    <div className="help__cats">
                      {[{icon:<FileCheck2 size={24}/>,label:"Agreements",sub:"25% Mutual Contracts"},{icon:<ShieldCheck size={24}/>,label:"Licensing",sub:"50-State Verifications"},{icon:<DollarSign size={24}/>,label:"Commissions",sub:"Escrow & W-9 Rules"},{icon:<Building2 size={24}/>,label:"Brokerages",sub:"Managing Broker Signoff"}].map(c=>(
                        <button key={c.label} className="hcat" type="button">{c.icon}<div><b>{c.label}</b><small>{c.sub}</small></div></button>
                      ))}
                    </div>
                  </div>
                  <div className="card help__faq">
                    <h3 className="card__title">Frequently Asked Questions</h3>
                    <div className="faq">
                      {[["How are referral fee agreements signed?","When two licensed professionals agree to partner on a referral, AgentReferrals compiles a binding agreement capturing IP, timestamp, and W-9."],["How does license verification work?","Every agent must provide their state license number. Admins cross-reference the state registry before activating publishing rights."],["How do I approve a new agent?","Go to Agents view, find the pending agent, review their license and profile, then click Approve. They gain full platform access immediately."]].map(([q,a])=>(
                        <div key={q} className="faq__item"><div className="faq__q"><span>{q}</span><span className="faq__icon">+</span></div><p className="faq__a">{a}</p></div>
                      ))}
                    </div>
                  </div>
                  <div className="card help__keys">
                    <h3 className="card__title">Platform Shortcuts</h3>
                    <dl className="keys"><div><dt><kbd>G</kbd> <kbd>T</kbd></dt><dd>Go to Agents</dd></div><div><dt><kbd>G</kbd> <kbd>D</kbd></dt><dd>Go to Dashboard</dd></div><div><dt><kbd>G</kbd> <kbd>P</kbd></dt><dd>Go to Pipeline</dd></div></dl>
                  </div>
                  <div className="card help__contact">
                    <h3 className="help__contact-t">Need direct broker support?</h3>
                    <p className="help__contact-d">Reach out to platform operations anytime.</p>
                    <div className="help__contact-row"><a className="btn btn--primary" href="mailto:support@agentreferrals.org">Email Support</a></div>
                  </div>
                </div>
              </section>
            )}

          </main>
        </div>
      </div>

      {/* POST REFERRAL MODAL */}
      {postRefOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:90, background:"rgba(13,24,17,0.45)", backdropFilter:"blur(4px)", display:"grid", placeItems:"center", padding:16 }}>
          <div className="card" style={{ width:"min(480px,100%)", padding:28, borderRadius:24, boxShadow:"0 24px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ fontSize:20, fontWeight:600 }}>Post Network Referral</h3>
              <button onClick={() => setPostRefOpen(false)} style={{ border:"none", background:"transparent", cursor:"pointer" }}><X size={20}/></button>
            </div>
            <form onSubmit={handlePostRef} style={{ display:"grid", gap:14 }}>
              <div className="field"><span>Referral Title</span><input required placeholder="e.g. $1.5M Luxury Buyer" value={newRef.title} onChange={e=>setNewRef({...newRef,title:e.target.value})}/></div>
              <div className="field"><span>Client Notes</span><input placeholder="e.g. Pre-approved, cash buyer" value={newRef.clientName} onChange={e=>setNewRef({...newRef,clientName:e.target.value})}/></div>
              <div className="field"><span>Target City</span><input placeholder="e.g. Austin, TX" value={newRef.city} onChange={e=>setNewRef({...newRef,city:e.target.value})}/></div>
              <div className="field"><span>Budget / Price</span><input placeholder="e.g. $1,200,000" value={newRef.budget} onChange={e=>setNewRef({...newRef,budget:e.target.value})}/></div>
              <div className="field">
                <span>Referral Fee</span>
                <select value={newRef.fee} onChange={e=>setNewRef({...newRef,fee:e.target.value})}>
                  <option value="25%">25% (Standard)</option>
                  <option value="28%">28% (Commercial)</option>
                  <option value="30%">30% (High-End)</option>
                  <option value="20%">20% (Volume)</option>
                </select>
              </div>
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button className="btn btn--ghost" type="button" onClick={() => setPostRefOpen(false)} style={{ flex:1, height:46 }}>Cancel</button>
                <button className="btn btn--primary" type="submit" disabled={posting} style={{ flex:1, height:46 }}>{posting ? "Publishing…" : "Publish Referral"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
