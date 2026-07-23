import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const navigate = useNavigate()

  return (
    <footer className="footer">
      <div className="footer-inner">
        <span className="footer-copy">© 2026 GoldWay. All rights reserved.</span>
        <span className="footer-sep">·</span>
        <button className="footer-link" onClick={() => navigate('/about')}>
          About
        </button>
      </div>
    </footer>
  )
}
