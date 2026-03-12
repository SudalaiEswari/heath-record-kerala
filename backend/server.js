// server.js – Health Record Kerala Backend
require('dotenv').config();

const express     = require('express');
const mongoose    = require('mongoose');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const authRoutes    = require('./routes/Auth');
const recordRoutes  = require('./routes/Records');
const userRoutes    = require('./routes/Users');
const contactRoutes = require('./routes/contact');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Security Middleware ──────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:5500',   // Live Server
    'http://127.0.0.1:5500',
    'null',                    // file:// opened directly
  ],
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests.' });
const authLimiter   = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: 'Too many auth attempts. Try later.' });
app.use(globalLimiter);
app.use('/api/auth', authLimiter);

// ─── Body Parsers ─────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files (uploads) ───────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health Check ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Health Record Kerala API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'OK', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/contact', contactRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
  });
});

// ─── Database & Start ─────────────────────────────────────────────────────
const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`\n🚀 Health Record Kerala API`);
      console.log(`   Server  : http://localhost:${PORT}`);
      console.log(`   API     : http://localhost:${PORT}/api`);
      console.log(`   Env     : ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('\n⚠️  Running in DEMO mode (no database). Frontend still works.\n');
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT} (demo mode)`);
    });
  }
};

startServer();