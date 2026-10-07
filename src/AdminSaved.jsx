import React, { useState } from 'react';
import {
  Heart,
  Star,
  ExternalLink,
  ChevronRight,
  Bookmark,
  Calendar,
  Paperclip,
  Check
} from 'lucide-react';
import './admin-theme.css';

export default function AdminSaved({ onNavigate }) {
  const [savedCases, setSavedCases] = useState([
    {
      id: 1,
      name: 'Austin Metro Commercial Referral Portfolio',
      category: 'Commercial',
      dates: 'May 18, 2024 - May 25, 2024',
      priority: 'High',
      attachment: 'Listing agreement.pdf',
      starredAt: 'Yesterday'
    },
    {
      id: 2,
      name: 'Nike trademark infringement & escrow review',
      category: 'Intellectual Property',
      dates: 'May 16, 2024 - May 22, 2024',
      priority: 'Medium',
      attachment: 'Nike fraud.doc',
      starredAt: '2 days ago'
    },
    {
      id: 3,
      name: 'Sweden Scandinavian Luxury Estate Introduction',
      category: 'Luxury Residential',
      dates: 'May 04, 2024 - May 20, 2024',
      priority: 'Low',
      attachment: 'Requirements.doc',
      starredAt: 'May 12, 2024'
    }
  ]);

  const removeSaved = (id, e) => {
    e.stopPropagation();
    setSavedCases(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Saved & Bookmarked Cases</h1>
          <p>Quick access to your pinned opportunities, important legal dossiers, and priority reviews.</p>
        </div>
      </div>

      <div className="adminCard">
        <div className="cardSectionHead">
          <span className="cardSectionTitle">PINNED RECORDS ({savedCases.length})</span>
        </div>

        {savedCases.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <Heart size={32} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <p style={{ margin: 0, fontSize: 14 }}>No saved records yet. Click the heart icon on any case to pin it here.</p>
          </div>
        ) : (
          <table className="casesTable">
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Category</th>
                <th>Dates</th>
                <th>Priority</th>
                <th>Attachment</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {savedCases.map(item => (
                <tr key={item.id} className="casesTableRow">
                  <td>
                    <Heart
                      size={16}
                      fill="#ef4444"
                      color="#ef4444"
                      style={{ cursor: 'pointer' }}
                      onClick={e => removeSaved(item.id, e)}
                      title="Unsave"
                    />
                  </td>
                  <td>
                    <span className="caseNameText">{item.name}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, color: '#64748b' }}>{item.category}</span>
                  </td>
                  <td>
                    <span>{item.dates}</span>
                  </td>
                  <td>
                    <span className={`priorityPill ${item.priority.toLowerCase()}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <span className="attachmentPill">
                      <Paperclip size={12} />
                      <span>{item.attachment}</span>
                    </span>
                  </td>
                  <td>
                    <button
                      className="cardActionLink"
                      onClick={() => onNavigate && onNavigate('referrals')}
                    >
                      Open Case <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
