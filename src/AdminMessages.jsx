import React, { useState } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Search,
  MoreVertical,
  CheckCheck,
  Circle
} from 'lucide-react';
import './admin-theme.css';

export default function AdminMessages({ initialContact = 'Mark Wahlberg' }) {
  const [activeContactId, setActiveContactId] = useState(initialContact);
  const [inputText, setInputText] = useState('');
  const [composeError, setComposeError] = useState('');

  const [contacts, setContacts] = useState([
    {
      id: 'Mark Wahlberg',
      name: 'Mark Wahlberg',
      role: 'Swedish Commercial Lead',
      avatarColor: '#3b82f6',
      initials: 'MW',
      online: true,
      lastMessage: 'Lorem ipsum dolor sit amet consectetur. Ut turpis lectus...',
      time: '2 days ago',
      unread: true,
      messages: [
        { id: 1, sender: 'them', text: 'Lorem ipsum dolor sit amet consectetur. Ut turpis lectus adipiscing leo leo in non tristique. Nulla orci...', time: '2 days ago' },
        { id: 2, sender: 'me', text: 'Hi Mark, we received the documentation. Our legal team is doing the final checks on the dual-state commission split.', time: 'Yesterday 4:15 PM' },
        { id: 3, sender: 'them', text: 'Perfect. Let me know as soon as the escrow confirmation is attached.', time: 'Yesterday 5:20 PM' }
      ]
    },
    {
      id: 'Leonardo DiCaprio',
      name: 'Leonardo DiCaprio',
      role: 'Scandinavia Luxury Partner',
      avatarColor: '#10b981',
      initials: 'LD',
      online: true,
      lastMessage: 'Lorem ipsum dolor sit amet consectetur...',
      time: '3 days ago',
      unread: false,
      messages: [
        { id: 1, sender: 'them', text: 'Lorem ipsum dolor sit amet consectetur. Ut turpis lectus adipiscing leo leo in non tristique. Nulla orci...', time: '3 days ago' },
        { id: 2, sender: 'me', text: 'Thanks Leonardo, review is underway.', time: '2 days ago' }
      ]
    },
    {
      id: 'Erik Gunsel',
      name: 'Erik Gunsel',
      role: 'Legal & Intellectual Property Counsel',
      avatarColor: '#8b5cf6',
      initials: 'EG',
      online: true,
      lastMessage: 'Nike fraud case files have been uploaded to the library.',
      time: '4 days ago',
      unread: false,
      messages: [
        { id: 1, sender: 'them', text: 'Nike fraud case files have been uploaded to the library.', time: '4 days ago' },
        { id: 2, sender: 'me', text: 'Great work Erik. We have flagged it for priority review.', time: '4 days ago' }
      ]
    },
    {
      id: 'Emily Smith',
      name: 'Emily Smith',
      role: 'Senior Verification Specialist',
      avatarColor: '#ec4899',
      initials: 'ES',
      online: true,
      lastMessage: '3 broker licenses are awaiting your approval signature.',
      time: '5 days ago',
      unread: false,
      messages: [
        { id: 1, sender: 'them', text: '3 broker licenses are awaiting your approval signature in the verification queue.', time: '5 days ago' }
      ]
    },
    {
      id: 'Arthur Adelk',
      name: 'Arthur Adelk',
      role: 'Operations & Compliance Lead',
      avatarColor: '#f59e0b',
      initials: 'AA',
      online: false,
      lastMessage: 'Quarterly compliance audit completed with zero flags.',
      time: '1 week ago',
      unread: false,
      messages: [
        { id: 1, sender: 'them', text: 'Quarterly compliance audit completed with zero flags. All good to proceed.', time: '1 week ago' }
      ]
    }
  ]);

  const activeContact = contacts.find(c => c.id === activeContactId) || contacts[0];

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (text.length < 1 || text.length > 2000) { setComposeError('Message must be between 1 and 2,000 characters.'); return; }

    const newMsg = {
      id: Date.now(),
      sender: 'me',
      text,
      time: 'Just now'
    };

    setContacts(prev =>
      prev.map(c =>
        c.id === activeContact.id
          ? { ...c, messages: [...c.messages, newMsg], lastMessage: text, time: 'Just now' }
          : c
      )
    );
    setInputText('');
    setComposeError('');
  };

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Communication & Messages</h1>
          <p>Direct communication channel with your team, verified professionals, and partners.</p>
        </div>
      </div>

      <div className="messagesShell">
        {/* Left Contacts Sidebar */}
        <div className="chatSidebar">
          <div className="chatSidebarHead">
            <span>Conversations</span>
          </div>

          <div className="chatContactsList">
            {contacts.map(c => (
              <button
                key={c.id}
                className={`chatContactItem ${c.id === activeContact.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveContactId(c.id);
                  setContacts(prev =>
                    prev.map(item => item.id === c.id ? { ...item, unread: false } : item)
                  );
                }}
              >
                <div className="chatContactAvatar">
                  <div className="avatarPh" style={{ background: c.avatarColor }}>
                    {c.initials}
                  </div>
                  {c.online && <span className="onlineDot" />}
                </div>

                <div className="chatContactInfo">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <span className="chatContactName">{c.name}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{c.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p className="chatContactPreview">{c.lastMessage}</p>
                    {c.unread && <span className="unreadRedDot" />}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Active Chat Pane */}
        <div className="chatMainArea">
          {/* Top Bar */}
          <div className="chatTopBar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="chatContactAvatar">
                <div className="avatarPh" style={{ background: activeContact.avatarColor }}>
                  {activeContact.initials}
                </div>
                {activeContact.online && <span className="onlineDot" />}
              </div>
              <div>
                <h3 style={{ margin: '0 0 2px 0', fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                  {activeContact.name}
                </h3>
                <span style={{ fontSize: 11.5, color: '#64748b' }}>
                  {activeContact.role} · {activeContact.online ? 'Online now' : 'Offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Messages Flow */}
          <div className="chatMessagesFlow">
            {activeContact.messages.map(m => (
              <div key={m.id} className={`bubbleRow ${m.sender}`}>
                <div className="chatBubble">
                  {m.text}
                </div>
                <span className="chatBubbleTime">{m.time}</span>
              </div>
            ))}
          </div>

          {/* Composer */}
          <form className="chatComposeBar" onSubmit={handleSend}>
            {composeError && <span role="alert" className="chatComposeError">{composeError}</span>}
            <input
              type="text"
              required
              maxLength={2000}
              aria-label="Message"
              className="chatComposeInput"
              placeholder={`Reply to ${activeContact.name.split(' ')[0]}...`}
              value={inputText}
              onChange={e => { setInputText(e.target.value); setComposeError(''); }}
            />
            <button
              type="submit"
              className="adminBtnPrimary"
              style={{ padding: '0 16px', height: 40 }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
