import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import { useCall } from '../hooks/useCall';
import Sidebar from '../components/Sidebar';
import ChatWindow from '../components/ChatWindow';
import CallOverlay from '../components/CallOverlay';

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

  const {
    callState,
    callType,
    remoteUserId,
    localStream,
    remoteStream,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  } = useCall(user.id);

  const activeContactId = activeContact?.id || activeContact?.other_user_id;
  const isTyping = activeContactId ? !!typingUsers[activeContactId] : false;
  const presence = activeContactId ? onlineUsers[activeContactId] : null;
  const isOnline = presence?.isOnline ?? activeContact?.is_online ?? false;
  const lastSeen = presence?.lastSeen ?? activeContact?.last_seen;

  const callContact = (() => {
    const targetId = remoteUserId || incomingCall?.callerId;
    if (!targetId) return null;
    if (activeContactId === targetId) return activeContact;
    return conversations.find((c) => c.other_user_id === targetId) || null;
  })();

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
        onAudioCall={() => activeContactId && startCall(activeContactId, 'audio')}
        onVideoCall={() => activeContactId && startCall(activeContactId, 'video')}
      />
      <CallOverlay
        callState={callState}
        callType={callType}
        incomingCall={incomingCall}
        contactName={callContact?.display_name || 'Unknown'}
        localStream={localStream}
        remoteStream={remoteStream}
        onAccept={acceptCall}
        onReject={rejectCall}
        onEnd={endCall}
      />
    </div>
  );
}