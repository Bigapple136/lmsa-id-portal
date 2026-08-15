const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')
const logger = require('../logger')

const PAGE_SIZE = 50

// Admin: list notifications (newest first, paginated) — WITH per-admin read status
router.get('/', requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id
    const limit = Math.min(parseInt(req.query.limit) || PAGE_SIZE, 100)
    const offset = parseInt(req.query.offset) || 0
    const filterType = req.query.type // optional: 'submission' | 'self_correction' | 'photo_issue'

    // NOTE: the backend connects with the SERVICE-ROLE key, so auth.uid() is
    // always NULL inside the admin_notifications view. We therefore cannot rely
    // on the view to compute per-admin read state — it would mark every
    // notification as unread for everyone. Instead we load notifications directly
    // and join this admin's read records explicitly via notification_reads.
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (filterType && ['submission', 'self_correction', 'photo_issue'].includes(filterType)) {
      query = query.eq('type', filterType)
    }

    const { data, error, count } = await query
    if (error) return res.status(500).json({ error: 'Failed to load notifications.' })

    // Fetch this admin's read records (absent if the table isn't migrated yet).
    const { data: reads, error: readsErr } = await supabase
      .from('notification_reads')
      .select('notification_id, read_at')
      .eq('admin_id', adminId)

    const readMap = new Map()
    if (!readsErr && reads) {
      for (const r of reads) readMap.set(r.notification_id, r.read_at)
    }

    const notifications = (data || []).map((n) => ({
      ...n,
      is_read_by_me: readMap.has(n.id),
      read_at: readMap.get(n.id) || null,
    }))

    // Global unread count for THIS admin (ignores the active type filter).
    const { count: totalAll, error: totalErr } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })

    const unread = !totalErr && totalAll !== null ? Math.max(0, totalAll - readMap.size) : 0

    res.json({ notifications, total: count || 0, unread })
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

// Admin: delete a SINGLE notification (clears it from the feed entirely —
// notifications are ephemeral alerts, not a permanent system log).
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID.' })
    }

    const { error } = await supabase.from('notifications').delete().eq('id', notificationId)
    if (error) return res.status(500).json({ error: 'Failed to delete notification.' })

    res.json({ message: 'Notification deleted.' })
  } catch (err) {
    logger.error({ err }, 'Notifications DELETE /:id error')
    res.status(500).json({ error: 'Failed to delete notification.' })
  }
})

// Admin: clear ALL notifications (deletes every notification record).
router.delete('/', requireAdmin, async (req, res) => {
  try {
    // Gather ids first so we issue a scoped delete (avoids an unbounded
    // delete-all that the client would otherwise reject).
    const { data: all, error: listErr } = await supabase.from('notifications').select('id')
    if (listErr) return res.status(500).json({ error: 'Failed to clear notifications.' })

    const ids = (all || []).map((r) => r.id)
    if (ids.length) {
      const { error } = await supabase.from('notifications').delete().in('id', ids)
      if (error) return res.status(500).json({ error: 'Failed to clear notifications.' })
    }

    res.json({ message: 'All notifications cleared.' })
  } catch (err) {
    logger.error({ err }, 'Notifications DELETE / error')
    res.status(500).json({ error: 'Failed to clear notifications.' })
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