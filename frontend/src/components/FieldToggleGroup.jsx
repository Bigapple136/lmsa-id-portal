export default function FieldToggleGroup({ items, onToggle, footer }) {
  return (
    <div className="field-toggle-panel">
      {items.map(({ key, label, enabled, locked }) => (
        <div
          key={key}
          className={`field-toggle-row ${enabled ? 'on' : ''} ${locked ? 'locked' : ''}`}
          onClick={() => onToggle(key)}
        >
          <div className="field-toggle-check">{enabled ? '✓' : ''}</div>
          <div className="field-toggle-label">{label}</div>
          {locked && <span className="field-toggle-badge">Always on</span>}
        </div>
      ))}
      {footer && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
