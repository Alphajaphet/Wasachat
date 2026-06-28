const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/contacts - list all contacts for current user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id AS contact_row_id, c.nickname, u.id, u.phone, u.display_name,
              u.avatar_url, u.about, u.is_online, u.last_seen
       FROM contacts c
       JOIN users u ON u.id = c.contact_id
       WHERE c.user_id = $1
       ORDER BY u.display_name ASC`,
      [req.user.id]
    );
    res.json({ contacts: result.rows });
  } catch (err) {
    console.error('List contacts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/contacts - add a contact by phone number
router.post('/', async (req, res) => {
  const { phone, nickname } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  try {
    const userResult = await pool.query('SELECT id, display_name FROM users WHERE phone = $1', [phone]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No WasaChat user found with that phone number' });
    }

    const contactUser = userResult.rows[0];
    if (contactUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot add yourself as a contact' });
    }

    const result = await pool.query(
      `INSERT INTO contacts (user_id, contact_id, nickname)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, contact_id) DO UPDATE SET nickname = EXCLUDED.nickname
       RETURNING id, nickname`,
      [req.user.id, contactUser.id, nickname || null]
    );

    res.status(201).json({ contact: { ...result.rows[0], ...contactUser } });
  } catch (err) {
    console.error('Add contact error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;