const express = require('express');
const pool = require('../db/pool');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// POST /api/statuses - create a new status post (expires in 24h)
router.post('/', async (req, res) => {
  const { content, mediaUrl, mediaType, backgroundColor } = req.body;
  if (!content && !mediaUrl) {
    return res.status(400).json({ error: 'Status must have content or media' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO statuses (user_id, content, media_url, media_type, background_color)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, content || null, mediaUrl || null, mediaType || 'text', backgroundColor || null]
    );
    res.status(201).json({ status: result.rows[0] });
  } catch (err) {
    console.error('Create status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/statuses - get active statuses from contacts (not expired)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.display_name, u.avatar_url,
              EXISTS(SELECT 1 FROM status_views v WHERE v.status_id = s.id AND v.viewer_id = $1) AS viewed_by_me
       FROM statuses s
       JOIN users u ON u.id = s.user_id
       WHERE s.expires_at > NOW()
         AND (s.user_id = $1 OR s.user_id IN (
           SELECT contact_id FROM contacts WHERE user_id = $1
         ))
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ statuses: result.rows });
  } catch (err) {
    console.error('List statuses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/statuses/:id/view - mark a status as viewed
router.post('/:id/view', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO status_views (status_id, viewer_id) VALUES ($1, $2)
       ON CONFLICT (status_id, viewer_id) DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('View status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;