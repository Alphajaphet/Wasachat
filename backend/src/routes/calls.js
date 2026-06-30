const express = require('express');
const twilio = require('twilio');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/calls/ice-servers
// Returns fresh, short-lived TURN/STUN credentials from Twilio for WebRTC calls.
// Twilio tokens expire (default ~1hr), so the frontend should fetch this right
// before starting a call rather than caching it long-term.
router.get('/ice-servers', async (req, res) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.error('Twilio credentials not configured');
    return res.status(500).json({ error: 'Calling is not configured on this server' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const token = await client.tokens.create();
    res.json({ iceServers: token.iceServers });
  } catch (err) {
    console.error('Twilio token error:', err);
    res.status(500).json({ error: 'Failed to get calling credentials' });
  }
});

module.exports = router;