import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

export function useChat(currentUserId) {
  const [conversations, setConversations] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [onlineUsers, setOnlineUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  const loadConversations = useCallback(async () => {
    const { data } = await api.get('/conversations');
    setConversations(data.conversations);
  }, []);

  const openConversation = useCallback(async (contact) => {
    setActiveContact(contact);
    const { data } = await api.get(`/conversations/${contact.id || contact.other_user_id}/messages`);
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function onNewMessage(message) {
      setMessages((prev) => {
        if (activeContact && (message.sender_id === activeContact.id || message.sender_id === activeContact.other_user_id)) {
          return [...prev, message];
        }
        return prev;
      });
      loadConversations();
    }

    function onTypingStart({ userId }) {
      setTypingUsers((prev) => ({ ...prev, [userId]: true }));
    }

    function onTypingStop({ userId }) {
      setTypingUsers((prev) => ({ ...prev, [userId]: false }));
    }

    function onPresenceUpdate({ userId, isOnline, lastSeen }) {
      setOnlineUsers((prev) => ({ ...prev, [userId]: { isOnline, lastSeen } }));
    }

    function onMessageRead({ conversationId }) {
      setMessages((prev) => prev.map((m) =>
        m.conversation_id === conversationId ? { ...m, status: 'read' } : m
      ));
    }

    socket.on('message:new', onNewMessage);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresenceUpdate);
    socket.on('message:read', onMessageRead);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresenceUpdate);
      socket.off('message:read', onMessageRead);
    };
  }, [activeContact, loadConversations]);

  const sendMessage = useCallback((content) => {
    if (!activeContact) return;
    const socket = getSocket();
    const recipientId = activeContact.id || activeContact.other_user_id;

    socket.emit('message:send', { recipientId, content }, (res) => {
      if (res?.message) {
        setMessages((prev) => [...prev, res.message]);
        loadConversations();
      }
    });
  }, [activeContact, loadConversations]);

  const notifyTyping = useCallback(() => {
    if (!activeContact) return;
    const socket = getSocket();
    const recipientId = activeContact.id || activeContact.other_user_id;

    socket.emit('typing:start', { recipientId });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { recipientId });
    }, 2000);
  }, [activeContact]);

  return {
    conversations,
    activeContact,
    messages,
    typingUsers,
    onlineUsers,
    openConversation,
    sendMessage,
    notifyTyping,
  };
}