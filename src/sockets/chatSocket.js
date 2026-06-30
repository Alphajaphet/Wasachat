 const { verifySocketToken } = require('../middleware/auth');
const pool = require('../db/pool');
const { getOrCreateConversation } = require('../routes/conversations');

const onlineUsers = new Map();

function addOnlineSocket(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}

function removeOnlineSocket(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
}

function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

function initSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication token required'));

    const decoded = verifySocketToken(token);
    if (!decoded) return next(new Error('Invalid or expired token'));

    socket.userId = decoded.id;
    next();
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    console.log(`Socket connected: user ${userId} (${socket.id})`);

    addOnlineSocket(userId, socket.id);
    socket.join(`user:${userId}`);

    await pool.query('UPDATE users SET is_online = TRUE WHERE id = $1', [userId]);
    socket.broadcast.emit('presence:update', { userId, isOnline: true });

    socket.on('message:send', async (data, callback) => {
      const { recipientId, content } = data;
      if (!recipientId || !content?.trim()) {
        return callback?.({ error: 'recipientId and content are required' });
      }

      try {
        const conversation = await getOrCreateConversation(userId, recipientId);

        const result = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, content, status)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [conversation.id, userId, content.trim(), isUserOnline(recipientId) ? 'delivered' : 'sent']
        );

        const message = result.rows[0];

        io.to(`user:${recipientId}`).emit('message:new', message);
        callback?.({ message });

        io.to(`user:${recipientId}`).emit('typing:stop', { userId });
      } catch (err) {
        console.error('Socket message:send error:', err);
        callback?.({ error: 'Failed to send message' });
      }
    });

    socket.on('typing:start', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${recipientId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${recipientId}`).emit('typing:stop', { userId });
    });

    socket.on('message:read', async ({ conversationId, senderId }) => {
      try {
        await pool.query(
          `UPDATE messages SET status = 'read' WHERE conversation_id = $1 AND sender_id = $2 AND status != 'read'`,
          [conversationId, senderId]
        );
        io.to(`user:${senderId}`).emit('message:read', { conversationId, readBy: userId });
      } catch (err) {
        console.error('Socket message:read error:', err);
      }
    });

    // --- WebRTC call signaling ---
    socket.on('call:invite', ({ recipientId, callType }) => {
      if (!recipientId) return;
      io.to(`user:${recipientId}`).emit('call:invite', {
        callerId: userId,
        callType: callType === 'video' ? 'video' : 'audio',
      });
    });

    socket.on('call:offer', ({ recipientId, offer }) => {
      if (!recipientId || !offer) return;
      io.to(`user:${recipientId}`).emit('call:offer', { callerId: userId, offer });
    });

    socket.on('call:answer', ({ recipientId, answer }) => {
      if (!recipientId || !answer) return;
      io.to(`user:${recipientId}`).emit('call:answer', { responderId: userId, answer });
    });

    socket.on('call:ice-candidate', ({ recipientId, candidate }) => {
      if (!recipientId || !candidate) return;
      io.to(`user:${recipientId}`).emit('call:ice-candidate', { senderId: userId, candidate });
    });

    socket.on('call:reject', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${recipientId}`).emit('call:reject', { responderId: userId });
    });

    socket.on('call:end', ({ recipientId }) => {
      if (!recipientId) return;
      io.to(`user:${recipientId}`).emit('call:end', { senderId: userId });
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: user ${userId} (${socket.id})`);
      const wentFullyOffline = removeOnlineSocket(userId, socket.id);

      if (wentFullyOffline) {
        const now = new Date();
        await pool.query('UPDATE users SET is_online = FALSE, last_seen = $1 WHERE id = $2', [now, userId]);
        socket.broadcast.emit('presence:update', { userId, isOnline: false, lastSeen: now });
      }
    });
  });
}

module.exports = { initSocket, isUserOnline };