import EmptyState from '../../components/EmptyState'
import { YEARS } from './constants'
import { useDashboard } from './DashboardContext'

export default function StudentsTab() {
  const {
    PAGE_SIZE,
    currentPage,
    dataLoading,
    downloading,
    filtered,
    getInitials,
    handleDeleteStudent,
    handleDownload,
    handleGenerateAllQR,
    handleGenerateQR,
    handleRegenerateAllQR,
    handleRegenerateQR,
    issueNotes,
    openEdit,
    qrGenerating,
    qrMsg,
    search,
    session,
    setActiveTab,
    setCurrentPage,
    setSearch,
    setStatusFilter,
    setUploadMode,
    setYearFilter,
    statusFilter,
    statusPill,
    students,
    userRole,
    yearFilter,
  } = useDashboard()

  return (
  <div>
              {/* QR bulk controls - admin only */}
              {userRole === 'admin' && (
                <div
                  style={{
                    background: 'var(--bg)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    marginBottom: '14px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'var(--text)',
                      marginBottom: '8px',
                    }}
                  >
                    QR Code Management
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                    {students.filter((s) => s.qr_url).length} of {students.length} students have QR
                    codes generated.
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn-gold"
                      onClick={handleGenerateAllQR}
                      disabled={qrGenerating}
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                    >
                      {qrGenerating ? 'Generating...' : 'Generate missing QR codes'}
                    </button>
                    <button
                      className="btn-outline"
                      onClick={handleRegenerateAllQR}
                      disabled={qrGenerating}
                      style={{
                        fontSize: '12px',
                        padding: '7px 14px',
                        borderColor: '#CC0000',
                        color: '#CC0000',
                      }}
                    >
                      {qrGenerating ? 'Regenerating...' : 'Regenerate all'}
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => handleDownload('/api/qr/export', 'LMSA_QR_Codes.zip')}
                      disabled={downloading['/api/qr/export']}
                      style={{ fontSize: '12px', padding: '7px 14px' }}
                    >
                      {downloading['/api/qr/export'] ? 'Exporting...' : 'Export all as ZIP'}
                    </button>
                  </div>
                  {qrMsg && (
                    <div
                      className={qrMsg.ok ? 'success-box' : 'error-box'}
                      style={{ marginTop: '8px', fontSize: '12px' }}
                    >
                      {qrMsg.text}
                    </div>
                  )}
                </div>
              )}
  
              <div
                style={{
                  background: 'var(--bg)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px',
                  marginBottom: '14px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  Photoshoot Roster
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Export a printable roster with student names, ID numbers, and signature spaces for
                  the photoshoot session.
                </div>
                <button
                  className="btn-outline"
                  onClick={() =>
                    handleDownload('/api/students/export/photoshoot', 'LMSA_Photoshoot_Roster.pdf')
                  }
                  disabled={downloading['/api/students/export/photoshoot']}
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  {downloading['/api/students/export/photoshoot']
                    ? 'Exporting...'
                    : 'Export Photoshoot Roster (PDF)'}
                </button>
              </div>
  
              <div
                style={{
                  background: 'var(--bg)',
                  border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '12px',
                  marginBottom: '14px',
                }}
              >
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  Card Design Roster
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
                  Export a Word document with each student's front- and back-facing card
                  details (QR included) for the design team.
                </div>
                <button
                  className="btn-outline"
                  onClick={() =>
                    handleDownload('/api/students/export/card-design', 'LMSA_Card_Design_Roster.docx')
                  }
                  disabled={downloading['/api/students/export/card-design']}
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  {downloading['/api/students/export/card-design']
                    ? 'Exporting...'
                    : 'Export Card Design Roster (DOCX)'}
                </button>
              </div>
  
              <div
                style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}
              >
                <input
                  className="field-input"
                  placeholder="Search by name or student ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  style={{ flex: 1 }}
                />
                <select
                  className="field-input"
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  style={{ width: 'auto', minWidth: '130px', fontSize: '13px' }}
                >
                  <option value="all">All Classes</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <select
                  className="field-input"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setCurrentPage(1)
                  }}
                  style={{ width: 'auto', minWidth: '120px', fontSize: '13px' }}
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="issues">Issues</option>
                </select>
                <button
                  className="btn-gold"
                  onClick={() => {
                    setActiveTab('upload')
                    setUploadMode('manual')
                  }}
                >
                  + Add
                </button>
              </div>
              {dataLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="skeleton skeleton-row" />
                ))
              ) : filtered.length === 0 ? (
                <EmptyState>{search ? 'No students match your search.' : 'No students added yet.'}</EmptyState>
              ) : (() => {
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
                const safePage = Math.min(currentPage, totalPages)
                const pageStart = (safePage - 1) * PAGE_SIZE
                const pageEnd = safePage * PAGE_SIZE
                const pageStudents = filtered.slice(pageStart, pageEnd)
                const pageNums = Array.from({ length: totalPages }, (_, i) => i + 1)
                const visiblePages = pageNums.filter(
                  (p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1,
                )
                const trimmedPages = visiblePages.reduce((acc, p, i) => {
                  if (i > 0 && p - visiblePages[i - 1] > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                return (
                  <>
                    {pageStudents.map((s) => (
                      <div className="student-row" key={s.id}>
                        {s.photo_url ? (
                          <img
                            src={s.photo_url}
                            alt={s.full_name}
                            style={{
                              width: '30px',
                              height: '36px',
                              borderRadius: '3px',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                        ) : (
                          <div className="avatar">{getInitials(s.full_name)}</div>
                        )}
                        <div className="student-info">
                          <div className="student-name">{s.full_name}</div>
                          <div className="student-meta">
                            {s.student_id} · {s.year_level}
                            {s.position ? ` · ${s.position}` : ''}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '2px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {s.qr_url ? (
                              <>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--success-text)',
                                    background: 'var(--success-bg)',
                                    padding: '1px 7px',
                                    borderRadius: '20px',
                                    border: '0.5px solid var(--success-border)',
                                  }}
                                >
                                  QR ready
                                </span>
                                <button
                                  style={{
                                    fontSize: '10px',
                                    color: '#5b8def',
                                    background: 'transparent',
                                    padding: '1px 7px',
                                    borderRadius: '20px',
                                    border: '0.5px solid #5b8def',
                                    cursor: 'pointer',
                                  }}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/api/students/preview-url/${encodeURIComponent(s.student_id)}`,
                                        {
                                          headers: {
                                            Authorization: `Bearer ${session.access_token}`,
                                          },
                                        },
                                      )
                                      if (!res.ok) return
                                      const { url } = await res.json()
                                      window.open(url, '_blank', 'noopener,noreferrer')
                                    } catch (err) {
                                      console.warn('[Preview] Failed to open preview', err)
                                    }
                                  }}
                                >
                                  View preview
                                </button>
                                <button
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--gold)',
                                    background: 'transparent',
                                    padding: '1px 7px',
                                    borderRadius: '20px',
                                    border: '0.5px solid var(--gold)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/api/qr/verification-url/${encodeURIComponent(s.student_id)}`,
                                        {
                                          headers: {
                                            Authorization: `Bearer ${session.access_token}`,
                                          },
                                        },
                                      )
                                      if (!res.ok) return
                                      const { url } = await res.json()
                                      window.open(url, '_blank', 'noopener,noreferrer')
                                    } catch (err) {
                                      console.warn('[QR Page] Failed to open verification page', err)
                                    }
                                  }}
                                >
                                  View page
                                </button>
                                {userRole === 'admin' && (
                                  <button
                                    style={{
                                      fontSize: '10px',
                                      color: '#CC0000',
                                      background: 'transparent',
                                      padding: '1px 7px',
                                      borderRadius: '20px',
                                      border: '0.5px solid #CC0000',
                                      cursor: 'pointer',
                                    }}
                                    onClick={async () => {
                                      await handleRegenerateQR(s.student_id)
                                    }}
                                  >
                                    Regenerate
                                  </button>
                                )}
                              </>
                            ) : (
                              userRole === 'admin' && (
                                <button
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--warn-text)',
                                    background: 'var(--warn-bg)',
                                    padding: '1px 7px',
                                    borderRadius: '20px',
                                    border: '0.5px solid var(--warn-border)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={async () => {
                                    await handleGenerateQR(s.student_id)
                                  }}
                                >
                                  Generate QR
                                </button>
                              )
                            )}
                            {s.student_id && userRole === 'admin' && (
                              <button
                                type="button"
                                style={{
                                  fontSize: '10px',
                                  color: '#CC0000',
                                  background: 'transparent',
                                  padding: '1px 7px',
                                  borderRadius: '20px',
                                  border: '0.5px solid #CC0000',
                                  cursor: 'pointer',
                                }}
                                onClick={() => handleDeleteStudent(s)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {issueNotes[s.student_id] && (
                            <div className="student-issue-note">{issueNotes[s.student_id].note}</div>
                          )}
                        </div>
                        {statusPill(s.status)}
                        <button className="btn-edit" onClick={() => openEdit(s)}>
                          Edit
                        </button>
                      </div>
                    ))}
  
                    {/* Pagination */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        marginTop: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={safePage === 1}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          border: '0.5px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--bg)',
                          cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                          opacity: safePage === 1 ? 0.4 : 1,
                        }}
                      >
                        ‹ Prev
                      </button>
                      {trimmedPages.map((p, i) =>
                        p === '…' ? (
                          <span
                            key={`ellipsis-${i}`}
                            style={{ padding: '4px 4px', fontSize: '12px', color: 'var(--muted)' }}
                          >
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              border: '0.5px solid',
                              borderColor: safePage === p ? 'var(--gold)' : 'var(--border)',
                              borderRadius: '6px',
                              background: safePage === p ? 'var(--gold)' : 'var(--bg)',
                              color: safePage === p ? '#0D1B2A' : 'var(--text)',
                              cursor: 'pointer',
                              fontWeight: safePage === p ? '600' : '400',
                            }}
                          >
                            {p}
                          </button>
                        ),
                      )}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage === totalPages}
                        style={{
                          padding: '4px 10px',
                          fontSize: '12px',
                          border: '0.5px solid var(--border)',
                          borderRadius: '6px',
                          background: 'var(--bg)',
                          cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                          opacity: safePage === totalPages ? 0.4 : 1,
                        }}
                      >
                        Next ›
                      </button>
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '6px' }}>
                        {pageStart + 1}–{Math.min(pageEnd, filtered.length)} of {filtered.length}
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
  )
}
