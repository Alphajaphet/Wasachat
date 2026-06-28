import { useState } from 'react';
import api from '../lib/api';

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Sidebar({ user, conversations, activeContact, onSelect, onLogout, onContactAdded }) {
  const [tab, setTab] = useState('chats');
  const [addPhone, setAddPhone] = useState('');
  const [addError, setAddError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  async function handleAddContact(e) {
    e.preventDefault();
    setAddError('');
    try {
      const { data } = await api.post('/contacts', { phone: addPhone });
      onContactAdded(data.contact);
      setAddPhone('');
      setShowAddForm(false);
    } catch (err) {
      setAddError(err.response?.data?.error || 'Could not add contact');
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <div className="avatar">{initials(user.display_name)}</div>
          <div className="sidebar-header-name">{user.display_name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={() => setShowAddForm((s) => !s)} title="Add contact">＋</button>
          <button className="logout-btn" onClick={onLogout}>Log out</button>
        </div>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddContact} style={{ padding: 14, borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 8 }}>
          <input
            placeholder="Phone number to add"
            value={addPhone}
            onChange={(e) => setAddPhone(e.target.value)}
            style={{ flex: 1, padding: 8, border: '1px solid var(--border-light)', borderRadius: 6 }}
          />
          <button className="btn-primary" style={{ width: 'auto', padding: '8px 14px' }} type="submit">Add</button>
        </form>
      )}
      {addError && <div className="auth-error" style={{ margin: 10 }}>{addError}</div>}

      <div className="sidebar-tabs">
        <button className={`sidebar-tab ${tab === 'chats' ? 'active' : ''}`} onClick={() => setTab('chats')}>Chats</button>
        <button className={`sidebar-tab ${tab === 'status' ? 'active' : ''}`} onClick={() => setTab('status')}>Status</button>
      </div>

      {tab === 'chats' && (
        <div className="sidebar-list">
          {conversations.length === 0 && (
            <div className="empty-state">
              <p>No conversations yet.</p>
              <p style={{ fontSize: 13, marginTop: 6 }}>Add a contact by phone number to start chatting.</p>
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.other_user_id}
              className={`conversation-item ${activeContact?.other_user_id === c.other_user_id ? 'active' : ''}`}
              onClick={() => onSelect(c)}
            >
              <div className="avatar">{initials(c.display_name)}</div>
              <div className="conversation-info">
                <div className="conversation-top-row">
                  <span className="conversation-name">{c.display_name}</span>
                  <span className="conversation-time">{formatTime(c.last_message_at)}</span>
                </div>
                <div className="conversation-preview">{c.last_message || 'Say hello 👋'}</div>
              </div>
              {Number(c.unread_count) > 0 && <div className="unread-badge">{c.unread_count}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'status' && <StatusTab />}
    </div>
  );
}

function StatusTab() {
  const [statuses, setStatuses] = useState([]);
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#075E54');
  const [viewing, setViewing] = useState(null);
  const colors = ['#075E54', '#128C7E', '#34495E', '#8E44AD', '#C0392B', '#2980B9'];

  async function loadStatuses() {
    const { data } = await api.get('/statuses');
    setStatuses(data.statuses);
  }

  useState(() => { loadStatuses(); }, []);

  async function postStatus(e) {
    e.preventDefault();
    if (!content.trim()) return;
    await api.post('/statuses', { content, backgroundColor: color, mediaType: 'text' });
    setContent('');
    loadStatuses();
  }

  async function viewStatus(s) {
    setViewing(s);
    await api.post(`/statuses/${s.id}/view`);
    loadStatuses();
  }

  return (
    <div className="sidebar-list">
      <form className="status-composer" onSubmit={postStatus}>
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={200}
        />
        <div className="status-color-swatches">
          {colors.map((c) => (
            <button
              type="button"
              key={c}
              className={`status-swatch ${color === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <button className="btn-primary" type="submit">Post status</button>
      </form>

      {statuses.map((s) => (
        <div key={s.id} className="status-list-item" onClick={() => viewStatus(s)} style={{ cursor: 'pointer' }}>
          <div className={`status-ring ${s.viewed_by_me ? 'viewed' : ''}`}>
            <div className="avatar" style={{ width: 40, height: 40 }}>{initials(s.display_name)}</div>
          </div>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{s.display_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}

      {viewing && (
        <div className="status-viewer-overlay" onClick={() => setViewing(null)}>
          <div className="status-viewer-card" style={{ background: viewing.background_color || '#075E54' }} onClick={(e) => e.stopPropagation()}>
            <button className="status-viewer-close" onClick={() => setViewing(null)}>×</button>
            {viewing.content}
          </div>
        </div>
      )}
    </div>
  );
}