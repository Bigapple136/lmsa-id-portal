import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Navbar({ showLogin = true }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAbout = location.pathname === '/about'
  const isTerms = location.pathname === '/terms'
  const isPrivacy = location.pathname === '/privacy'

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand" onClick={() => navigate('/')}>
          <div className="navbar-brand-name">LMSA</div>
          <div className="navbar-brand-sub">ID Card Portal</div>
        </div>

        <div className="navbar-links">
          <button className={`navbar-link ${isAbout ? 'active' : ''}`} onClick={() => navigate('/about')}>About</button>
          <button className={`navbar-link ${isTerms ? 'active' : ''}`} onClick={() => navigate('/terms')}>Terms</button>
          <button className={`navbar-link ${isPrivacy ? 'active' : ''}`} onClick={() => navigate('/privacy')}>Privacy</button>
          {showLogin && (
            <button className="navbar-login" onClick={() => navigate('/admin')}>Admin Login</button>
          )}
        </div>

        <button
          className={`navbar-hamburger${menuOpen ? ' is-open' : ''}`}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span className="ham-line" />
          <span className="ham-line" />
          <span className="ham-line" />
        </button>
      </div>

      {menuOpen && (
        <div className="navbar-mobile-menu">
          <button className="navbar-mobile-link" onClick={() => { navigate('/about'); setMenuOpen(false) }}>About</button>
          <button className="navbar-mobile-link" onClick={() => { navigate('/terms'); setMenuOpen(false) }}>Terms</button>
          <button className="navbar-mobile-link" onClick={() => { navigate('/privacy'); setMenuOpen(false) }}>Privacy</button>
          {showLogin && (
            <button className="navbar-mobile-login" onClick={() => { navigate('/admin'); setMenuOpen(false) }}>Admin Login</button>
          )}
        </div>
      )}
    </nav>
  )
}
