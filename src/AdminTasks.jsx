import React, { useState } from 'react';
import {
  Check,
  Plus,
  Calendar,
  Paperclip,
  Clock,
  Filter,
  CheckCircle2,
  X,
  AlertCircle
} from 'lucide-react';
import './admin-theme.css';

export default function AdminTasks({ onNavigate }) {
  const [filter, setFilter] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('Medium');
  const [newTaskDue, setNewTaskDue] = useState('May 28, 2024');
  const [taskFormError, setTaskFormError] = useState('');

  const [tasks, setTasks] = useState([
    {
      id: 1,
      title: 'Review IP assignment for Nike fraud case',
      desc: 'Verify the document signatures and cross-reference with trademark registries.',
      priority: 'High',
      status: 'TODO',
      dueDate: 'May 24, 2024',
      attachment: 'Nike fraud.doc',
      assignee: 'Erik Gunsel'
    },
    {
      id: 2,
      title: 'Verify Peter Frank brokerage licensing renewal',
      desc: 'Confirm the active status on TREC commission portal and update internal index.',
      priority: 'Medium',
      status: 'IN_PROGRESS',
      dueDate: 'May 25, 2024',
      attachment: 'Requirements.doc',
      assignee: 'Emily Smith'
    },
    {
      id: 3,
      title: 'Approve pending referral fee escrow release',
      desc: 'Audit the 25% referral commission split agreement for Austin downtown transaction.',
      priority: 'Low',
      status: 'TODO',
      dueDate: 'May 26, 2024',
      attachment: 'New case.doc',
      assignee: 'Arthur Adelk'
    },
    {
      id: 4,
      title: 'Conduct weekly Swedish commercial case triage',
      desc: 'Re-assign active cases to primary partners and check response latencies.',
      priority: 'Medium',
      status: 'TODO',
      dueDate: 'May 27, 2024',
      attachment: 'Sweden_cases.xlsx',
      assignee: 'Mark Wahlberg'
    },
    {
      id: 5,
      title: 'Security audit on OAuth redirect URI configurations',
      desc: 'Ensure authorized domains match production Firebase app deployment URL.',
      priority: 'High',
      status: 'TODO',
      dueDate: 'May 28, 2024',
      attachment: 'Security_audit.doc',
      assignee: 'Peter Frank'
    },
    {
      id: 6,
      title: 'Prepare monthly platform analytics report',
      desc: 'Collate trends for +14.88% case growth and present to leadership.',
      priority: 'Low',
      status: 'DONE',
      dueDate: 'May 20, 2024',
      attachment: 'Monthly_Trends.pdf',
      assignee: 'Emily Smith'
    }
  ]);

  const toggleTaskStatus = (id) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === id
          ? { ...t, status: t.status === 'DONE' ? 'TODO' : 'DONE' }
          : t
      )
    );
  };

  const handleCreateTask = (e) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (title.length < 3 || title.length > 120) { setTaskFormError('Task title must be between 3 and 120 characters.'); return; }
    if (!['Low', 'Medium', 'High'].includes(newTaskPriority)) { setTaskFormError('Choose a valid task priority.'); return; }
    if (!newTaskDue.trim() || Number.isNaN(Date.parse(newTaskDue))) { setTaskFormError('Enter a valid due date.'); return; }
    const newTask = {
      id: Date.now(),
      title,
      desc: 'Created via admin task console.',
      priority: newTaskPriority,
      status: 'TODO',
      dueDate: newTaskDue,
      attachment: 'New case.doc',
      assignee: 'Peter Frank'
    };
    setTasks([newTask, ...tasks]);
    setNewTaskTitle('');
    setTaskFormError('');
    setShowAddModal(false);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'TODO') return t.status === 'TODO';
    if (filter === 'IN_PROGRESS') return t.status === 'IN_PROGRESS';
    if (filter === 'DONE') return t.status === 'DONE';
    return true;
  });

  const pendingCount = tasks.filter(t => t.status !== 'DONE').length;

  return (
    <div className="dashboardGrid">
      {/* Page Header */}
      <div className="pageHeader">
        <div className="pageHeaderLeft">
          <h1>Tasks Management</h1>
          <p>You have {pendingCount} open tasks requiring review and assignment.</p>
        </div>
        <button className="adminBtnPrimary" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="tabFilterRow">
        <button
          className={`filterChip ${filter === 'ALL' ? 'active' : ''}`}
          onClick={() => setFilter('ALL')}
        >
          All Tasks <span className="chipCount">{tasks.length}</span>
        </button>
        <button
          className={`filterChip ${filter === 'TODO' ? 'active' : ''}`}
          onClick={() => setFilter('TODO')}
        >
          To Do <span className="chipCount">{tasks.filter(t => t.status === 'TODO').length}</span>
        </button>
        <button
          className={`filterChip ${filter === 'IN_PROGRESS' ? 'active' : ''}`}
          onClick={() => setFilter('IN_PROGRESS')}
        >
          In Progress <span className="chipCount">{tasks.filter(t => t.status === 'IN_PROGRESS').length}</span>
        </button>
        <button
          className={`filterChip ${filter === 'DONE' ? 'active' : ''}`}
          onClick={() => setFilter('DONE')}
        >
          Completed <span className="chipCount">{tasks.filter(t => t.status === 'DONE').length}</span>
        </button>
      </div>

      {/* Tasks Grid */}
      <div className="tasksGrid">
        {filteredTasks.map(task => (
          <div key={task.id} className="taskCard">
            <div className="taskCardTop">
              <span className={`priorityPill ${task.priority.toLowerCase()}`}>
                {task.priority}
              </span>
              <div
                className={`customCheckbox ${task.status === 'DONE' ? 'checked' : ''}`}
                onClick={() => toggleTaskStatus(task.id)}
                title={task.status === 'DONE' ? 'Mark incomplete' : 'Mark complete'}
              >
                {task.status === 'DONE' && <Check size={12} strokeWidth={3} />}
              </div>
            </div>

            <h3
              className="taskCardTitle"
              style={{
                textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
                opacity: task.status === 'DONE' ? 0.6 : 1
              }}
            >
              {task.title}
            </h3>

            <p className="taskCardDesc">{task.desc}</p>

            <div className="taskCardFooter">
              <span className="attachmentPill">
                <Paperclip size={12} />
                <span>{task.attachment}</span>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748b' }}>
                <Calendar size={13} color="#94a3b8" />
                <span>{task.dueDate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="adminModalOverlay" onClick={() => setShowAddModal(false)}>
          <div className="adminModalCard" onClick={e => e.stopPropagation()}>
            <div className="modalHeader">
              <h3>Create New Admin Task</h3>
              <button className="modalCloseBtn" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {taskFormError && <p role="alert" style={{ margin: 0, color: '#b42318', fontSize: 12 }}>{taskFormError}</p>}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="e.g. Audit license credentials for new Swedish broker"
                  value={newTaskTitle}
                  onChange={e => { setNewTaskTitle(e.target.value); setTaskFormError(''); }}
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 12,
                    border: '1.5px solid #cbd5e1',
                    padding: '0 14px',
                    fontFamily: 'inherit',
                    fontSize: 13,
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value)}
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      padding: '0 12px',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      background: '#fff'
                    }}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    Due Date
                  </label>
                  <input
                    type="text"
                    value={newTaskDue}
                    onChange={e => setNewTaskDue(e.target.value)}
                    style={{
                      width: '100%',
                      height: 42,
                      borderRadius: 12,
                      border: '1.5px solid #cbd5e1',
                      padding: '0 14px',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" className="adminBtnOutline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="adminBtnPrimary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
