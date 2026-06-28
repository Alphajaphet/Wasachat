const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Helper: get or create a conversation between two users (order-independent)
async function getOrCreateConversation(userA, userB) {
  const [userOne, userTwo] = [userA, userB].sort();

  const existing = await pool.query(
    'SELECT * FROM conversations WHERE user_one_id = $1 AND user_two_id = $2',
    [userOne, userTwo]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await pool.query(
    'INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1, $2) RETURNING *',
    [userOne, userTwo]
  );
  return created.rows[0];
}

// GET /api/conversations - list all conversations with last message preview
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id AS conversation_id,
              other.id AS other_user_id, other.display_name, other.avatar_url,
              other.is_online, other.last_seen,
              lm.content AS last_message, lm.created_at AS last_message_at, lm.sender_id AS last_message_sender_id,
              (SELECT COUNT(*) FROM messages m2
                WHERE m2.conversation_id = c.id AND m2.sender_id != $1 AND m2.status != 'read') AS unread_count
       FROM conversations c
       JOIN users other ON other.id = (CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END)
       LEFT JOIN LATERAL (
         SELECT content, created_at, sender_id FROM messages
         WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
       ) lm ON true
       WHERE c.user_one_id = $1 OR c.user_two_id = $1
       ORDER BY lm.created_at DESC NULLS LAST`,
      [req.user.id]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error('List conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/conversations/:otherUserId/messages - get message history
router.get('/:otherUserId/messages', async (req, res) => {
  try {
    const conversation = await getOrCreateConversation(req.user.id, req.params.otherUserId);

    const result = await pool.query(
      `SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [conversation.id]
    );

    await pool.query(
      `UPDATE messages SET status = 'read'
       WHERE conversation_id = $1 AND sender_id != $2 AND status != 'read'`,
      [conversation.id, req.user.id]
    );

    res.json({ conversationId: conversation.id, messages: result.rows });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.getOrCreateConversation = getOrCreateConversation;