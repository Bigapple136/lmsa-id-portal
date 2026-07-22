export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`admin-card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 'var(--space-4)',
      gap: 'var(--space-3)',
    }}>
      <div>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-semibold)', color: 'var(--text)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', marginTop: '2px' }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  )
}

export function CardSection({ title, children }) {
  return (
    <div style={{ marginBottom: 'var(--space-4)' }}>
      {title && (
        <div className="section-title">{title}</div>
      )}
      {children}
    </div>
  )
}
