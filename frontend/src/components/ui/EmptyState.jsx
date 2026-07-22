export default function EmptyState({ icon = '📋', title, message, action }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 'var(--space-10) var(--space-4)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-3)',
    }}>
      <div style={{ fontSize: '40px', lineHeight: 1 }}>{icon}</div>
      {title && (
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', color: 'var(--text)' }}>
          {title}
        </div>
      )}
      {message && (
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '320px', lineHeight: 1.5 }}>
          {message}
        </div>
      )}
      {action && <div style={{ marginTop: 'var(--space-2)' }}>{action}</div>}
    </div>
  )
}
