export default function Select({ label, error, options = [], id, placeholder = 'Select...', className = '', ...props }) {
  const inputId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="field-group">
      {label && <label className="field-label" htmlFor={inputId}>{label}</label>}
      <select
        id={inputId}
        className={`field-input ${error ? 'field-input--error' : ''} ${className}`}
        style={{ appearance: 'auto', cursor: 'pointer' }}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  )
}
