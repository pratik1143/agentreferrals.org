import React, { useState } from 'react';
import {
  Folder,
  FileText,
  Download,
  Search,
  Upload,
  ExternalLink,
  ChevronRight,
  Paperclip,
  CheckCircle2
} from 'lucide-react';
import './admin-theme.css';

export default function AdminLibraries() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState('ALL');

  const files = [
    {
      id: 1,
      name: 'Requirements.doc',
      category: 'Legal',
      size: '2.4 MB',
      updated: 'May 18, 2024',
      downloads: 142,
      desc: 'Master checklist and statutory compliance disclosures for commercial transactions.'
    },
    {
      id: 2,
      name: 'New case.doc',
      category: 'Case Templates',
      size: '1.8 MB',
      updated: 'May 18, 2024',
      downloads: 89,
      desc: 'Standard intake questionnaire and verification mandate template.'
    },
    {
      id: 3,
      name: 'Nike fraud.doc',
      category: 'Audit & Fraud',
      size: '4.1 MB',
      updated: 'May 16, 2024',
      downloads: 37,
      desc: 'Full forensic transaction log and disputed communication records.'
    },
    {
      id: 4,
      name: 'Standard Broker Agreement 2024.pdf',
      category: 'Contracts',
      size: '850 KB',
      updated: 'May 10, 2024',
      downloads: 412,
      desc: 'Executed broker-to-broker 25% referral commission split agreement.'
    },
    {
      id: 5,
      name: 'Trademark & IP Guidelines.pdf',
      category: 'Legal',
      size: '1.2 MB',
      updated: 'Apr 28, 2024',
      downloads: 98,
      desc: 'Brand compliance criteria for co-branded marketing collateral.'
    },
    {
      id: 6,
      name: 'Sweden Commercial Dossier.docx',
      category: 'Case Templates',
      size: '3.6 MB',
      updated: 'May 02, 2024',
      downloads: 65,
      desc: 'Cross-border real-estate introduction protocols for Scandinavia.'
    }
  ];

  const filteredFiles = files.filter(f => {
    const matchCat = activeFolder === 'ALL' || f.category === activeFolder;
    const matchSearch = f.name.toLowerCase().includes(searchTerm.toLowerCase()) || f.desc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Libraries & Case Documentation</h1>
          <p>Central repository for legal agreements, audit dossiers, and case requirement files.</p>
        </div>
        <button
          className="adminBtnPrimary"
          onClick={() => alert('Document upload modal initiated. Choose your file.')}
        >
          <Upload size={16} /> Upload Document
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="tabFilterRow">
        <button
          className={`filterChip ${activeFolder === 'ALL' ? 'active' : ''}`}
          onClick={() => setActiveFolder('ALL')}
        >
          All Documents <span className="chipCount">{files.length}</span>
        </button>
        <button
          className={`filterChip ${activeFolder === 'Legal' ? 'active' : ''}`}
          onClick={() => setActiveFolder('Legal')}
        >
          Legal & Compliance
        </button>
        <button
          className={`filterChip ${activeFolder === 'Contracts' ? 'active' : ''}`}
          onClick={() => setActiveFolder('Contracts')}
        >
          Contracts & Splits
        </button>
        <button
          className={`filterChip ${activeFolder === 'Case Templates' ? 'active' : ''}`}
          onClick={() => setActiveFolder('Case Templates')}
        >
          Case Templates
        </button>
        <button
          className={`filterChip ${activeFolder === 'Audit & Fraud' ? 'active' : ''}`}
          onClick={() => setActiveFolder('Audit & Fraud')}
        >
          Audit Records
        </button>
      </div>

      {/* Files Grid */}
      <div className="filesGrid">
        {filteredFiles.map(file => (
          <div
            key={file.id}
            className="fileDocCard"
            onClick={() => alert(`Opening preview for ${file.name}`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="fileIconSquare">
                <FileText size={22} />
              </div>
              <span className="priorityPill medium">{file.category}</span>
            </div>

            <div className="fileDetails">
              <h4>{file.name}</h4>
              <p>{file.desc}</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 10, marginTop: 'auto' }}>
              <span style={{ fontSize: 11.5, color: '#94a3b8' }}>{file.size} · {file.updated}</span>
              <button
                className="adminBtnOutline"
                style={{ padding: '4px 10px', fontSize: 11.5 }}
                onClick={(e) => {
                  e.stopPropagation();
                  alert(`Downloading ${file.name}`);
                }}
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
