const express = require('express')
const router = express.Router()
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const { uuid } = require('../middleware/validate')

router.get('/', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('admins')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

router.post('/', requireAdmin, requireFullAdmin, async (req, res) => {
  const { email, name, role } = req.body
  if (!email) return res.status(400).json({ error: 'Email is required.' })
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.trim()))
    return res.status(400).json({ error: 'Invalid email address.' })

  const newRole = role || 'support_admin'
  if (!['admin', 'support_admin'].includes(newRole)) {
    return res.status(400).json({ error: 'Invalid role. Must be admin or support_admin.' })
  }

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
      .from('admins')
      .insert({ id: userId, email: email.trim(), name: name?.trim() || null, role: newRole })
      .select('id, email, name, role, created_at')
      .single()

    if (insertError) {
      // Rollback: delete the orphaned auth user
      await supabase.auth.admin.deleteUser(userId).catch(() => {})
      return res.status(400).json({ error: insertError.message })
    }

    const { error: logErr } = await supabase.rpc('log_admin_action', {
      p_admin_id: userId,
      p_action: 'invited',
      p_old_role: null,
      p_new_role: newRole,
      p_performed_by: req.user.id,
    })
    if (logErr) console.warn('[Admins] Failed to log invite:', logErr.message)

    res.status(201).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/:id', requireAdmin, requireFullAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Admin ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const targetId = req.params.id
  const { role: newRole } = req.body

  if (!newRole || !['admin', 'support_admin'].includes(newRole)) {
    return res.status(400).json({ error: 'Role is required. Must be admin or support_admin.' })
  }

  const { data: targetAdmin } = await supabase
    .from('admins')
    .select('id, role')
    .eq('id', targetId)
    .maybeSingle()
  if (!targetAdmin) return res.status(404).json({ error: 'Admin not found.' })

  if (targetAdmin.role === newRole) {
    return res.status(400).json({ error: 'Role is already set to ' + newRole })
  }

  const { count: adminCount } = await supabase
    .from('admins')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .neq('id', targetId)
  const adminCountAfter = (adminCount || 0) + (newRole === 'admin' ? 1 : 0)
  if (adminCountAfter === 0) {
    return res
      .status(400)
      .json({ error: 'Cannot change role. There must be at least one full admin.' })
  }

  const oldRole = targetAdmin.role

  const { error: updateError } = await supabase
    .from('admins')
    .update({ role: newRole })
    .eq('id', targetId)
  if (updateError) return res.status(500).json({ error: updateError.message })

  const { error: logErr1 } = await supabase.rpc('log_admin_action', {
    p_admin_id: targetId,
    p_action: 'role_changed',
    p_old_role: oldRole,
    p_new_role: newRole,
    p_performed_by: req.user.id,
  })
  if (logErr1) console.warn('[Admins] Failed to log role change:', logErr1.message)

  const { data: updated } = await supabase
    .from('admins')
    .select('id, email, name, role, created_at')
    .eq('id', targetId)
    .single()
  res.json(updated)
})

router.delete('/:id', requireAdmin, requireFullAdmin, async (req, res) => {
  const idErr = uuid(req.params.id, 'Admin ID')
  if (idErr) return res.status(400).json({ error: idErr })

  const targetId = req.params.id

  if (req.user.id === targetId) return res.status(400).json({ error: 'Cannot remove yourself.' })

  const { data: targetAdmin } = await supabase
    .from('admins')
    .select('id, role')
    .eq('id', targetId)
    .maybeSingle()
  if (!targetAdmin) return res.status(404).json({ error: 'Admin not found.' })

  const { count: deleteAdminCount } = await supabase
    .from('admins')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .neq('id', targetId)
  if ((deleteAdminCount || 0) === 0) {
    return res.status(400).json({ error: 'Cannot remove the last full admin.' })
  }

  const { error } = await supabase.from('admins').delete().eq('id', targetId)
  if (error) return res.status(500).json({ error: error.message })

  const { error: logErr2 } = await supabase.rpc('log_admin_action', {
    p_admin_id: targetId,
    p_action: 'removed',
    p_old_role: targetAdmin.role,
    p_new_role: null,
    p_performed_by: req.user.id,
  })
  if (logErr2) console.warn('[Admins] Failed to log removal:', logErr2.message)

  res.status(204).send()
})

module.exports = router
