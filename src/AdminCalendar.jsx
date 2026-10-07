import { useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, FileCheck2, FileText, MapPin } from 'lucide-react';
import './admin-calendar.css';

const toDate = value => {
  if (!value) return null;
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const displayDate = date => date?.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }) || 'Date unavailable';
const statusText = value => String(value || 'Submitted').replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function AdminCalendar({ applications = [], referrals = [], agreements = [], onNavigate }) {
  const [month, setMonth] = useState(() => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth(), 1); });
  const [selectedKey, setSelectedKey] = useState(() => dateKey(new Date()));
  const events = useMemo(() => [
    ...applications.map(item => ({ id: `app-${item.id}`, sourceId: item.id, type: 'application', route: 'applications', title: item.referralTitle || item.title || 'Referral application', subtitle: [item.applicantName || item.professionalName || item.userName, statusText(item.status)].filter(Boolean).join(' · '), date: toDate(item.submittedAt || item.appliedAt || item.createdAt) })),
    ...referrals.map(item => ({ id: `ref-${item.id}`, sourceId: item.id, type: 'referral', route: 'referrals', title: item.title || 'Referral posted', subtitle: [item.city, item.state].filter(Boolean).join(', ') || statusText(item.status), date: toDate(item.createdAt || item.publishedAt) })),
    ...agreements.map(item => ({ id: `agreement-${item.id}`, sourceId: item.id, type: 'agreement', route: 'agreements', title: item.title || item.referralTitle || 'Agreement created', subtitle: statusText(item.status), date: toDate(item.createdAt || item.sentAt || item.updatedAt) })),
  ].filter(event => event.date).sort((a, b) => a.date - b.date), [applications, referrals, agreements]);
  const selectedEvents = events.filter(event => dateKey(event.date) === selectedKey);
  const monthEvents = events.filter(event => event.date.getFullYear() === month.getFullYear() && event.date.getMonth() === month.getMonth());
  const calendarDays = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first); start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date; });
  }, [month]);
  const recent = [...events].sort((a, b) => b.date - a.date).slice(0, 6);
  const todayKey = dateKey(new Date());
  const shiftMonth = delta => setMonth(previous => new Date(previous.getFullYear(), previous.getMonth() + delta, 1));

  return <div className="adminView adminCalendarPage">
    <header className="adminCalendarIntro"><div><span className="adminCalendarEyebrow"><CalendarDays size={14}/> OPERATIONS TIMELINE</span><h1>Calendar</h1><p>See when applications, referrals, and agreements were recorded.</p></div><div className="adminCalendarTotal"><strong>{events.length}</strong><span>dated records</span></div></header>
    <div className="adminCalendarLayout">
      <section className="adminCalendarPanel" aria-label="Monthly record calendar">
        <div className="adminCalendarMonthHeader"><div><span>ACTIVITY CALENDAR</span><h2>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2></div><div className="adminCalendarControls"><button onClick={() => { const date = new Date(); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); setSelectedKey(dateKey(date)); }}>Today</button><button aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft size={17}/></button><button aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight size={17}/></button></div></div>
        <div className="adminCalendarWeekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="adminCalendarGrid">{calendarDays.map(date => { const key = dateKey(date); const dayEvents = events.filter(event => dateKey(event.date) === key); return <button key={key} aria-label={`${displayDate(date)}${dayEvents.length ? `, ${dayEvents.length} records` : ''}`} aria-pressed={selectedKey === key} className={`adminCalendarDay ${date.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === todayKey ? 'today' : ''} ${selectedKey === key ? 'selected' : ''}`} onClick={() => setSelectedKey(key)}><span>{date.getDate()}</span>{dayEvents.length > 0 && <i className="adminCalendarDots">{[...new Set(dayEvents.map(event => event.type))].map(type => <b key={type} className={type}/>)}</i>}</button>; })}</div>
        <div className="adminCalendarLegend"><span><i className="application"/>Applications</span><span><i className="referral"/>Referrals</span><span><i className="agreement"/>Agreements</span><small>{monthEvents.length} records this month</small></div>
      </section>
      <aside className="adminCalendarAgenda">
        <section className="adminCalendarPanel adminCalendarSelected"><div className="adminCalendarAgendaHead"><div><span>SELECTED DAY</span><h2>{displayDate(new Date(`${selectedKey}T12:00:00`))}</h2></div><span className="adminCalendarCount">{selectedEvents.length}</span></div>
          {selectedEvents.length ? <div className="adminCalendarEventList">{selectedEvents.map(event => <button key={event.id} className="adminCalendarEvent" onClick={() => onNavigate?.(event.route, event.sourceId)}><i className={event.type}/><span><b>{event.title}</b><small>{event.subtitle}</small><time>{event.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time></span><ArrowRight size={15}/></button>)}</div> : <div className="adminCalendarEmpty"><CalendarDays size={20}/><b>No records on this day</b><span>Select another date to view activity.</span></div>}
        </section>
        <section className="adminCalendarPanel"><div className="adminCalendarAgendaHead"><div><span>RECENTLY RECORDED</span><h2>Latest activity</h2></div><button className="adminCalendarTextLink" onClick={() => onNavigate?.('applications')}>Applications <ArrowRight size={14}/></button></div>
          {recent.length ? <div className="adminCalendarRecent">{recent.map(event => { const Icon = event.type === 'application' ? FileCheck2 : event.type === 'referral' ? MapPin : FileText; return <button key={event.id} onClick={() => onNavigate?.(event.route, event.sourceId)}><span className={`adminCalendarRecentIcon ${event.type}`}><Icon size={15}/></span><span><b>{event.title}</b><small>{event.subtitle}</small></span><time>{event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time></button>; })}</div> : <div className="adminCalendarEmpty"><CalendarDays size={20}/><b>No dated activity yet</b><span>New application and referral dates will appear here.</span></div>}
        </section>
      </aside>
    </div>
  </div>;
}
