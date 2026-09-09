// =============================================================================
// Notification / activity-log writes for the student self-service flows
//
// Both of these are records of something that already happened, written after
// the student's own edit is committed, so a failure here must never fail the
// student's request — every error is logged, never thrown.
//
// `details` (JSONB, sql/015) carries the structured version of what changed so
// the admin notification panel can render "full name: A → B" instead of prose.
// It's treated as optional on purpose: the `message`/`note` strings are written
// to be self-sufficient, so a deployment that hasn't applied sql/015 yet still
// tells an admin everything they need. But Postgres rejects an insert that
// mentions an unknown column, which would silently cost admins the whole
// notification — so on that specific error we retry without the column.
// (Same shape of fallback as routes/notifications.js uses for the
// notification_reads table.)
// =============================================================================

const { supabase } = require('../db')
const logger = require('../logger')

// 42703 undefined_column ("column "details" ... does not exist") and 42P01
// undefined_table. PostgREST surfaces the message text too, which is what the
// existing fallbacks in this codebase match on.
function isMissingSchemaError(error) {
  if (!error) return false
  if (error.code === '42703' || error.code === '42P01') return true
  return typeof error.message === 'string' && /column|relation|table/i.test(error.message) && /does not exist/i.test(error.message)
}

async function insertWithDetailsFallback(table, row, label, retryPatch = null) {
  const { error } = await supabase.from(table).insert(row)
  if (!error) return { ok: true }

  if (row.details !== undefined && isMissingSchemaError(error)) {
    // Losing `details` is tolerable; losing the record is not — so the retry
    // also merges `retryPatch` (e.g. a message that folds in what the details
    // block would have shown, so nothing is silently dropped).
    const retry = { ...row, ...(retryPatch || {}) }
    delete retry.details
    logger.warn(
      { table, err: error.message },
      `${table}.details unavailable — retrying without it (apply sql/015_correction_details.sql)`,
    )
    const { error: retryError } = await supabase.from(table).insert(retry)
    if (retryError) logger.warn({ table, err: retryError.message, label }, `${table} insert failed`)
    return { ok: !retryError, degraded: true }
  }

  logger.warn({ table, err: error.message, label }, `${table} insert failed`)
  return { ok: false, error }
}

/**
 * Fire-and-forget notification insert. Returns nothing on purpose: callers must
 * not await it into the response path — the admin feed is allowed to lag, the
 * student's own submission is not.
 */
function emitNotification({ type, title, message, messageWithNote = null, studentId = null, details = null }) {
  const row = { type, title, message, student_id: studentId }
  if (details) row.details = details
  // Without `details` there is no block to render the note in, so the retry
  // says it in prose instead.
  return insertWithDetailsFallback('notifications', row, type, messageWithNote ? { message: messageWithNote } : null)
}

/** Student-facing activity log row (confirmations table). */
function logStudentActivity({ studentId, action, note, details = null }) {
  const row = { student_id: studentId, action, note }
  if (details) row.details = details
  return insertWithDetailsFallback('confirmations', row, action)
}

module.exports = { emitNotification, logStudentActivity, insertWithDetailsFallback, isMissingSchemaError }
