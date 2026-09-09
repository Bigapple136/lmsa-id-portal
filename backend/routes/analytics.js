const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')
const { isMissingSchemaError } = require('../utils/notificationLog')

// `confirmations.details` (sql/015) is what says which fields a self-correction
// actually touched. Rows written before that migration — and everything in a
// deployment that hasn't applied it yet, where even selecting the column fails —
// fall back to the note text, which is why that fallback stays below.
async function loadSelfCorrections() {
  const withDetails = await supabase
    .from('confirmations')
    .select('note, details')
    .eq('action', 'self_corrected')
  if (!withDetails.error) return withDetails.data || []
  if (!isMissingSchemaError(withDetails.error)) {
    logger.warn({ err: withDetails.error.message }, 'Analytics self-correction lookup failed')
    return []
  }
  const noteOnly = await supabase.from('confirmations').select('note').eq('action', 'self_corrected')
  return noteOnly.data || []
}

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [confirmedRes, selfCorrected, photoIssueRes, submissionsRes] = await Promise.all([
      supabase.from('confirmations').select('id', { count: 'exact', head: true }).eq('action', 'confirmed'),
      loadSelfCorrections(),
      supabase.from('confirmations').select('id', { count: 'exact', head: true }).eq('action', 'photo_issue'),
      supabase.from('student_submissions').select('status'),
    ])

    const totalConfirmations = confirmedRes.count || 0
    const photo_issues = photoIssueRes.count || 0

    // Rows with `details` are attributed from the field list students.js's
    // self-correct route recorded. Older rows only have the note the same route
    // writes: one fixed-prefix line per field touched ("Name corrected to: ...",
    // "Year corrected to: ..."), so matching those prefixes attributes them.
    // A row that carries a student's note but no field change has details.fields
    // == [] and correctly counts as neither — which is exactly the case the
    // text matching alone could get wrong.
    const corrections_by_field = { name: 0, year: 0 }
    for (const row of selfCorrected || []) {
      if (Array.isArray(row?.details?.fields)) {
        const keys = row.details.fields.map((f) => f?.key)
        if (keys.includes('full_name')) corrections_by_field.name++
        if (keys.includes('year_level')) corrections_by_field.year++
        continue
      }
      const note = row?.note || ''
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
