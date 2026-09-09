import { useEffect, useRef } from 'react'
import EmptyState from '../../components/EmptyState'
import CorrectionDetails from '../../components/CorrectionDetails'
import { useDashboard } from './DashboardContext'

// Mirrors STATUSES in backend/routes/corrections.js.
const FILTERS = ['pending', 'approved', 'rejected', 'withdrawn', 'all']

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function daysAgo(value) {
  if (!value) return null
  const ms = Date.now() - new Date(value).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.floor(ms / 86400000))
}

/**
 * The correction-review queue.
 *
 * Students can no longer write their own record from a signed preview link — they
 * file an ask, and the change happens here or not at all. So this tab is the only
 * path from "a student says their card is wrong" to "their card is different", and
 * it is built for the two things that makes hard:
 *
 *   judging a request weeks later → the row shows the exact from → to the student
 *     saw, their words, and how long it has waited;
 *   not overwriting a change made since → approval is a guarded write, and a 409
 *     comes back here as a conflict box naming what moved, with "Apply anyway" as
 *     the explicit override rather than a silent one.
 */
export default function CorrectionsTab() {
  const {
    correctionConflict,
    correctionMsg,
    corrections,
    correctionsFilter,
    correctionsLoading,
    focusCorrectionId,
    handleApproveCorrection,
    handleRejectCorrection,
    setCorrectionConflict,
    setCorrectionsFilter,
  } = useDashboard()

  const focusRef = useRef(null)

  // Landing here from a notification should land on the request that arrived, not
  // the top of the queue.
  useEffect(() => {
    if (focusCorrectionId && focusRef.current) {
      // Optional call: jsdom has no scrollIntoView, and a test render should not
      // need to stub a browser convenience for the panel to mount.
      focusRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }, [focusCorrectionId, corrections])

  return (
    <div>
      <div className="section-title">Corrections</div>
      <p className="preview-panel-hint">
        What students have asked to change on their own cards. Nothing is applied until you approve
        it — until then their record, their QR code and their printed card stay exactly as they are.
      </p>
      <div className="mode-toggle">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`mode-btn ${correctionsFilter === f ? 'active' : ''}`}
            onClick={() => {
              setCorrectionsFilter(f)
              setCorrectionConflict(null)
            }}
            style={{ textTransform: 'capitalize' }}
          >
            {f}
          </button>
        ))}
      </div>

      {correctionMsg && (
        <div
          className={`${correctionMsg.warn ? 'info-box' : correctionMsg.ok ? 'success-box' : 'error-box'} u-mb-10 u-fs-13`}
        >
          {correctionMsg.text}
        </div>
      )}

      {correctionsLoading && corrections.length === 0 ? (
        <div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton skeleton-row" />
          ))}
        </div>
      ) : corrections.length === 0 ? (
        <EmptyState>
          No {correctionsFilter === 'all' ? '' : correctionsFilter} correction requests
          {correctionsFilter === 'pending' ? ' waiting.' : '.'}
        </EmptyState>
      ) : (
        <div style={{ position: 'relative' }}>
          {correctionsLoading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                fontSize: '10px',
                color: 'var(--muted)',
                background: 'var(--bg)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '0.5px solid var(--border)',
                zIndex: 1,
              }}
            >
              Updating…
            </div>
          )}
          <div style={{ opacity: correctionsLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {corrections.map((request) => {
              const name = request.student?.full_name || request.student_id
              // Matched on the request or the student, because a notification
              // carries only `details.request_id` when sql/016 was in place when it
              // was written — the student id always arrives.
              const focused = Boolean(focusCorrectionId)
                && (focusCorrectionId === request.id || focusCorrectionId === request.student_id)
              return (
                <div
                  key={request.id}
                  ref={focused ? focusRef : undefined}
                  className={`student-row${focused ? ' corrections-row--focus' : ''}`}
                >
                  <div className="avatar">
                    {name
                      .split(' ')
                      .map((n) => n[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="student-info">
                    <div className="student-name">{name}</div>
                    <div className="student-meta">
                      {request.student_id} · {request.student?.year_level || '—'}
                      {request.student?.status ? ` · card ${request.student.status}` : ''}
                    </div>
                    <div className="correction-row-meta">
                      Asked {formatDate(request.created_at)}
                      {request.status === 'pending' && daysAgo(request.created_at) !== null
                        ? ` · ${daysAgo(request.created_at)} day${daysAgo(request.created_at) === 1 ? '' : 's'} waiting`
                        : ''}
                      {request.reviewed_at
                        ? ` · ${request.status} ${formatDate(request.reviewed_at)}`
                        : ''}
                    </div>

                    <CorrectionDetails
                      details={{ fields: request.fields, student_note: request.student_note }}
                      heading="They asked to change"
                    />

                    {request.admin_note && (
                      <div className="student-issue-note">Review note: {request.admin_note}</div>
                    )}

                    {correctionConflict?.id === request.id && (
                      <div className="correction-conflict">
                        <div>{correctionConflict.error}</div>
                        <ul className="correction-conflict-list">
                          {correctionConflict.conflicts.map((field) => (
                            <li key={field.key}>
                              {field.label}: they asked for “{field.requested ?? '(blank)'}”, the
                              record now says “{field.current ?? '(blank)'}”
                            </li>
                          ))}
                        </ul>
                        <div className="correction-conflict-actions">
                          <button
                            className="btn-gold u-fs-10 u-p-4-8"
                            onClick={() => handleApproveCorrection(request, { force: true })}
                          >
                            Apply anyway
                          </button>
                          <button
                            className="btn-outline u-fs-10 u-p-4-8"
                            onClick={() => setCorrectionConflict(null)}
                          >
                            Leave it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="u-flex u-gap-4 u-shrink-0">
                    {request.status === 'pending' ? (
                      <>
                        <button
                          className="btn-gold u-fs-10 u-p-4-8"
                          onClick={() => handleApproveCorrection(request)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn-outline"
                          style={{
                            fontSize: '10px',
                            padding: '4px 8px',
                            borderColor: 'var(--error-text)',
                            color: 'var(--error-text)',
                          }}
                          onClick={() => handleRejectCorrection(request)}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="correction-decided">{request.status}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
