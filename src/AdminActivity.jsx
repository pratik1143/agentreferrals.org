import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import './admin-theme.css';

export default function AdminActivity() {
  const [filter, setFilter] = useState('ALL');

  const activities = [
    {
      id: 1,
      type: 'VERIFICATION',
      title: 'Professional License Approved',
      actor: 'Peter Frank (Super Admin)',
      detail: 'Approved Texas Real Estate Broker License #0681920 for Jordan Parker.',
      time: '12 minutes ago',
      icon: ShieldCheck,
      color: '#10b981'
    },
    {
      id: 2,
      type: 'CASE',
      title: 'New Case Received: Austin Downtown Portfolio',
      actor: 'Mark Wahlberg',
      detail: 'Case #104 published with requirements attachment (Listing agreement.pdf).',
      time: '45 minutes ago',
      icon: FileText,
      color: '#1b74e4'
    },
    {
      id: 3,
      type: 'SYSTEM',
      title: 'Escrow Milestone Reached',
      actor: 'Platform Engine',
      detail: '25% referral commission split ($12,500.00) transferred into escrow.',
      time: '2 hours ago',
      icon: CheckCircle2,
      color: '#8b5cf6'
    },
    {
      id: 4,
      type: 'SECURITY',
      title: 'Security Access Token Rotated',
      actor: 'System Daemon',
      detail: 'Automated 24h credential renewal completed across Firebase service accounts.',
      time: '5 hours ago',
      icon: ShieldCheck,
      color: '#3b82f6'
    },
    {
      id: 5,
      type: 'CASE',
      title: 'Document Uploaded to Library',
      actor: 'Erik Gunsel',
      detail: 'Attached forensic audit record "Nike fraud.doc" to Case #3.',
      time: 'Yesterday at 4:30 PM',
      icon: FileText,
      color: '#f59e0b'
    },
    {
      id: 6,
      type: 'VERIFICATION',
      title: 'New Partner Onboarding Completed',
      actor: 'Emily Smith',
      detail: 'Completed brokerage verification for Scandinavian luxury properties.',
      time: '2 days ago',
      icon: UserCheck,
      color: '#10b981'
    }
  ];

  const filtered = activities.filter(a => filter === 'ALL' || a.type === filter);

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Network & Audit Activity</h1>
          <p>Real-time audit stream of case transactions, security reviews, and verification approvals.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabFilterRow">
        <button
          className={`filterChip ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          All Activity <span className="chipCount">{activities.length}</span>
        </button>
        <button
          className={`filterChip ${filter === 'CASE' ? 'active' : ''}`}
          onClick={() => setFilter('CASE')}
        >
          Cases & Documents
        </button>
        <button
          className={`filterChip ${filter === 'VERIFICATION' ? 'active' : ''}`}
          onClick={() => setFilter('VERIFICATION')}
        >
          Verifications
        </button>
        <button
          className={`filterChip ${filter === 'SECURITY' ? 'active' : ''}`}
          onClick={() => setFilter('SECURITY')}
        >
          Security & Access
        </button>
        <button
          className={`filterChip ${filter === 'SYSTEM' ? 'active' : ''}`}
          onClick={() => setFilter('SYSTEM')}
        >
          System Events
        </button>
      </div>

      {/* Activity Timeline Card */}
      <div className="adminCard">
        <div className="cardSectionHead">
          <span className="cardSectionTitle">EVENT TIMELINE</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Live Log</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {filtered.map(act => {
            const Icon = act.icon;
            return (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 16,
                  paddingBottom: 16,
                  borderBottom: '1px solid #f1f5f9'
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 12,
                    background: `${act.color}15`,
                    color: act.color,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <h4 style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>
                      {act.title}
                    </h4>
                    <span style={{ fontSize: 11.5, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> {act.time}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 6px 0', fontSize: 12.5, color: '#475569', lineHeight: 1.5 }}>
                    {act.detail}
                  </p>

                  <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: 6 }}>
                    Actor: {act.actor}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
