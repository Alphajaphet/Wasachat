import { useState, useEffect, useRef } from 'react';

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function StatusIcon({ status }) {
  if (status === 'read') return <span className="message-status-icon read">✓✓</span>;
  if (status === 'delivered') return <span className="message-status-icon">✓✓</span>;
  return <span className="message-status-icon">✓</span>;
}

export default function ChatWindow({ currentUserId, contact, messages, isTyping, isOnline, lastSeen, onSend, onTyping }) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  function handleChange(e) {
    setDraft(e.target.value);
    onTyping();
  }

  if (!contact) {
    return (
      <div className="chat-window">
        <div className="empty-state" style={{ flex: 1 }}>
          <h2 style={{ color: 'var(--teal-dark)', fontWeight: 400 }}>WasaChat</h2>
          <p style={{ marginTop: 8 }}>Select a conversation to start chatting.</p>
        </div>
      </div>
    );
  }

  const contactId = contact.id || contact.other_user_id;

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="avatar">{initials(contact.display_name)}</div>
        <div>
          <div className="chat-header-name">{contact.display_name}</div>
          <div className={`chat-header-status ${isOnline ? 'online' : ''}`}>
            {isTyping ? 'typing…' : isOnline ? 'online' : lastSeen ? `last seen ${formatTime(lastSeen)}` : ''}
          </div>
        </div>
      </div>

      <div className="messages-area">
        {messages.map((m) => {
          const outgoing = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`message-row ${outgoing ? 'outgoing' : ''}`}>
              <div className={`message-bubble ${outgoing ? 'outgoing' : 'incoming'}`}>
                {m.content}
                <div className="message-meta">
                  <span>{formatTime(m.created_at)}</span>
                  {outgoing && <StatusIcon status={m.status} />}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="message-row">
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          className="composer-input"
          placeholder="Type a message"
          value={draft}
          onChange={handleChange}
        />
        <button className="send-btn" type="submit" disabled={!draft.trim()}>➤</button>
      </form>
    </div>
  );
}