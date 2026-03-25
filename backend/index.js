require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const studentsRouter = require('./routes/students')
const templatesRouter = require('./routes/templates')
const confirmationsRouter = require('./routes/confirmations')
const settingsRouter = require('./routes/settings')

const app = express()

// ── Security headers ──
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Supabase storage image URLs
}))

// ── CORS ──
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

// ── Body size limit ──
app.use(express.json({ limit: '50kb' }))

// ── Rate limiting ──
// General API limit — 200 requests per 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
})

// Strict limit for public student lookup — 30 per 15 min per IP
const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many lookup attempts. Please try again later.' }
})

// Strict limit for confirmations — 10 per 15 min per IP
const confirmLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many confirmation attempts. Please try again later.' }
})

app.use('/api', generalLimiter)
app.use('/api/students/lookup', lookupLimiter)
app.use('/api/confirmations', confirmLimiter)

// ── Routes ──
app.use('/api/students', studentsRouter)
app.use('/api/confirmations', confirmationsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/settings', settingsRouter)

// ── Health check (no env info leaked) ──
app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

// ── 404 fallback ──
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`LMSA ID Portal backend running on port ${PORT}`)
  console.log(`CORS origin: ${allowedOrigin}`)
})
