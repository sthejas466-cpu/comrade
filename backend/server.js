// Load .env first — must be before any other require
require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { Server }= require('socket.io');
const cors      = require('cors');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet    = require('helmet');

const db = require('./db');

// ─── Config ───────────────────────────────────────────────────────────────────
const JWT_SECRET     = process.env.JWT_SECRET;
const POLE_API_KEY   = process.env.POLE_API_KEY;
const PORT           = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV       = process.env.NODE_ENV || 'development';
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',').map(o => o.trim());

// If localhost is present, also allow 127.0.0.1 to prevent confusing fetch issues
if (CLIENT_ORIGINS.includes('http://localhost:5173') && !CLIENT_ORIGINS.includes('http://127.0.0.1:5173')) {
  CLIENT_ORIGINS.push('http://127.0.0.1:5173');
}

// Add the Vercel production domain to CORS
CLIENT_ORIGINS.push('https://frontend-six-psi-83.vercel.app');

// Guard against running in production without secrets set
if (NODE_ENV === 'production') {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ FATAL: JWT_SECRET must be set in production (min 32 chars)');
    process.exit(1);
  }
  if (!POLE_API_KEY || POLE_API_KEY.length < 16) {
    console.error('❌ FATAL: POLE_API_KEY must be set in production (min 16 chars)');
    process.exit(1);
  }
}

const jwtSecret   = JWT_SECRET || 'comrade_dev_secret_key_2024_local_only';
const poleApiKey  = POLE_API_KEY || 'comrade-pole-hw-key-2024';

// ─── App setup ────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST', 'PATCH'] },
  pingTimeout: 30000,
  pingInterval: 25000,
});

app.set('io', io);
app.set('jwtSecret', jwtSecret);
app.set('poleApiKey', poleApiKey);

io.on('connection', (socket) => {
  if (NODE_ENV !== 'production') {
    console.log(`🔌 Client connected: ${socket.id}`);
  }
  socket.on('disconnect', () => {
    if (NODE_ENV !== 'production') {
      console.log(`❌ Client disconnected: ${socket.id}`);
    }
  });
});

// ─── Security middleware ───────────────────────────────────────────────────────
// Helmet: sets secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Chart.js
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, hardware poles)
    if (!origin) return callback(null, true);
    if (CLIENT_ORIGINS.includes(origin) || CLIENT_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Pole-Key'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '256kb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,     // 1 minute
  max: 300,                 // 300 req/min per IP for dashboard
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const hardwareLimiter = rateLimit({
  windowMs: 10 * 1000,     // 10 seconds
  max: 20,                  // 20 req/10s per IP for hardware poles
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});

app.use('/api', apiLimiter);
app.use('/api/pole-alert',   hardwareLimiter);
app.use('/api/pole-command', hardwareLimiter);

// Request logging in development
if (NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    const ts = new Date().toLocaleTimeString();
    console.log(`[${ts}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── JWT Auth middleware ───────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — token required' });
  }
  try {
    req.user = jwt.verify(auth.split(' ')[1], jwtSecret);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: msg });
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
// Pass config to route modules via app.locals
app.locals.jwtSecret  = jwtSecret;
app.locals.poleApiKey = poleApiKey;

// Public
app.use('/api/auth', require('./routes/auth'));
app.use('/api',      require('./routes/hardware')); // /api/pole-alert, /api/pole-command

// Protected
app.use('/api/poles',    authenticate, require('./routes/poles'));
app.use('/api/alerts',   authenticate, require('./routes/alerts'));
app.use('/api/commands', authenticate, require('./routes/commands'));

// Stats
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const totalPolesRow = await db.prepare('SELECT COUNT(*) as cnt FROM poles').get();
    const onlinePolesRow = await db.prepare("SELECT COUNT(*) as cnt FROM poles WHERE status='online'").get();
    const activeAlertsRow = await db.prepare("SELECT COUNT(*) as cnt FROM alerts WHERE status='active'").get();

    const today = new Date(); today.setHours(0,0,0,0);
    const resolvedTodayRow = await db.prepare(
      "SELECT COUNT(*) as cnt FROM alerts WHERE status='resolved' AND resolved_at >= ?"
    ).get(today.toISOString());

    res.json({ 
      totalPoles: parseInt(totalPolesRow.cnt, 10), 
      onlinePoles: parseInt(onlinePolesRow.cnt, 10), 
      activeAlerts: parseInt(activeAlertsRow.cnt, 10), 
      resolvedToday: parseInt(resolvedTodayRow.cnt, 10) 
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Health check (no auth — used by load balancers)
app.get('/api/health', async (_req, res) => {
  try {
    await db.prepare('SELECT 1').get();
    res.status(200).json({
      status: 'ok',
      service: 'COMRADE Backend',
      env: NODE_ENV,
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      service: 'COMRADE Backend',
      env: NODE_ENV,
      time: new Date().toISOString(),
    });
  }
});

// 404 for unknown API routes
app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  if (err.message?.startsWith('CORS:')) {
    return res.status(403).json({ error: err.message });
  }
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n⏹  ${signal} received — shutting down gracefully…`);
  server.close(() => {
    console.log('✅ HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => { console.error('⚠ Forced exit after 10s'); process.exit(1); }, 10000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { console.error('Uncaught Exception:', err); });
process.on('unhandledRejection', (err) => { console.error('Unhandled Rejection:', err); });

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`
  ██████╗ ██████╗ ███╗   ███╗██████╗  █████╗ ██████╗ ███████╗
 ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔══██╗██╔══██╗██╔════╝
 ██║     ██║   ██║██╔████╔██║██████╔╝███████║██║  ██║█████╗
 ██║     ██║   ██║██║╚██╔╝██║██╔══██╗██╔══██║██║  ██║██╔══╝
 ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║  ██║██║  ██║██████╔╝███████╗
  ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚══════╝
  Smart Emergency Response Network — ${NODE_ENV.toUpperCase()}
  🚨 Listening on http://localhost:${PORT}
  🔒 CORS origins: ${CLIENT_ORIGINS.join(', ')}
  `);
});
