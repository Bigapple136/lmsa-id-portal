const variants = {
  primary: 'btn--primary',
  gold: 'btn--gold',
  outline: 'btn--outline',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
}

const sizes = {
  sm: 'btn--sm',
  md: 'btn--md',
  lg: 'btn--lg',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  disabled = false,
  className = '',
  ...props
}) {
  return (
    <button
      className={`btn ${variants[variant]} ${sizes[size]} ${full ? 'btn--full' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner spinner--light" />}
      {children}
    </button>
  )
}
