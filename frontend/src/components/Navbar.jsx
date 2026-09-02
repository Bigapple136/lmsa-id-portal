/* eslint-disable react/prop-types */
import { Link, NavLink } from 'react-router-dom'
import { useState } from 'react'

export default function Navbar({ showLogin = true, hideMenu = false }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)
  const navClass = ({ isActive }) => `navbar-link${isActive ? ' active' : ''}`

  return (
    <nav className="navbar" aria-label="Public navigation">
      <div className="navbar-inner">
        <Link className="navbar-brand" to="/" aria-label="LMSA ID Card Portal home">
          <img src="/lmsa-logo.png" alt="LMSA" className="navbar-brand-logo" />
          <div className="navbar-brand-text">
            <div className="navbar-brand-name">LMSA</div>
            <div className="navbar-brand-sub">ID Card Portal</div>
          </div>
        </Link>

        {!hideMenu && (
          <div className="navbar-links">
            <NavLink className={navClass} to="/about">
              About
            </NavLink>
            <NavLink className={navClass} to="/terms">
              Terms
            </NavLink>
            <NavLink className={navClass} to="/privacy">
              Privacy
            </NavLink>

            {showLogin && (
              <Link className="navbar-login" to="/admin">
                Admin Login
              </Link>
            )}
          </div>
        )}

        {!hideMenu && (
          <button
            className={`navbar-hamburger${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle public navigation menu"
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
          >
            <span className="ham-line" />
            <span className="ham-line" />
            <span className="ham-line" />
          </button>
        )}
      </div>

      {!hideMenu && menuOpen && (
        <div className="navbar-mobile-menu" id="public-mobile-menu">
          <NavLink className="navbar-mobile-link" to="/about" onClick={closeMenu}>
            About
          </NavLink>
          <NavLink className="navbar-mobile-link" to="/terms" onClick={closeMenu}>
            Terms
          </NavLink>
          <NavLink className="navbar-mobile-link" to="/privacy" onClick={closeMenu}>
            Privacy
          </NavLink>
          {showLogin && (
            <Link className="navbar-mobile-login" to="/admin" onClick={closeMenu}>
              Admin Login
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
