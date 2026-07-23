const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [confirmationsRes, submissionsRes, notificationsRes] = await Promise.all([
      supabase.from('confirmations').select('id', { count: 'exact', head: true }),
      supabase.from('student_submissions').select('status'),
      supabase.from('notifications').select('type'),
    ])

    const totalConfirmations = confirmationsRes.count || 0

    const submissions = submissionsRes.data || []
    const corrections_by_field = { name: 0, year: 0 }
    let photo_issues = 0

    for (const sub of submissions) {
      if (sub.status === 'approved') {
        corrections_by_field.name++
      }
    }

    const notifications = notificationsRes.data || []
    for (const n of notifications) {
      if (n.type === 'photo_issue') photo_issues++
      if (n.type === 'self_correction') corrections_by_field.name++
    }

    res.json({
      confirmations: totalConfirmations,
      corrections_by_field,
      photo_issues,
      total_submissions: submissions.length,
      pending_submissions: submissions.filter((s) => s.status === 'pending').length,
    })
  } catch (err) {
    logger.error({ err }, 'Analytics error')
    res.status(500).json({ error: 'Failed to load analytics.' })
  }
})

module.exports = router
