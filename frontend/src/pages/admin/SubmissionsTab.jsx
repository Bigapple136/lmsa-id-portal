import EmptyState from '../../components/EmptyState'
import StatusBadge from '../../components/StatusBadge'
import { useDashboard } from './DashboardContext'

export default function SubmissionsTab() {
  const {
    handleApproveSubmission,
    handleDeleteSubmission,
    handleRejectSubmission,
    loadSubmissions,
    setSubmissionsFilter,
    submissionMsg,
    submissions,
    submissionsFilter,
    submissionsLoading,
  } = useDashboard()

  return (
  <div>
              <div className="section-title">Submissions</div>
              <div className="mode-toggle">
                {['pending', 'approved', 'rejected', 'all'].map((f) => (
                  <button
                    key={f}
                    className={`mode-btn ${submissionsFilter === f ? 'active' : ''}`}
                    onClick={() => {
                      setSubmissionsFilter(f)
                      setTimeout(() => loadSubmissions(f), 0)
                    }}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              {submissionMsg && (
                <div
                  className={`${submissionMsg.warn ? 'info-box' : submissionMsg.ok ? 'success-box' : 'error-box'} u-mb-10 u-fs-13`}
                >
                  {submissionMsg.text}
                </div>
              )}
              {submissionsLoading ? (
                <div>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton skeleton-row" />
                  ))}
                </div>
              ) : submissions.length === 0 ? (
                <EmptyState>No {submissionsFilter} submissions.</EmptyState>
              ) : (
                <div>
                  {submissions.map((s) => (
                    <div key={s.id} className="student-row">
                      <div className="avatar">
                        {s.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="student-info">
                        <div className="student-name">{s.full_name}</div>
                        <div className="student-meta">
                          {s.student_id} · {s.year_level}
                          {s.position ? ` · ${s.position}` : ''}
                        </div>
                        <div className="student-meta" style={{ fontSize: '10px', marginTop: '1px' }}>
                          Submitted{' '}
                          {new Date(s.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {s.reviewed_at &&
                            ` · Reviewed ${new Date(s.reviewed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`}
                        </div>
                        {s.admin_notes && (
                          <div className="student-issue-note">Note: {s.admin_notes}</div>
                        )}
                      </div>
                      <StatusBadge status={s.status} />
                      <div className="u-flex u-gap-4 u-shrink-0">
                        {s.status === 'pending' && (
                          <>
                            <button
                              className="btn-gold u-fs-10 u-p-4-8"
                              
onClick={() => handleApproveSubmission(s.id)}
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
                              onClick={() => handleRejectSubmission(s)}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          className="btn-outline u-fs-10 u-p-4-8"
                          
onClick={() => handleDeleteSubmission(s)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
  )
}
