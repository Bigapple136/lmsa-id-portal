export function SkeletonText({ width = '100%', height = '12px' }) {
  return <div className="skeleton skeleton-text" style={{ width, height }} />
}

export function SkeletonTitle({ width = '60%' }) {
  return <div className="skeleton skeleton-title" style={{ width }} />
}

export function SkeletonCard({ height = '120px' }) {
  return <div className="skeleton skeleton-card" style={{ height }} />
}

export function SkeletonRow({ count = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-row" />
      ))}
    </div>
  )
}

export function SkeletonAvatar({ size = '32px' }) {
  return <div className="skeleton skeleton-avatar" style={{ width: size, height: size }} />
}
