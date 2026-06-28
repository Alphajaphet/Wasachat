require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const contactsRoutes = require('./routes/contacts');
const conversationsRoutes = require('./routes/conversations');
const statusesRoutes = require('./routes/statuses');
const { initSocket } = require('./sockets/chatSocket');

const app = express();
const server = http.createServer(app);

// --- Security hardening ---
// Helmet sets secure HTTP headers (XSS protection, no-sniff, etc.)
app.use(helmet());

// CORS: only allow your frontend origin in production
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// Rate limiting: protects against brute-force login attempts and API abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter limit on login/register to block brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

// --- Routes ---
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'WasaChat backend' }));
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/statuses', statusesRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler (never leak stack traces to clients)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Socket.io setup ---
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
initSocket(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 WasaChat backend running on port ${PORT}`);
});
