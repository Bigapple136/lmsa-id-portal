/**
 * Renders what a student's self-service correction actually did.
 *
 * The `details` object is written by backend/utils/corrections.js and stored on
 * the notification (and on the student's activity-log row): which fields moved,
 * from what to what, plus the note the student wrote when they reported the
 * problem.
 *
 * It exists as a component because admins need to read the same thing in two
 * places — the notification feed (where the correction is announced) and the
 * student editor (where it gets acted on) — and the two must not drift.
 *
 * Renders nothing when there is no structured detail: rows written before
 * sql/015, and any notification whose details could not be stored, still carry a
 * complete sentence in `message`.
 */
function formatCorrectionValue(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export default function CorrectionDetails({ details, heading = 'What changed' }) {
  const fields = Array.isArray(details?.fields) ? details.fields : []
  const note = typeof details?.student_note === 'string' ? details.student_note.trim() : ''
  if (!fields.length && !note) return null

  return (
    <div className="correction-details">
      {fields.length > 0 && (
        <>
          {heading && <div className="correction-details-heading">{heading}</div>}
          <ul className="correction-detail-list">
            {fields.map((field) => {
              const from = formatCorrectionValue(field?.from)
              const to = formatCorrectionValue(field?.to)
              return (
                <li key={field?.key || field?.label} className="correction-detail-row">
                  <span className="correction-detail-label">{field?.label || field?.key}</span>
                  <span className="correction-detail-change">
                    {from ? (
                      <span className="correction-detail-from">
                        <span className="sr-only">was </span>
                        {from}
                      </span>
                    ) : (
                      <span className="correction-detail-empty">not set</span>
                    )}
                    <span className="correction-detail-arrow" aria-hidden="true">
                      →
                    </span>
                    {to ? (
                      <span className="correction-detail-to">
                        <span className="sr-only">now </span>
                        {to}
                      </span>
                    ) : (
                      <span className="correction-detail-empty">cleared</span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {note && (
        <p className="correction-note">
          <span className="correction-note-label">Student&rsquo;s note</span>
          <span className="correction-note-text">{note}</span>
        </p>
      )}
    </div>
  )
}
