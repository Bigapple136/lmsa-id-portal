require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const studentsRouter = require('./routes/students')
const templatesRouter = require('./routes/templates')
const confirmationsRouter = require('./routes/confirmations')
const settingsRouter = require('./routes/settings')
const qrRouter = require('./routes/qr')

const app = express()

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*'
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}))

app.use(express.json({ limit: '50kb' }))

const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } })
const lookupLimiter = rateLimit({ windowMs: 15*60*1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many lookup attempts.' } })
const confirmLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many confirmation attempts.' } })

app.use('/api', generalLimiter)
app.use('/api/students/lookup', lookupLimiter)
app.use('/api/confirmations', confirmLimiter)

app.use('/api/students', studentsRouter)
app.use('/api/confirmations', confirmationsRouter)
app.use('/api/templates', templatesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/qr', qrRouter)

app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`LMSA ID Portal backend running on port ${PORT}`)
  console.log(`CORS origin: ${allowedOrigin}`)
})
