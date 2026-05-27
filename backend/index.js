require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const { requireAdmin } = require('./middleware/auth')
const studentsRouter = require('./routes/students')
const templatesRouter = require('./routes/templates')
const confirmationsRouter = require('./routes/confirmations')
const settingsRouter = require('./routes/settings')
const qrRouter = require('./routes/qr')
const adminsRouter = require('./routes/admins')
const submissionsRouter = require('./routes/submissions')

const app = express()

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'https://*.supabase.co'],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
}))

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : []

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
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

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } })
const lookupLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many lookup attempts.' } })
const confirmLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many confirmation attempts.' } })
const submissionLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } })
const qrBulkLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many QR bulk operations. Please try again later.' } })

app.use('/api', generalLimiter)
app.use('/api/students/lookup', lookupLimiter)
app.use('/api/confirmations', confirmLimiter)
app.use('/api/submissions', (req, res, next) => { if (req.method === 'POST') return submissionLimiter(req, res, next); next() })
app.use(['/api/qr/generate-all', '/api/qr/regenerate-all'], qrBulkLimiter)

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

app.use('/api/students', studentsRouter)
app.use('/api/confirmations', confirmationsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/qr', qrRouter)
app.use('/api/admins', adminsRouter)
app.use('/api/submissions', submissionsRouter)

app.get('/api/auth/me', requireAdmin, async (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.userRole })
})

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`LMSA ID Portal backend running on port ${PORT}`)
  console.log(`CORS origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'all (dev mode)'}`)
})
