import React, { useState } from 'react';
import {
  TrendingUp,
  BarChart3,
  Globe,
  PieChart,
  Calendar,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import './admin-theme.css';

export default function AdminStatistic() {
  const [timeframe, setTimeframe] = useState('30D');

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Statistic & Performance Analytics</h1>
          <p>Detailed breakdown of case velocity, geographic distribution, and acceptance trends.</p>
        </div>

        {/* Timeframe Selector */}
        <div style={{ display: 'flex', gap: 6, background: '#ffffff', padding: 4, borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {['7D', '30D', '90D', '1Y'].map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              style={{
                border: 'none',
                background: timeframe === t ? '#1b74e4' : 'transparent',
                color: timeframe === t ? '#ffffff' : '#64748b',
                padding: '6px 14px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="kpiRowGrid">
        <div className="adminCard metricKpiCard">
          <span className="metricCardLabel">TOTAL CASES PROCESSED</span>
          <div className="metricValueRow">
            <span className="metricValue">1,248</span>
            <svg className="metricSparkline" viewBox="0 0 120 40" fill="none">
              <path d="M4 30 C 20 18, 40 32, 60 14 C 80 8, 100 20, 116 6" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="metricFootRow">
            <span>Overall growth</span>
            <span className="trendBadge positive">+24.6%</span>
          </div>
        </div>

        <div className="adminCard metricKpiCard">
          <span className="metricCardLabel">AVG. RESOLUTION TIME</span>
          <div className="metricValueRow">
            <span className="metricValue">4.2d</span>
            <svg className="metricSparkline" viewBox="0 0 120 40" fill="none">
              <path d="M4 14 C 20 24, 40 10, 60 22 C 80 16, 100 28, 116 12" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="metricFootRow">
            <span>Efficiency gain</span>
            <span className="trendBadge positive">+18.2% faster</span>
          </div>
        </div>

        <div className="adminCard metricKpiCard">
          <span className="metricCardLabel">COMMISSION VOLUME</span>
          <div className="metricValueRow">
            <span className="metricValue">$428K</span>
            <svg className="metricSparkline" viewBox="0 0 120 40" fill="none">
              <path d="M4 28 C 20 22, 40 14, 60 18 C 80 8, 100 12, 116 4" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="metricFootRow">
            <span>Escrow splits</span>
            <span className="trendBadge positive">+31.4%</span>
          </div>
        </div>
      </div>

      {/* Deep Breakdown Grid */}
      <div className="bottomTwoColGrid">
        {/* Full Case Category Breakdown */}
        <div className="adminCard">
          <div className="cardSectionHead">
            <span className="cardSectionTitle">CATEGORY SHARE BREAKDOWN</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>Active distribution</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Product & Asset Introductions', count: 76, pct: 45, color: '#1b74e4' },
              { label: 'Trademark & IP Agreements', count: 48, pct: 28, color: '#ef4444' },
              { label: 'Scandinavia Commercial Leases', count: 28, pct: 16, color: '#10b981' },
              { label: 'Patent & Technology Licensing', count: 18, pct: 11, color: '#8b5cf6' }
            ].map(cat => (
              <div key={cat.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>{cat.label}</span>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{cat.count} cases ({cat.pct}%)</span>
                </div>
                <div style={{ width: '100%', height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${cat.pct}%`, height: '100%', background: cat.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Country Performance */}
        <div className="adminCard">
          <div className="cardSectionHead">
            <span className="cardSectionTitle">GEOGRAPHIC REACH & GROWTH</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>Cross-border</span>
          </div>

          <table className="countryTable">
            <thead>
              <tr>
                <th>Country</th>
                <th>Volume</th>
                <th>Share</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {[
                { country: 'Sweden', cases: 76, share: '32%', delta: '+16,7%', up: true },
                { country: 'United States', cases: 64, share: '27%', delta: '+19,2%', up: true },
                { country: 'Norway', cases: 42, share: '18%', delta: '+8,4%', up: true },
                { country: 'Germany', cases: 38, share: '16%', delta: '+12,3%', up: true },
                { country: 'Denmark', cases: 31, share: '13%', delta: '-2,1%', up: false }
              ].map(item => (
                <tr key={item.country}>
                  <td>
                    <span className="countryName">{item.country}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{item.cases}</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748b', fontSize: 12 }}>{item.share}</span>
                  </td>
                  <td>
                    <span className={`countryDelta ${item.up ? 'up' : 'down'}`}>
                      {item.up ? '↑' : '↓'} {item.delta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
