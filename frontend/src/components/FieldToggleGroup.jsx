export default function FieldToggleGroup({ items, onToggle, footer }) {
  return (
    <div className="field-toggle-panel">
      {items.map(({ key, label, enabled, locked }) => (
        <button
          key={key}
          type="button"
          className={`field-toggle-row ${enabled ? 'on' : ''} ${locked ? 'locked' : ''}`}
          onClick={() => onToggle(key)}
          role="switch"
          aria-checked={Boolean(enabled)}
          disabled={locked}
          aria-describedby={locked ? `${key}-locked-note` : undefined}
        >
          <span className="field-toggle-check" aria-hidden="true">
            {enabled ? '✓' : ''}
          </span>
          <span className="field-toggle-label">{label}</span>
          {locked && (
            <span id={`${key}-locked-note`} className="field-toggle-badge">
              Always on
            </span>
          )}
        </button>
      ))}
      {footer && (
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
