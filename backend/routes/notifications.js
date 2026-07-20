const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin } = require('../middleware/auth')

const PAGE_SIZE = 50

// Admin: list notifications (newest first, paginated)
router.get('/', requireAdmin, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || PAGE_SIZE, 100)
  const offset = parseInt(req.query.offset) || 0

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return res.status(500).json({ error: error.message })

  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })

  const { count: unread } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)

  res.json({ notifications: data, total: count, unread })
})

// Admin: mark all as read
router.patch('/read-all', requireAdmin, async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'All notifications marked as read.' })
})

// Internal: create a notification (called by other routes via service key)
router.post('/', async (req, res) => {
  const { type, title, message, student_id } = req.body

  if (!type || !title || !message) {
    return res.status(400).json({ error: 'type, title, and message are required.' })
  }

  const { error } = await supabase.from('notifications').insert({
    type,
    title,
    message,
    student_id: student_id || null,
  })

  if (error) return res.status(500).json({ error: error.message })
  res.status(201).json({ message: 'Notification created.' })
})

module.exports = router
