import { Bar, Doughnut } from 'react-chartjs-2'
import EmptyState from '../../components/EmptyState'
import { useDashboard } from './DashboardContext'

export default function OverviewTab() {
  const {
    activeTemplateBack,
    activeTemplateFront,
    analyticsData,
    dataLoading,
    getInitials,
    navigate,
    recentActivity,
    selectTab,
    setActiveTab,
    setStatusFilter,
    stats,
    statusPill,
    userRole,
  } = useDashboard()

  return (
  <div>
              {/* ── Stats Row ── */}
              <div className="dashboard-stats">
                {dataLoading
                  ? [1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="stat-box">
                        <div className="skeleton skeleton-title" style={{ marginBottom: 8 }} />
                        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                      </div>
                    ))
                  : (
                    <>
                      <div className="stat-box">
                        <div className="stat-num">{stats.total}</div>
                        <div className="stat-lbl">Total Students</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-num confirmed">{stats.confirmed}</div>
                        <div className="stat-lbl">Confirmed</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-num pending">{stats.pending}</div>
                        <div className="stat-lbl">Pending</div>
                      </div>
                      <button
                        type="button"
                        className="stat-box stat-box--action"
                        disabled={!stats.issues}
                        onClick={() => {
                          setStatusFilter('issues')
                          selectTab('students')
                        }}
                      >
                        <div className="stat-num issue">{stats.issues}</div>
                        <div className="stat-lbl">Issues</div>
                      </button>
                      <div className="stat-box">
                        <div className="stat-num issue">{analyticsData?.corrections_by_field?.name || 0}</div>
                        <div className="stat-lbl">Name Corrections</div>
                      </div>
                      <button
                        type="button"
                        className="stat-box stat-box--action"
                        disabled={!analyticsData?.photo_issues}
                        onClick={() => {
                          setStatusFilter('issues')
                          selectTab('students')
                        }}
                      >
                        <div className="stat-num issue">{analyticsData?.photo_issues || 0}</div>
                        <div className="stat-lbl">Photo Issues</div>
                      </button>
                    </>
                  )
                }
              </div>
  
              {/* ── Charts Row ── */}
              <div className="dashboard-charts">
                {/* Status Distribution Doughnut */}
                <div className="chart-card">
                  <div className="chart-card-title">Status Distribution</div>
                  <div className="chart-card-sub">Overview of all student card statuses</div>
                  <div className="chart-wrap">
                    {dataLoading ? (
                      <div className="skeleton skeleton-card" style={{ width: '180px', height: '180px', borderRadius: '50%' }} />
                    ) : (
                      <Doughnut
                        data={{
                          labels: ['Confirmed', 'Pending', 'Issues'],
                          datasets: [{
                            data: [stats.confirmed, stats.pending, stats.issues],
                            backgroundColor: ['#16805d', '#aa7610', '#c24747'],
                            borderWidth: 0,
                            hoverOffset: 6,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          cutout: '68%',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#0D1B2A',
                              titleFont: { size: 12, weight: '600' },
                              bodyFont: { size: 11 },
                              padding: 10,
                              cornerRadius: 8,
                              displayColors: true,
                              boxPadding: 4,
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                  {!dataLoading && stats.total > 0 && (
                    <div className="chart-legend">
                      <div className="chart-legend-item">
                        <span className="chart-legend-dot" style={{ background: '#16805d' }} />
                        Confirmed ({stats.confirmed})
                      </div>
                      <div className="chart-legend-item">
                        <span className="chart-legend-dot" style={{ background: '#aa7610' }} />
                        Pending ({stats.pending})
                      </div>
                      <div className="chart-legend-item">
                        <span className="chart-legend-dot" style={{ background: '#c24747' }} />
                        Issues ({stats.issues})
                      </div>
                    </div>
                  )}
                </div>
  
                {/* Corrections Bar Chart */}
                <div className="chart-card">
                  <div className="chart-card-title">Corrections & Issues</div>
                  <div className="chart-card-sub">Breakdown of correction types and photo problems</div>
                  <div className="chart-wrap" style={{ minHeight: '220px' }}>
                    {dataLoading ? (
                      <div className="skeleton skeleton-card" style={{ width: '100%', height: '160px' }} />
                    ) : (
                      <Bar
                        data={{
                          labels: ['Name Corrections', 'Year Corrections', 'Photo Issues'],
                          datasets: [{
                            data: [
                              analyticsData?.corrections_by_field?.name || 0,
                              analyticsData?.corrections_by_field?.year || 0,
                              analyticsData?.photo_issues || 0,
                            ],
                            backgroundColor: ['#c24747', '#aa7610', '#5b8def'],
                            borderRadius: 6,
                            barThickness: 36,
                          }],
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          indexAxis: 'y',
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#0D1B2A',
                              titleFont: { size: 12, weight: '600' },
                              bodyFont: { size: 11 },
                              padding: 10,
                              cornerRadius: 8,
                            },
                          },
                          scales: {
                            x: {
                              beginAtZero: true,
                              ticks: {
                                stepSize: 1,
                                font: { size: 11 },
                                color: '#6B7280',
                              },
                              grid: { color: '#f0f0f0', drawBorder: false },
                            },
                            y: {
                              ticks: {
                                font: { size: 12, weight: '500' },
                                color: '#0D1B2A',
                              },
                              grid: { display: false },
                            },
                          },
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
  
              {/* ── Bottom Row: Template + Quick Actions ── */}
              <div className="dashboard-bottom">
                <div className="template-card">
                  <div className="chart-card-title">Active Template</div>
                  <div className="chart-card-sub">Current card design being used</div>
                  {dataLoading ? (
                    <div className="skeleton skeleton-row u-mt-14"  />
                  ) : activeTemplateFront || activeTemplateBack ? (
                    <>
                      {activeTemplateFront && (
                        <div className="template-card-inner">
                          <div className="template-icon" aria-hidden="true">🎨</div>
                          <div className="template-info">
                            <div className="template-name">{activeTemplateFront.file_name}</div>
                            <div className="template-meta">
                              Front · Uploaded{' '}
                              {new Date(activeTemplateFront.uploaded_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              · {stats.total} cards
                            </div>
                          </div>
                          <span className="pill pill-green">Active</span>
                        </div>
                      )}
                      {activeTemplateBack && (
                        <div className="template-card-inner">
                          <div className="template-icon" aria-hidden="true">🔙</div>
                          <div className="template-info">
                            <div className="template-name">{activeTemplateBack.file_name}</div>
                            <div className="template-meta">
                              Back · Uploaded{' '}
                              {new Date(activeTemplateBack.uploaded_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}{' '}
                              · {stats.total} cards
                            </div>
                          </div>
                          <span className="pill pill-green">Active</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="error-box u-mt-14" >
                      No template uploaded.{' '}
                      <span
                        style={{ textDecoration: 'underline', cursor: 'pointer' }}
                        onClick={() => setActiveTab('upload')}
                      >
                        Upload now →
                      </span>
                    </div>
                  )}
                </div>
  
                <div className="quick-actions-card">
                  <div className="chart-card-title">Quick Actions</div>
                  <div className="chart-card-sub">Jump to common tasks</div>
                  <div className="quick-actions-grid">
                    <button className="quick-action-btn" onClick={() => setActiveTab('upload')}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#eefafb', color: 'var(--teal)' }}>⬆</div>
                      Upload Data
                    </button>
                    <button className="quick-action-btn" onClick={() => { setActiveTab('students'); }}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#e6f4ec', color: 'var(--success-text)' }}>👤</div>
                      View Students
                    </button>
                    <button className="quick-action-btn" onClick={() => selectTab('submissions')}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#fef6e4', color: 'var(--warn-text)' }}>📋</div>
                      Submissions
                    </button>
                    <button className="quick-action-btn" onClick={() => setActiveTab('layout')}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#eef2f7', color: 'var(--navy-mid)' }}>🎨</div>
                      Card Layout
                    </button>
                    <button className="quick-action-btn" onClick={() => setActiveTab('settings')}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#f3f4f6', color: 'var(--muted)' }}>⚙</div>
                      Settings
                    </button>
                    {userRole === 'admin' && (
                      <button className="quick-action-btn" onClick={() => navigate('/admin/admins')}>
                        <div className="quick-action-icon" aria-hidden="true" style={{ background: '#fef6e4', color: 'var(--gold)' }}>👥</div>
                        Manage Admins
                      </button>
                    )}
                    <button className="quick-action-btn" onClick={() => navigate('/admin/qr-keys')}>
                      <div className="quick-action-icon" aria-hidden="true" style={{ background: '#eefafb', color: 'var(--teal)' }}>🔐</div>
                      QR Key Security
                    </button>
                  </div>
                </div>
              </div>
  
              {/* ── Recent Activity ── */}
              <div className="recent-activity-card">
                <div className="chart-card-title">Recent Activity</div>
                <div className="chart-card-sub">Latest student additions and updates</div>
                {dataLoading ? (
                  <div className="u-mt-14">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="skeleton skeleton-row" />
                    ))}
                  </div>
                ) : recentActivity.length === 0 ? (
                  <EmptyState>No students yet.</EmptyState>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    {recentActivity.map((s) => (
                      <div className="student-row" key={s.id}>
                        <div className="avatar">{getInitials(s.full_name)}</div>
                        <div className="student-info">
                          <div className="student-name">{s.full_name}</div>
                          <div className="student-meta">
                            {s.student_id} · {s.year_level}
                            {s.position ? ` · ${s.position}` : ''}
                          </div>
                        </div>
                        {statusPill(s.status)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
  )
}
