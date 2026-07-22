const variants = {
  green: 'pill-green',
  amber: 'pill-amber',
  gray: 'pill-gray',
  blue: 'pill-blue',
  photo: 'pill-photo',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`pill ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
