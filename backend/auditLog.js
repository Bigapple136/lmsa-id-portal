const { supabase } = require('./db')
const logger = require('./logger')

// Records an admin-triggered action for later diagnosis — "who did what,
// on which record, when". Call this from a route after requireAdmin has
// run (so req.user/req.user.email are populated) and the action actually
// succeeded.
//
// Failures here are logged but never thrown — a logging hiccup must never
// break the admin action it's recording.
//
//   await logAdminAction(req, 'renew_cohort', {
//     targetType: 'cohort',
//     targetId: year_level,
//     details: { new_valid_until, affected_count },
//   })
async function logAdminAction(req, action, { targetType = null, targetId = null, details = null } = {}) {
  try {
    const { error } = await supabase.from('admin_actions').insert({
      admin_id: req.user?.id || null,
      admin_email: req.user?.email || null,
      action,
      target_type: targetType,
      target_id: targetId === null || targetId === undefined ? null : String(targetId),
      details: details || {},
    })
    if (error) logger.error({ err: error, action }, 'Failed to record admin action')
  } catch (err) {
    logger.error({ err, action }, 'Failed to record admin action')
  }
}

module.exports = { logAdminAction }
