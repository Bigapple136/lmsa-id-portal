const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [confirmedRes, selfCorrectedRes, photoIssueRes, submissionsRes] = await Promise.all([
      supabase.from('confirmations').select('id', { count: 'exact', head: true }).eq('action', 'confirmed'),
      supabase.from('confirmations').select('note').eq('action', 'self_corrected'),
      supabase.from('confirmations').select('id', { count: 'exact', head: true }).eq('action', 'photo_issue'),
      supabase.from('student_submissions').select('status'),
    ])

    const totalConfirmations = confirmedRes.count || 0
    const photo_issues = photoIssueRes.count || 0

    // Each self_corrected row's note is built by students.js's self-correct
    // route by joining one fixed-prefix line per field the student actually
    // touched (e.g. "Name corrected to: ...", "Year corrected to: ..."), so
    // matching those prefixes here attributes each correction to the right
    // field. If that route's wording ever changes, this needs to change
    // with it — there's no structured field-list to read instead, only the
    // note text.
    const corrections_by_field = { name: 0, year: 0 }
    for (const row of selfCorrectedRes.data || []) {
      const note = row.note || ''
      if (note.includes('Name corrected to:')) corrections_by_field.name++
      if (note.includes('Year corrected to:')) corrections_by_field.year++
    }

    const submissions = submissionsRes.data || []

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
