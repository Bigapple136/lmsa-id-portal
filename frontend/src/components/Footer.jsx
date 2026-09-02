import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-copy">© 2026 GoldWay. All rights reserved.</span>
        <span className="footer-sep" aria-hidden="true">
          ·
        </span>
        <Link className="footer-link" to="/terms">
          Terms of Service
        </Link>
        <span className="footer-sep" aria-hidden="true">
          ·
        </span>
        <Link className="footer-link" to="/privacy">
          Privacy Policy
        </Link>
        <span className="footer-sep" aria-hidden="true">
          ·
        </span>
        <Link className="footer-link" to="/about">
          About
        </Link>
      </div>
    </footer>
  )
}
