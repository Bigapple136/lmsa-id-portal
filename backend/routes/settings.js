const express = require('express')
const router = express.Router()
const path = require('path')
const fs = require('fs')
const JSZip = require('jszip')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const {
  isBoolean,
  checkFieldsConfig,
  checkFieldSidesConfig,
  checkLayoutConfig,
} = require('../middleware/validate')
const logger = require('../logger')
const { logAdminAction } = require('../auditLog')

const DEFAULT_FIELDS = {
  full_name: { label: 'Full Name', enabled: true, locked: false },
  student_id: { label: 'Student ID', enabled: true, locked: true },
  year_level: { label: 'Level', enabled: true, locked: false },
  position: { label: 'Position', enabled: false, locked: false },
  signature: { label: 'Signature', enabled: false, locked: false },
}

const DEFAULT_QR_FIELDS = {
  programme: { label: 'Programme', enabled: true },
  blood_type: { label: 'Blood Type', enabled: true },
  student_email: { label: 'Student Email', enabled: false },
  emergency_contact_name: { label: 'Emergency Contact Name', enabled: true },
  emergency_contact_phone: { label: 'Emergency Contact Phone', enabled: true },
  date_of_birth: { label: 'Date of Birth', enabled: true },
  nationality: { label: 'Nationality', enabled: true },
  county_of_origin: { label: 'County of Origin', enabled: true },
  current_address: { label: 'Current Address', enabled: true },
}

// Which side each card field is printed on: 'front', 'back', 'both', or
// 'none' (kept in the record and the QR payload, but not printed on the card).
// Kept in sync with frontend/src/lib/layoutConstants.js FRONT_FIELDS /
// BACK_FIELDS.
const DEFAULT_FIELD_SIDES = {
  photo: 'front',
  full_name: 'front',
  student_id: 'front',
  year_level: 'front',
  position: 'front',
  signature: 'front',
  qr: 'both',
  blood_type: 'back',
  emergency_contact_phone: 'back',
  issue_date: 'back',
  valid_until: 'back',
}

// ── PUBLIC reads ──
// Note: these settings are NOT cached in-process. With multiple cluster
// workers each holding their own MemoryCache, a write handled by one worker
// never invalidates the others, so a refresh could read a stale value for up
// to the TTL. These are single-row PK lookups on a low-traffic table — read
// them fresh so admin saves persist immediately.
router.get('/fields', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_FIELDS
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /fields error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/qr-fields', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'qr_fields')
      .maybeSingle()
    const result = data?.value || DEFAULT_QR_FIELDS
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /qr-fields error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

// Which side each field is printed on (front / back / both)
router.get('/field-sides', async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_field_sides')
      .maybeSingle()
    const result = data?.value || DEFAULT_FIELD_SIDES
    res.json(result)
  } catch (err) {
    logger.error({ err }, 'Settings GET /field-sides error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

router.get('/layout', async (req, res) => {
  try {
    const [{ data: frontData }, { data: backData }] = await Promise.all([
      supabase.from('portal_settings').select('value').eq('key', 'card_layout_front').maybeSingle(),
      supabase.from('portal_settings').select('value').eq('key', 'card_layout_back').maybeSingle(),
    ])
    // Backward compatibility: if only card_layout exists, use it as front.
    // frontData/backData are already unwrapped to the row itself via the
    // { data: frontData } destructuring above, so the saved layout is at
    // frontData.value — NOT frontData.data.value. (legacyData below is
    // NOT pre-destructured, so legacyData.data.value is correct there.)
    const legacyData = !frontData?.value && !backData?.value
      ? await supabase.from('portal_settings').select('value').eq('key', 'card_layout').maybeSingle()
      : { data: null }

    let frontLayout = frontData?.value || null
    const backLayout = backData?.value || null

    // One-time migration: an old flat card_layout row (pre front/back split)
    // becomes the front layout. Back is left unmapped — the frontend
    // resolves it to calibrated defaults until the admin maps it for real.
    if (legacyData?.data?.value && (!frontLayout || !backLayout)) {
      frontLayout = legacyData.data.value

      supabase.from('portal_settings').upsert([
        { key: 'card_layout_front', value: frontLayout, updated_at: new Date().toISOString() },
      ]).then(() => {
        supabase.from('portal_settings').delete().eq('key', 'card_layout')
      }).catch(() => { /* ignore migration errors */ })
    }

    // Return the saved layout as-is — null for a side the admin hasn't
    // mapped yet. Falling back to calibrated defaults is a rendering
    // decision made once, by resolveCardLayout on the frontend, not
    // duplicated here — so an actually-empty save is visible instead of
    // silently masked as "working".
    res.json({ front: frontLayout, back: backLayout })
  } catch (err) {
    logger.error({ err }, 'Settings GET /layout error')
    res.status(500).json({ error: 'Failed to load settings.' })
  }
})

// ── ADMIN writes ──
router.put('/fields', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const cfgErr = checkFieldsConfig(req.body)
    if (cfgErr) return res.status(400).json({ error: cfgErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'card_fields', value: req.body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /fields error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

router.put('/qr-fields', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const cfgErr = checkFieldsConfig(req.body)
    if (cfgErr) return res.status(400).json({ error: cfgErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'qr_fields', value: req.body, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /qr-fields error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// Persist which side each field is printed on
router.put('/field-sides', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const sides = req.body
    const sidesErr = checkFieldSidesConfig(sides)
    if (sidesErr) return res.status(400).json({ error: sidesErr })

    // QR verification is a core product guarantee, not a layout preference:
    // a card with no QR cannot be verified at /qr/:studentId. It may move
    // between sides, but it may not be turned off here.
    if (sides.qr === 'none') {
      return res.status(400).json({
        error: 'The QR code cannot be removed from the card — public verification depends on it. Assign it to the front, back, or both.',
      })
    }
    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({ key: 'card_field_sides', value: sides, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /field-sides error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// Valid layout fields (config keys like fontFamily, logoPosition are filtered out)
const VALID_LAYOUT_FIELDS = new Set([
  'photo',
  'full_name',
  'student_id',
  'position',
  'year_level',
  'signature',
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
])

// Filter out config keys from layout, keeping only valid student fields
function cleanLayout(layout) {
  if (!layout || typeof layout !== 'object') return layout
  const cleaned = {}
  Object.entries(layout).forEach(([key, val]) => {
    if (VALID_LAYOUT_FIELDS.has(key)) {
      cleaned[key] = val
    }
  })
  return cleaned
}

const LAYOUT_HISTORY_RETENTION = 20

// Records a layout_history row for one side, then prunes anything beyond
// the most recent LAYOUT_HISTORY_RETENTION entries for that side. Never
// throws — a history-recording hiccup must never break the save it's
// recording.
async function recordLayoutHistory(side, value, req) {
  try {
    const { error } = await supabase.from('layout_history').insert({
      side,
      value,
      saved_by: req.user?.id || null,
      saved_by_email: req.user?.email || null,
    })
    if (error) {
      logger.error({ err: error, side }, 'Failed to record layout history')
      return
    }
    const { data: cutoffRow } = await supabase
      .from('layout_history')
      .select('created_at')
      .eq('side', side)
      .order('created_at', { ascending: false })
      .range(LAYOUT_HISTORY_RETENTION - 1, LAYOUT_HISTORY_RETENTION - 1)
      .maybeSingle()
    if (cutoffRow?.created_at) {
      await supabase.from('layout_history').delete().eq('side', side).lt('created_at', cutoffRow.created_at)
    }
  } catch (err) {
    logger.error({ err, side }, 'Failed to record layout history')
  }
}

router.put('/layout', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    // Accept both old format (flat layout) and new format { front, back }
    const { front, back } = req.body
    const isNewFormat = front !== undefined || back !== undefined

    // Ensure at least one layout is being saved
    if (!isNewFormat && (!req.body || Object.keys(req.body).length === 0)) {
      return res.status(400).json({ error: 'Layout update requires at least front or back layout.' })
    }

    // Validate front layout
    if (front !== undefined) {
      const cfgErr = checkLayoutConfig(front)
      if (cfgErr) return res.status(400).json({ error: `Front layout: ${cfgErr}` })
    }
    // Validate back layout
    if (back !== undefined) {
      const cfgErr = checkLayoutConfig(back)
      if (cfgErr) return res.status(400).json({ error: `Back layout: ${cfgErr}` })
    }

    // If old format (flat), treat as front only
    let frontLayout = isNewFormat ? front : req.body
    let backLayout = isNewFormat ? back : undefined

    // Filter out config keys (fontFamily, logoPosition, etc) - keep only valid student fields
    frontLayout = cleanLayout(frontLayout)
    backLayout = cleanLayout(backLayout)

    const updates = []
    if (frontLayout !== undefined) {
      updates.push(
        supabase
          .from('portal_settings')
          .upsert({ key: 'card_layout_front', value: frontLayout, updated_at: new Date().toISOString() })
          .select()
          .single(),
      )
    }
    if (backLayout !== undefined) {
      updates.push(
        supabase
          .from('portal_settings')
          .upsert({ key: 'card_layout_back', value: backLayout, updated_at: new Date().toISOString() })
          .select()
          .single(),
      )
    }

    const results = await Promise.all(updates)
    for (const { error } of results) {
      if (error) return res.status(400).json({ error: error.message })
    }

    const savedFront = results[0]?.data?.value
    const savedBack = results[1]?.data?.value

    // History is recorded from what was actually persisted (not the raw
    // request body), so a revert always replays a value that really was
    // live at some point.
    const historyWrites = []
    if (savedFront !== undefined) historyWrites.push(recordLayoutHistory('front', savedFront, req))
    if (savedBack !== undefined) historyWrites.push(recordLayoutHistory('back', savedBack, req))
    await Promise.all(historyWrites)

    const savedSides = [savedFront !== undefined && 'front', savedBack !== undefined && 'back'].filter(Boolean)
    await logAdminAction(req, 'layout_save', {
      targetType: 'layout',
      targetId: savedSides.join('+') || null,
      details: {
        frontFields: savedFront ? Object.keys(savedFront) : undefined,
        backFields: savedBack ? Object.keys(savedBack) : undefined,
      },
    })

    logger.info(
      { frontFields: Object.keys(savedFront || {}).length, backFields: Object.keys(savedBack || {}).length },
      'Layout PUT: saved',
    )
    res.json({ front: savedFront, back: savedBack })
  } catch (err) {
    logger.error({ err }, 'Settings PUT /layout error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

// GET /api/settings/layout/history?side=front&limit=10
// Recent saved layouts for one side, most recent first. side is required
// since history/retention is tracked per side.
router.get('/layout/history', requireAdmin, async (req, res) => {
  try {
    const { side } = req.query
    if (side !== 'front' && side !== 'back') {
      return res.status(400).json({ error: 'side must be "front" or "back".' })
    }
    const limit = Math.min(Number(req.query.limit) || LAYOUT_HISTORY_RETENTION, LAYOUT_HISTORY_RETENTION)
    const { data, error } = await supabase
      .from('layout_history')
      .select('id, value, saved_by_email, created_at')
      .eq('side', side)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    logger.error({ err }, 'GET /layout/history error')
    res.status(500).json({ error: 'Failed to load layout history.' })
  }
})

// POST /api/settings/layout/history/:id/revert
// Re-applies a past layout_history entry as the current layout for its
// side. This is itself just another save: it goes through cleanLayout,
// gets its own new layout_history entry (so the revert joins the
// timeline instead of erasing it), and is logged as an admin action.
router.post('/layout/history/:id/revert', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const { data: entry, error: fetchErr } = await supabase
      .from('layout_history')
      .select('id, side, value')
      .eq('id', req.params.id)
      .maybeSingle()
    if (fetchErr) return res.status(500).json({ error: fetchErr.message })
    if (!entry) return res.status(404).json({ error: 'History entry not found.' })

    const cleaned = cleanLayout(entry.value)
    const key = entry.side === 'front' ? 'card_layout_front' : 'card_layout_back'
    const { data: saved, error: saveErr } = await supabase
      .from('portal_settings')
      .upsert({ key, value: cleaned, updated_at: new Date().toISOString() })
      .select()
      .single()
    if (saveErr) return res.status(500).json({ error: saveErr.message })

    await recordLayoutHistory(entry.side, cleaned, req)
    await logAdminAction(req, 'layout_revert', {
      targetType: 'layout',
      targetId: entry.side,
      details: { revertedToHistoryId: entry.id, fields: Object.keys(cleaned) },
    })

    res.json({ side: entry.side, value: saved?.value })
  } catch (err) {
    logger.error({ err }, 'POST /layout/history/:id/revert error')
    res.status(500).json({ error: 'Failed to revert layout.' })
  }
})

// ── ADMIN downloads ──
router.get('/download-excel', requireAdmin, async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'student_form_template.xlsx')

    try {
      await fs.promises.access(templatePath)
    } catch {
      return res
        .status(500)
        .json({ error: 'Template file not found. Run: node scripts/generate_template.js' })
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Student_Template.xlsx"')
    res.sendFile(templatePath)
  } catch (err) {
    logger.error({ err }, 'Settings download-excel error')
    res.status(500).json({ error: 'Failed to download template.' })
  }
})

router.get('/download-image-folder', requireAdmin, async (req, res) => {
  try {
    const { data } = await supabase
      .from('portal_settings')
      .select('value')
      .eq('key', 'card_fields')
      .maybeSingle()
    const fields = data?.value || DEFAULT_FIELDS
    const includeSignatures = fields.signature?.enabled === true

    const zip = new JSZip()
    const root = zip.folder('images').folder('idcard')
    const YEARS = ['year-1', 'year-2', 'year-3', 'year-4', 'year-5', 'year-6']
    const YEAR_LABELS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']

    YEARS.forEach((yr, i) => {
      const folder = root.folder(yr)
      folder.file(
        'README.txt',
        `LMSA ID Portal — ${YEAR_LABELS[i]} Photos\n${'─'.repeat(40)}\n\n` +
          `Name each photo after the student ID.\nExamples: AMD-2024-0001.jpg\n\n` +
          `Requirements: JPG or PNG · Passport style · Min 300×375 px\n`,
      )
    })

    if (includeSignatures) {
      root
        .folder('signatures')
        .file(
          'README.txt',
          `LMSA ID Portal — Signatures\n${'─'.repeat(40)}\n\n` +
            `PNG only · Transparent background required · Named by student ID.\nExample: AMD-2024-0001.png\n`,
        )
    }

    zip.file(
      'HOW_TO_USE.txt',
      `LMSA ID Portal — Bulk Photo Package\n${'─'.repeat(40)}\n\n` +
        `1. Add photos to the correct year subfolder (named by student ID)\n` +
        (includeSignatures ? `2. Add signature PNGs to signatures/ folder\n3. ` : `2. `) +
        `Compress everything to ZIP and upload alongside your CSV in the portal.\n\nGoldWay · goldway.estone@outlook.com\n`,
    )

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Image_Upload_Folder.zip"')
    res.send(buffer)
  } catch (err) {
    logger.error({ err }, 'Settings download-image-folder error')
    res.status(500).json({ error: 'Failed to generate ZIP.' })
  }
})

// ── Submission form toggle ──
router.get('/submission-form', requireAdmin, async (req, res) => {
  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'submission_form')
    .maybeSingle()
  res.json(data?.value || { enabled: false })
})

router.put('/submission-form', requireAdmin, requireFullAdmin, async (req, res) => {
  try {
    const boolErr = isBoolean(req.body.enabled, 'enabled')
    if (boolErr) return res.status(400).json({ error: boolErr })

    const { data, error } = await supabase
      .from('portal_settings')
      .upsert({
        key: 'submission_form',
        value: { enabled: req.body.enabled === true },
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) return res.status(400).json({ error: error.message })
    res.json(data.value)
  } catch (err) {
    logger.error({ err }, 'Settings PUT /submission-form error')
    res.status(500).json({ error: 'Failed to save settings.' })
  }
})

async function getQRFields() {
  const { data } = await supabase
    .from('portal_settings')
    .select('value')
    .eq('key', 'qr_fields')
    .maybeSingle()
  return data?.value || DEFAULT_QR_FIELDS
}

module.exports = router
module.exports.getQRFields = getQRFields
