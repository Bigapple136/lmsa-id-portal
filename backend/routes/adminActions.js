const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')

const MAX_LIMIT = 200
const DEFAULT_LIMIT = 50

// GET /api/admin-actions — list recent admin actions, most recent first.
// Optional filters: action, target_type, target_id, limit.
// Read-only by design: entries are written only via auditLog.js from
// inside other routes, never accepted directly over HTTP, so the log
// can't be fabricated or tampered with through this endpoint.
router.get('/', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT)

    let query = supabase
      .from('admin_actions')
      .select('id, admin_email, action, target_type, target_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (req.query.action) query = query.eq('action', req.query.action)
    if (req.query.target_type) query = query.eq('target_type', req.query.target_type)
    if (req.query.target_id) query = query.eq('target_id', String(req.query.target_id))

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    logger.error({ err }, 'GET /admin-actions error')
    res.status(500).json({ error: 'Failed to load admin actions.' })
  }
})

module.exports = router
