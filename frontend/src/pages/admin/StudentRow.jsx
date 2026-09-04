/**
 * One row of the admin student table.
 *
 * Split out of StudentsTab so the row markup stays readable, and converted
 * from a stack of <div>s to real <tr>/<td> cells so the list is navigable as
 * a table. The pill/action styling that was previously inline now lives in
 * index.css under .student-* classes.
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
  // Opens a short-lived signed URL in a new tab. Failures are non-fatal: the
  // admin can retry, so we warn rather than surface an error state per row.
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

  return (
    <tr>
      <td className="student-td-photo">
        {s.photo_url ? (
          <img className="student-photo" src={s.photo_url} alt="" />
        ) : (
          <div className="avatar" aria-hidden="true">
            {getInitials(s.full_name)}
          </div>
        )}
      </td>

      <th scope="row" className="student-td-name">
        <div className="student-name">{s.full_name}</div>
        <div className="student-meta">
          {s.student_id} · {s.year_level}
          {s.position ? ` · ${s.position}` : ''}
        </div>
        {issueNote && <div className="student-issue-note">{issueNote.note}</div>}
      </th>

      <td className="student-td-qr">
        <div className="student-actions">
          {s.qr_url ? (
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
        <button type="button" className="btn-edit" onClick={() => onEdit(s)}>
          Edit
          <span className="sr-only"> {s.full_name}</span>
        </button>
      </td>
    </tr>
  )
}
