// Shared in-memory stand-in for the Supabase client, shaped for the correction
// flow (students, correction_requests, confirmations, notifications,
// admin_actions). Route tests in this folder have each hand-rolled their own
// mock query builder; this one grows the two behaviours the gated flow needs and
// must be tested against rather than assumed:
//
//   * the partial unique index behind "one open correction request per student",
//     so the file-then-replace path is exercised rather than stubbed away;
//   * compare-and-set updates, where the number of rows an UPDATE touched is the
//     answer to "did the record move since the student asked?".
//
// `state.missingDetailColumns` simulates sql/015 not being applied,
// `state.missingRequestsTable` simulates sql/016 not being applied, and
// `state.failUpdate` makes one update fail the way a constraint would.

const crypto = require('node:crypto')

function createDb(initial = {}) {
  const state = {
    students: [],
    correction_requests: [],
    confirmations: [],
    notifications: [],
    admin_actions: [],
    admins: [{ id: 'admin-1', email: 'admin@example.test', role: 'admin' }],
    portal_settings: [],
    qr_keys: [],
    missingDetailColumns: false,
    missingRequestsTable: false,
    failUpdate: null,
    ...initial,
  }

  // Real uuids, because the admin routes validate `:id` as a uuid before they
  // look anything up — a synthetic 'row-1' would fail that check and the test
  // would pass or fail for reasons unrelated to the code under test.
  const newId = () => crypto.randomUUID()

  function rows(table) {
    if (table === 'correction_requests' && state.missingRequestsTable) return null
    return state[table] || []
  }

  function makeBuilder(table) {
    const filters = { eq: {}, neq: {}, in: {}, isNull: [] }
    const opts = {}
    let mode = 'select'
    let payload = null

    const source = () => rows(table)

    const matching = () => {
      const list = source()
      if (list === null) return null
      return list.filter((row) => {
        for (const [col, val] of Object.entries(filters.eq)) if (row[col] !== val) return false
        for (const [col, val] of Object.entries(filters.neq)) if (row[col] === val) return false
        for (const [col, vals] of Object.entries(filters.in)) if (!vals.includes(row[col])) return false
        for (const col of filters.isNull) if (row[col] !== null && row[col] !== undefined) return false
        return true
      })
    }

    const tableError = (label) => {
      const touchesDetails =
        opts.detailsRequested || (payload && payload.details !== undefined)
      if (touchesDetails && state.missingDetailColumns) {
        return { code: '42703', message: `column "details" of relation "${table}" does not exist` }
      }
      if (source() === null) {
        return { code: '42P01', message: `relation "${table}" does not exist` }
      }
      if (label === 'insert' && table === 'correction_requests') {
        const pending = (state.correction_requests || []).filter(
          (r) => r.status === 'pending' && r.student_id === payload.student_id,
        )
        if (pending.length) {
          return {
            code: '23505',
            message:
              'duplicate key value violates unique constraint "correction_requests_one_open_per_student"',
          }
        }
      }
      return null
    }

    const resolve = () => {
      const modeError = tableError(mode)
      if (modeError) return { data: null, error: modeError }

      if (mode === 'insert') {
        const row = { id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload }
        source().push(row)
        return { data: row, error: null }
      }

      if (mode === 'update') {
        // A stand-in for a CHECK/FK constraint firing on the write. The correction
        // flow has to answer a rejected value with an error, not with success, and
        // that is only testable if the fake can refuse a payload.
        const fail = state.failUpdate
        if (fail && fail.table === table && (fail.field === undefined || payload?.[fail.field] === fail.value)) {
          return { data: null, error: { message: fail.message } }
        }
        const targets = matching()
        targets.forEach((row) => Object.assign(row, payload, { updated_at: new Date().toISOString() }))
        return { data: opts.returning ? targets.map((r) => ({ ...r })) : null, error: null }
      }

      if (mode === 'delete') {
        const doomed = matching()
        const list = source()
        state[table] = list.filter((r) => !doomed.includes(r))
        return { data: doomed, error: null }
      }

      let list = matching()
      if (opts.order) {
        const { column, ascending } = opts.order
        list = [...list].sort((a, b) => {
          const av = a[column]
          const bv = b[column]
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * (ascending === false ? -1 : 1)
        })
      }
      const total = list.length
      if (typeof opts.limit === 'number') list = list.slice(0, opts.limit)
      if (opts.head) return { data: null, error: null, count: total }
      return { data: list.map((r) => ({ ...r })), error: null, count: total }
    }

    const q = {
      select: (cols = '*', options = {}) => {
        opts.detailsRequested = typeof cols === 'string' && cols.includes('details')
        if (options?.count) opts.count = options.count
        if (options?.head) opts.head = true
        return q
      },
      order: (column, options = {}) => ((opts.order = { column, ascending: options.ascending }), q),
      limit: (n) => ((opts.limit = n), q),
      range: (from, to) => ((opts.limit = to - from + 1), q),
      eq: (col, val) => ((filters.eq[col] = val), q),
      neq: (col, val) => ((filters.neq[col] = val), q),
      in: (col, vals) => ((filters.in[col] = vals), q),
      is: (col, val) => (val === null && filters.isNull.push(col), q),
      insert: (row) => ((mode = 'insert'), (payload = { ...row }), (opts.returning = true), q),
      update: (row) => ((mode = 'update'), (payload = { ...row }), (opts.returning = true), q),
      delete: () => ((mode = 'delete'), q),
      maybeSingle: async () => {
        const { data, error } = resolve()
        const list = Array.isArray(data) ? data : data ? [data] : []
        return { data: list[0] ?? null, error }
      },
      single: async () => {
        const { data, error } = resolve()
        const list = Array.isArray(data) ? data : data ? [data] : []
        if (!list.length && !error) return { data: null, error: { message: 'no rows' } }
        return { data: list[0] ?? null, error }
      },
      then: (onFulfilled, onRejected) => Promise.resolve(resolve()).then(onFulfilled, onRejected),
      catch: (onRejected) => Promise.resolve(resolve()).catch(onRejected),
    }
    return q
  }

  return {
    state,
    client: {
      from: (table) => makeBuilder(table),
      auth: {
        getUser: async (token) =>
          token === 'admin-token'
            ? { data: { user: { id: 'admin-1', email: 'admin@example.test' } }, error: null }
            : { data: { user: null }, error: new Error('invalid json web token') },
      },
    },
  }
}

/** Notification/activity inserts are fire-and-forget; let those microtasks land. */
async function settle() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
  await new Promise((r) => {
    setImmediate(r)
  })
}

module.exports = { createDb, settle }
