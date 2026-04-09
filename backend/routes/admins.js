const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('admins').select('id, email, name, created_at')
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', requireAdmin, async (req, res) => {
  const { email, name } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required.' })
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({ error: 'Invalid email address.' })

  try {
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.createUser({
      email: email.trim(),
      email_confirm: true,
      send_invite_email: true,
    })
    if (inviteError) return res.status(400).json({ error: inviteError.message })

    const userId = inviteData.user?.id
    if (!userId) return res.status(500).json({ error: 'Failed to create user.' })

    const { data, error: insertError } = await supabase
      .from('admins').insert({ id: userId, email: email.trim(), name: name?.trim() || null })
      .select('id, email, name, created_at').single()

    if (insertError) return res.status(400).json({ error: insertError.message })
    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id

  if (req.user.id === targetId)
    return res.status(400).json({ error: 'Cannot remove yourself.' })

  const { data: allAdmins } = await supabase.from('admins').select('id')
  if (allAdmins?.length === 1)
    return res.status(400).json({ error: 'Cannot remove the last admin.' })

  const { error } = await supabase.from('admins').delete().eq('id', targetId)
  if (error) return res.status(500).json({ error: error.message })

  res.status(204).send()
})

module.exports = router
