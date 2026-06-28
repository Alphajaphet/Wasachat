import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';

export default function HomePage() {
  const { user, logout } = useAuth();
  const {
    conversations,
    activeContact,
    messages,
    typingUsers,
    onlineUsers,
    openConversation,
    sendMessage,
    notifyTyping,
  } = useChat(user.id);

  const activeContactId = activeContact?.id || activeContact?.other_user_id;
  const isTyping = activeContactId ? !!typingUsers[activeContactId] : false;
  const presence = activeContactId ? onlineUsers[activeContactId] : null;
  const isOnline = presence?.isOnline ?? activeContact?.is_online ?? false;
  const lastSeen = presence?.lastSeen ?? activeContact?.last_seen;

  return (
    <div className="app-shell">
      <Sidebar
        user={user}
        conversations={conversations}
        activeContact={activeContact}
        onSelect={openConversation}
        onLogout={logout}
        onContactAdded={(contact) => openConversation(contact)}
      />
      <ChatWindow
        currentUserId={user.id}
        contact={activeContact}
        messages={messages}
        isTyping={isTyping}
        isOnline={isOnline}
        lastSeen={lastSeen}
        onSend={sendMessage}
        onTyping={notifyTyping}
      />
    </div>
  );
}