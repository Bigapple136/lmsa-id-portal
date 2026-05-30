const { supabase } = require('../db')

async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Admin login required.' })
  }
  const token = authHeader.split(' ')[1]
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' })
  }
  const { data: adminRecord } = await supabase
    .from('admins').select('id, role').eq('id', user.id).maybeSingle()
  if (!adminRecord) return res.status(403).json({ error: 'Forbidden.' })
  req.user = user
  req.userRole = adminRecord.role || 'admin'
  next()
}

module.exports = { requireAdmin }
