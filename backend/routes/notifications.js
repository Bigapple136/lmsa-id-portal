const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')

const PAGE_SIZE = 50

// Admin: list notifications (newest first, paginated) — WITH per-admin read status
router.get('/', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || PAGE_SIZE, 100)
    const offset = parseInt(req.query.offset) || 0
    const filterType = req.query.type // optional: 'submission' | 'self_correction' | 'photo_issue'

    // Use the view that includes per-admin read status
    let query = supabase
      .from('admin_notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filterType && ['submission', 'self_correction', 'photo_issue'].includes(filterType)) {
      query = query.eq('type', filterType)
    }

    const { data, error, count } = await query

    if (error) {
      // Fallback if view doesn't exist (migrations not applied)
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        // Legacy query without per-admin read
        const { data: legacy, error: legacyErr } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
        if (legacyErr) return res.status(500).json({ error: 'Failed to load notifications.' })

        const { count: total } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
        const { count: unread } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)

        return res.json({
          notifications: (legacy || []).map(n => ({ ...n, is_read_by_me: n.is_read })),
          total: total || 0,
          unread: unread || 0,
        })
      }
      return res.status(500).json({ error: 'Failed to load notifications.' })
    }

    // Unread count for this admin (using the view)
    const { count: unread } = await supabase
      .from('admin_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read_by_me', false)

    res.json({ notifications: data || [], total: count || 0, unread: unread || 0 })
  } catch (err) {
    logger.error({ err }, 'Notifications GET error')
    res.status(500).json({ error: 'Failed to load notifications.' })
  }
})

// Admin: mark ALL as read (insert read records for all unread notifications)
router.patch('/read-all', requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id

    // Find all notifications this admin hasn't read yet
    const { data: unread, error: findErr } = await supabase
      .from('admin_notifications')
      .select('id')
      .eq('is_read_by_me', false)

    if (findErr) return res.status(500).json({ error: 'Failed to find unread notifications.' })
    if (!unread?.length) return res.json({ message: 'No unread notifications.' })

    // Bulk insert read records (ON CONFLICT DO NOTHING handles idempotency)
    const reads = unread.map(n => ({
      notification_id: n.id,
      admin_id: adminId,
      read_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('notification_reads')
      .upsert(reads, { onConflict: 'notification_id,admin_id' })

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        // Migrations not applied — fall back to legacy global mark-read
        const { error: legacyErr } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('is_read', false)
        if (legacyErr) return res.status(500).json({ error: 'Failed to mark notifications.' })
        return res.json({ message: 'All notifications marked as read.' })
      }
      return res.status(500).json({ error: 'Failed to mark notifications.' })
    }

    res.json({ message: 'All notifications marked as read.' })
  } catch (err) {
    logger.error({ err }, 'Notifications PATCH /read-all error')
    res.status(500).json({ error: 'Failed to mark notifications.' })
  }
})

// Admin: mark a SINGLE notification as read
router.patch('/:id/read', requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id
    const notificationId = req.params.id

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID.' })
    }

    // Verify the notification exists
    const { data: notif, error: findErr } = await supabase
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
      .maybeSingle()
    if (findErr) return res.status(500).json({ error: 'Failed to verify notification.' })
    if (!notif) return res.status(404).json({ error: 'Notification not found.' })

    // Insert read record (upsert handles idempotency)
    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { notification_id: notificationId, admin_id: adminId, read_at: new Date().toISOString() },
        { onConflict: 'notification_id,admin_id' }
      )

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        // Migrations not applied — fall back to legacy global read
        const { error: legacyErr } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
        if (legacyErr) return res.status(500).json({ error: 'Failed to mark notification.' })
        return res.json({ message: 'Notification marked as read.' })
      }
      return res.status(500).json({ error: 'Failed to mark notification.' })
    }

    res.json({ message: 'Notification marked as read.' })
  } catch (err) {
    logger.error({ err }, 'Notifications PATCH /:id/read error')
    res.status(500).json({ error: 'Failed to mark notification.' })
  }
})

// Internal: create a notification (called by other routes via service key)
router.post('/', requireAdmin, async (req, res) => {
  const { type, title, message, student_id } = req.body

  if (!type || !title || !message) {
    return res.status(400).json({ error: 'type, title, and message are required.' })
  }

  try {
    const { error } = await supabase.from('notifications').insert({
      type,
      title,
      message,
      student_id: student_id || null,
    })

    if (error) {
      logger.warn({ err: error.message }, 'Notifications INSERT error')
      return res.status(500).json({ error: 'Failed to create notification.' })
    }
    res.status(201).json({ message: 'Notification created.' })
  } catch (err) {
    logger.error({ err }, 'Notifications POST error')
    res.status(500).json({ error: 'Failed to create notification.' })
  }
})

module.exports = router