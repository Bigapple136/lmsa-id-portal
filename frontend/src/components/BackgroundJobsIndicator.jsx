/**
 * BackgroundJobsIndicator
 * 
 * Shows pending background operations from optimistic UI.
 * Allows admin to see what's syncing without blocking their workflow.
 * Non-intrusive - appears as a small floating panel.
 */
export default function BackgroundJobsIndicator({ jobs, onClear }) {
  if (!jobs || jobs.length === 0) return null

  const pendingJobs = jobs.filter((j) => j.status === 'pending')
  const errorJobs = jobs.filter((j) => j.status === 'error')
  const successJobs = jobs.filter((j) => j.status === 'success')

  // Don't show if only success jobs that will auto-remove
  if (pendingJobs.length === 0 && errorJobs.length === 0 && successJobs.length === 0) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        background: 'var(--white)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        minWidth: '280px',
        maxWidth: '360px',
        overflow: 'hidden',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
          {pendingJobs.length > 0 && (
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#3B82F6',
                display: 'inline-block',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          <span>
            {pendingJobs.length > 0
              ? `${pendingJobs.length} syncing in background`
              : errorJobs.length > 0
                ? `${errorJobs.length} failed`
                : `${successJobs.length} completed`}
          </span>
        </div>
        {jobs.length > 0 && (
          <button
            onClick={onClear}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '11px',
              color: 'var(--muted)',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {pendingJobs.map((job) => (
          <div
            key={job.id}
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid var(--border)',
              background: '#F8FAFC',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid #3B82F6',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--text)' }}>{job.label}</span>
            <span style={{ fontSize: '10px', color: 'var(--muted)' }}>syncing...</span>
          </div>
        ))}

        {errorJobs.map((job) => (
          <div
            key={job.id}
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--error-bg)',
            }}
          >
            <span style={{ color: 'var(--error-text)', flexShrink: 0 }}>✕</span>
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--error-text)' }}>{job.label}</span>
            <span style={{ fontSize: '10px', color: 'var(--error-text)' }}>failed</span>
          </div>
        ))}

        {successJobs.map((job) => (
          <div
            key={job.id}
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--success-bg)',
            }}
          >
            <span style={{ color: 'var(--success-text)', flexShrink: 0 }}>✓</span>
            <span style={{ flex: 1, fontSize: '12px', color: 'var(--success-text)' }}>{job.label}</span>
            <span style={{ fontSize: '10px', color: 'var(--success-text)' }}>done</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
