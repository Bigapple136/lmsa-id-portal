/**
 * One row of the admin student table.
 *
 * Now supports optimistic UI indicators:
 * - _optimistic: shows syncing state for newly added/updated records
 * - _qrGenerating: shows QR generation in progress
 */
export default function StudentRow({
  student: s,
  session,
  userRole,
  issueNote,
  statusPill,
  getInitials,
  onEdit,
  onDelete,
  onGenerateQR,
  onRegenerateQR,
}) {
  async function openSignedUrl(path, label) {
    try {
      const res = await fetch(path, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) return
      const { url } = await res.json()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      console.warn(`[${label}] Failed to open`, err)
    }
  }

  const id = encodeURIComponent(s.student_id)
  const isOptimistic = s._optimistic
  const isQrGenerating = s._qrGenerating
  const isQrPlaceholder = s.qr_url === 'generating'

  return (
    <tr style={{ opacity: isOptimistic ? 0.75 : 1 }}>
      <td className="student-td-photo">
        {s.photo_url ? (
          <img className="student-photo" src={s.photo_url} alt="" style={{ opacity: isOptimistic ? 0.7 : 1 }} />
        ) : (
          <div className="avatar" aria-hidden="true">
            {getInitials(s.full_name)}
          </div>
        )}
      </td>

      <th scope="row" className="student-td-name">
        <div className="student-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {s.full_name}
          {isOptimistic && (
            <span style={{ fontSize: '10px', color: '#3B82F6', fontWeight: 500, whiteSpace: 'nowrap' }}>
              ● syncing
            </span>
          )}
        </div>
        <div className="student-meta">
          {s.student_id} · {s.year_level}
          {s.position ? ` · ${s.position}` : ''}
        </div>
        {issueNote && <div className="student-issue-note">{issueNote.note}</div>}
      </th>

      <td className="student-td-qr">
        <div className="student-actions">
          {isQrGenerating || isQrPlaceholder ? (
            <>
              <span
                className="student-chip"
                style={{
                  background: '#EFF6FF',
                  color: '#3B82F6',
                  borderColor: '#BFDBFE',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    border: '1.5px solid #3B82F6',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Generating...
              </span>
            </>
          ) : s.qr_url ? (
            <>
              <span className="student-chip student-chip--ready">QR ready</span>
              <button
                type="button"
                className="student-chip student-chip--link"
                onClick={() => openSignedUrl(`/api/students/preview-url/${id}`, 'Preview')}
              >
                View preview
                <span className="sr-only"> for {s.full_name}</span>
              </button>
              <button
                type="button"
                className="student-chip student-chip--gold"
                onClick={() => openSignedUrl(`/api/qr/verification-url/${id}`, 'QR Page')}
              >
                View page
                <span className="sr-only"> for {s.full_name}</span>
              </button>
              {userRole === 'admin' && (
                <button
                  type="button"
                  className="student-chip student-chip--danger"
                  onClick={() => onRegenerateQR(s.student_id)}
                  disabled={isQrGenerating}
                >
                  Regenerate
                  <span className="sr-only"> QR for {s.full_name}</span>
                </button>
              )}
            </>
          ) : (
            userRole === 'admin' && (
              <button
                type="button"
                className="student-chip student-chip--warn"
                onClick={() => onGenerateQR(s.student_id)}
                disabled={isQrGenerating}
              >
                Generate QR
                <span className="sr-only"> for {s.full_name}</span>
              </button>
            )
          )}
          {s.student_id && userRole === 'admin' && (
            <button
              type="button"
              className="student-chip student-chip--danger"
              onClick={() => onDelete(s)}
            >
              Delete
              <span className="sr-only"> {s.full_name}</span>
            </button>
          )}
        </div>
      </td>

      <td className="student-td-status">{statusPill(s.status)}</td>

      <td className="student-td-edit">
        <button type="button" className="btn-edit" onClick={() => onEdit(s)} disabled={isOptimistic}>
          Edit
          <span className="sr-only"> {s.full_name}</span>
        </button>
      </td>
    </tr>
  )
}
