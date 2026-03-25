import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function AboutPage() {
  const navigate = useNavigate()

  return (
    <div className="about-wrapper">
      <Navbar showLogin={true} />

      {/* Hero */}
      <div className="about-hero">
        <div className="about-hero-inner">
          <div className="about-goldway-tag">Built by</div>
          <h1 className="about-hero-title">GoldWay</h1>
          <p className="about-hero-tagline">Creative Design &amp; Production Services</p>
          <p className="about-hero-desc">
            Liberia-based design studio specialising in brand identity, print production,
            and digital solutions for institutions and organisations.
          </p>
        </div>
      </div>

      <div className="about-body">

        {/* About this portal */}
        <div className="about-section">
          <h2 className="about-section-title">About this portal</h2>
          <p className="about-section-text">
            This ID Card Verification Portal was designed and developed by GoldWay for the
            Liberia Medical Students Association (LMSA) and A.M. Dogliotti College of Medicine.
            It provides a seamless, fully digital workflow for student ID card photography,
            design, verification, and print production — from a single platform.
          </p>
          <p className="about-section-text" style={{ marginTop: '12px' }}>
            Students can preview their ID card before printing, confirm their details are correct,
            or flag any issues for correction — all online, without visiting an office.
          </p>
        </div>

        {/* Services */}
        <div className="about-section">
          <h2 className="about-section-title">What GoldWay offers</h2>
          <div className="about-services-grid">
            <div className="about-service-card">
              <div className="about-service-icon">🎨</div>
              <div className="about-service-name">Graphic Design</div>
              <div className="about-service-desc">Brand identity, ID cards, certificates, print layouts, and institutional materials.</div>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">📸</div>
              <div className="about-service-name">Photography</div>
              <div className="about-service-desc">On-site portrait and ID photography sessions for institutions and organisations.</div>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">🖨</div>
              <div className="about-service-name">Print Production</div>
              <div className="about-service-desc">PVC ID cards, business cards, banners, and institutional print materials.</div>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">💻</div>
              <div className="about-service-name">Digital Solutions</div>
              <div className="about-service-desc">Custom web portals, management systems, and digital tools for institutions.</div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="about-section">
          <h2 className="about-section-title">Get in touch</h2>
          <p className="about-section-text">
            Interested in working with GoldWay for your institution's design, photography,
            or print production needs? We would love to hear from you.
          </p>

          <div className="about-contact-card">
            <div className="about-contact-row">
              <div className="about-contact-avatar">EG</div>
              <div>
                <div className="about-contact-name">Emmett Stone Gbatu</div>
                <div className="about-contact-role">Founder, GoldWay</div>
              </div>
            </div>

            <div className="about-contact-divider" />

            <div className="about-contact-details">
              <a className="about-contact-item" href="tel:+231770405785">
                <div className="about-contact-label">Phone</div>
                <div className="about-contact-value">+231 770 405 785</div>
              </a>
              <a className="about-contact-item" href="mailto:goldway.estone@outlook.com">
                <div className="about-contact-label">Email</div>
                <div className="about-contact-value">goldway.estone@outlook.com</div>
              </a>
              <div className="about-contact-item">
                <div className="about-contact-label">Location</div>
                <div className="about-contact-value">Monrovia, Liberia</div>
              </div>
            </div>
          </div>
        </div>

        {/* Back CTA */}
        <div style={{ textAlign: 'center', paddingBottom: '32px' }}>
          <button className="btn-primary" style={{ maxWidth: '280px', margin: '0 auto' }} onClick={() => navigate('/')}>
            Back to Student Portal
          </button>
        </div>

      </div>
    </div>
  )
}
