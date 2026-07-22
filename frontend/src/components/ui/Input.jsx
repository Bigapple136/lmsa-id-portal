export default function Input({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}) {
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="field-group">
      {label && (
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`field-input ${error ? 'field-input--error' : ''} ${className}`}
        {...props}
      />
      {error && <span className="field-error">{error}</span>}
      {hint && !error && <span className="field-error" style={{ color: 'var(--hint)' }}>{hint}</span>}
    </div>
  )
}
