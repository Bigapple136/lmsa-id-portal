const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')

const PAGE_SIZE = 50

// Admin: list notifications (newest first, paginated)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || PAGE_SIZE, 100)
    const offset = parseInt(req.query.offset) || 0

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json({ notifications: [], total: 0, unread: 0 })
      }
      return res.status(500).json({ error: error.message })
    }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })

    const { count: unread } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false)

    res.json({ notifications: data || [], total: count || 0, unread: unread || 0 })
  } catch (err) {
    console.error('[Notifications] GET error:', err)
    res.json({ notifications: [], total: 0, unread: 0 })
  }
})

// Admin: mark all as read
router.patch('/read-all', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return res.json({ message: 'No notifications to mark.' })
      }
      return res.status(500).json({ error: error.message })
    }
    res.json({ message: 'All notifications marked as read.' })
  } catch (err) {
    console.error('[Notifications] PATCH error:', err)
    res.json({ message: 'No notifications to mark.' })
  }
})

// Internal: create a notification (called by other routes via service key)
router.post('/', async (req, res) => {
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
      console.warn('[Notifications] INSERT error:', error.message)
      return res.status(500).json({ error: error.message })
    }
    res.status(201).json({ message: 'Notification created.' })
  } catch (err) {
    console.error('[Notifications] POST error:', err)
    res.status(500).json({ error: 'Failed to create notification.' })
  }
})

module.exports = router
