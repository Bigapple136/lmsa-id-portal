import EmptyState from '../../components/EmptyState'
import { YEARS } from './constants'
import StudentRow from './StudentRow'
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
                  className="u-bg-bg u-bd u-r u-p-12 u-mb-14"
                >
                  <div
                    className="u-fs-12 u-fw-500 u-c-text u-mb-8"
                  >
                    QR Code Management
                  </div>
                  <div className="u-fs-11 u-c-muted u-mb-10">
                    {students.filter((s) => s.qr_url).length} of {students.length} students have QR
                    codes generated.
                  </div>
                  <div className="btn-row">
                    <button
                      className="btn-gold u-fs-12 u-p-7-14"
                      onClick={handleGenerateAllQR}
                      disabled={qrGenerating}
                      
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
                      className="btn-outline u-fs-12 u-p-7-14"
                      onClick={() => handleDownload('/api/qr/export', 'LMSA_QR_Codes.zip')}
                      disabled={downloading['/api/qr/export']}
                      
>
                      {downloading['/api/qr/export'] ? 'Exporting...' : 'Export all as ZIP'}
                    </button>
                  </div>
                  {qrMsg && (
                    <div
                      className={`${qrMsg.ok ? 'success-box' : 'error-box'} u-mt-8 u-fs-12`}
                    >
                      {qrMsg.text}
                    </div>
                  )}
                </div>
              )}
  
              <div
                className="u-bg-bg u-bd u-r u-p-12 u-mb-14"
              >
                <div
                  className="u-fs-12 u-fw-500 u-c-text u-mb-8"
                >
                  Photoshoot Roster
                </div>
                <div className="u-fs-11 u-c-muted u-mb-10">
                  Export a printable roster with student names, ID numbers, and signature spaces for
                  the photoshoot session.
                </div>
                <button
                  className="btn-outline u-fs-12 u-p-7-14"
                  onClick={() =>
                    handleDownload('/api/students/export/photoshoot', 'LMSA_Photoshoot_Roster.pdf')
                  }
                  disabled={downloading['/api/students/export/photoshoot']}
                  
>
                  {downloading['/api/students/export/photoshoot']
                    ? 'Exporting...'
                    : 'Export Photoshoot Roster (PDF)'}
                </button>
              </div>
  
              <div
                className="u-bg-bg u-bd u-r u-p-12 u-mb-14"
              >
                <div
                  className="u-fs-12 u-fw-500 u-c-text u-mb-8"
                >
                  Card Design Roster
                </div>
                <div className="u-fs-11 u-c-muted u-mb-10">
                  Export a Word document with each student's front- and back-facing card
                  details (QR included) for the design team.
                </div>
                <button
                  className="btn-outline u-fs-12 u-p-7-14"
                  onClick={() =>
                    handleDownload('/api/students/export/card-design', 'LMSA_Card_Design_Roster.docx')
                  }
                  disabled={downloading['/api/students/export/card-design']}
                  
>
                  {downloading['/api/students/export/card-design']
                    ? 'Exporting...'
                    : 'Export Card Design Roster (DOCX)'}
                </button>
              </div>
  
              <div
                className="u-flex u-gap-8 u-mb-14 u-ai-center"
              >
                <input
                  className="field-input u-flex-1"
                  placeholder="Search by name or student ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setCurrentPage(1)
                  }}
                  
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
                    <div className="student-table-wrap">
                      <table className="student-table">
                        <caption className="sr-only">
                          Students, page {safePage} of {totalPages}. {filtered.length} matching
                          {filtered.length === 1 ? ' student' : ' students'}.
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col" className="student-th-photo">
                              <span className="sr-only">Photo</span>
                            </th>
                            <th scope="col">Student</th>
                            <th scope="col">Credential</th>
                            <th scope="col">Status</th>
                            <th scope="col">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageStudents.map((s) => (
                            <StudentRow
                              key={s.id}
                              student={s}
                              session={session}
                              userRole={userRole}
                              issueNote={issueNotes[s.student_id]}
                              statusPill={statusPill}
                              getInitials={getInitials}
                              onEdit={openEdit}
                              onDelete={handleDeleteStudent}
                              onGenerateQR={handleGenerateQR}
                              onRegenerateQR={handleRegenerateQR}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
  
                    {/* Pagination */}
                    <div
                      className="u-flex u-ai-center u-jc-center u-gap-4 u-mt-14 u-wrap"
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
