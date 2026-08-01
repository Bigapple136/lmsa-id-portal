require('dotenv').config()
const { validateEnv } = require('./env')
validateEnv()

const logger = require('./logger')
const Sentry = require('@sentry/node')
const express = require('express')
// Patch Express 4 so a rejected promise from any async route handler or async
// middleware is forwarded to the error middleware instead of escaping as an
// unhandledRejection that would otherwise take down the whole process.
require('express-async-errors')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const { requireAdmin } = require('./middleware/auth')
const studentsRouter = require('./routes/students')
const templatesRouter = require('./routes/templates')
const confirmationsRouter = require('./routes/confirmations')
const settingsRouter = require('./routes/settings')
const qrRouter = require('./routes/qr')
const adminsRouter = require('./routes/admins')
const submissionsRouter = require('./routes/submissions')
const backupRouter = require('./routes/backup')
const notificationsRouter = require('./routes/notifications')
const analyticsRouter = require('./routes/analytics')

const app = express()

// Trust proxy for correct IP detection behind load balancers (Render, etc.)
app.set('trust proxy', 1)

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  })
  app.use(Sentry.Handlers.requestHandler())
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
  }),
)

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : []

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}

app.use(cors(corsOptions))

app.use(express.json({ limit: '50kb' }))

if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'))
} else {
  app.use(morgan('dev'))
}

// Rate limiters — per-IP tracking via express-rate-limit (requires trust proxy)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
})
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup attempts. Please try again later.' },
})
const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many confirmation attempts.' },
})
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
})
const qrBulkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many QR bulk operations. Please try again later.' },
})

app.use('/api', generalLimiter)
app.use('/api/students/lookup', lookupLimiter)
app.use('/api/confirmations', confirmLimiter)
app.use('/api/submissions', (req, res, next) => {
  if (req.method === 'POST') return submissionLimiter(req, res, next)
  next()
})
app.use(['/api/qr/generate-all', '/api/qr/regenerate-all'], qrBulkLimiter)

app.use('/api/students', studentsRouter)
app.use('/api/confirmations', confirmationsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/qr', qrRouter)
app.use('/api/admins', adminsRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/backup', backupRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/analytics', analyticsRouter)

app.get('/api/auth/me', requireAdmin, async (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.userRole })
})

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

// ---- Global Express error handler ----
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler())
}

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || (err instanceof SyntaxError ? 400 : 500)
  const message = status >= 500 ? 'Internal server error.' : err.message
  if (status >= 500) {
    logger.error({ err, method: req.method, url: req.originalUrl }, 'Server error')
  }
  res.status(status).json({ error: message })
})

function createServer() {
  return app
}

function startServer() {
  const PORT = process.env.PORT || 4000
  const server = app.listen(PORT, () => {
    const pid = process.pid
    logger.info({ port: pid, env: process.env.NODE_ENV || 'development' }, 'Server started')
    logger.info(
      { origins: allowedOrigins.length ? allowedOrigins.join(', ') : 'none (set ALLOWED_ORIGINS)' },
      'CORS configured',
    )
  })

  function shutdown(signal) {
    logger.info({ signal }, 'Shutting down gracefully')
    const forceExit = setTimeout(() => {
      logger.error('Forced exit after timeout')
      process.exit(1)
    }, 10000)
    forceExit.unref()
    server.close(() => {
      logger.info('HTTP server closed')
      clearTimeout(forceExit)
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

// ---- Unhandled rejections / exceptions ----
// One failed promise (a DB call, a network request, a background task) must
// never be able to take down the entire backend. Rejected promises inside
// request handlers are routed to the Express error middleware by
// express-async-errors above, so anything reaching here is a non-request
// background task — log it and keep serving.
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection — continuing')
})
// An uncaught synchronous exception usually means corrupted state; let the
// process exit so the hosting platform (or cluster primary) restarts a fresh
// worker rather than continuing in an undefined state.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting for restart')
  process.exit(1)
})

module.exports = { createServer, startServer, app }

// Auto-start when run directly (not via cluster.js or test)
if (require.main === module) {
  startServer()
}
