import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function AboutPage() {
  return (
    <div className="about-wrapper">
      <Navbar />
      <div className="about-hero">
        <div className="about-hero-inner">
          <div className="about-goldway-tag">Empowering through design</div>
          <h1 className="about-hero-title">GoldWay</h1>
          <p className="about-hero-tagline">Design &bull; Print &bull; Digital Solutions</p>
          <p className="about-hero-desc">
            GoldWay provides comprehensive design, photography, print production, and digital
            solutions to organizations across Liberia.
          </p>
        </div>
      </div>

      <div className="about-body">
        <div className="about-section">
          <h2 className="about-section-title">About this portal</h2>
          <p className="about-section-text">
            The LIMSA ID Card Portal is a secure digital platform developed by GoldWay for the
            Liberia Medical Students Association (LIMSA) at the A.M. Dogliotti College of Medicine,
            University of Liberia. It streamlines student identification, card generation, and
            credential verification.
          </p>
        </div>

        <div className="about-section">
          <h2 className="about-section-title">Our services</h2>
          <div className="about-services-grid">
            <div className="about-service-card">
              <div className="about-service-icon">🎨</div>
              <h3 className="about-service-name">Graphic Design</h3>
              <p className="about-service-desc">
                Brand identity, layout design, and visual communication tailored to your
                organization.
              </p>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">📸</div>
              <h3 className="about-service-name">Photography</h3>
              <p className="about-service-desc">
                Professional portrait, event, and product photography with modern equipment.
              </p>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">🖨️</div>
              <h3 className="about-service-name">Print Production</h3>
              <p className="about-service-desc">
                High-quality ID cards, brochures, banners, and other print materials.
              </p>
            </div>
            <div className="about-service-card">
              <div className="about-service-icon">💻</div>
              <h3 className="about-service-name">Digital Solutions</h3>
              <p className="about-service-desc">
                Web portals, verification systems, and custom software for organizations.
              </p>
            </div>
          </div>
        </div>

        <div className="about-section" style={{ paddingBottom: 'var(--space-8)' }}>
          <h2 className="about-section-title">Contact</h2>
          <div className="about-contact-card">
            <div className="about-contact-row">
              <div className="about-contact-avatar">ES</div>
              <div>
                <div className="about-contact-name">Emmett Stone Gbatu</div>
                <div className="about-contact-role">Founder, GoldWay</div>
              </div>
            </div>
            <div className="about-contact-divider" />
            <div className="about-contact-details">
              <div className="about-contact-item">
                <span className="about-contact-label">Phone</span>
                <span className="about-contact-value">+231 776 304 100</span>
              </div>
              <a href="mailto:stonegbatu@gmail.com" className="about-contact-item">
                <span className="about-contact-label">Email</span>
                <span className="about-contact-value">stonegbatu@gmail.com</span>
              </a>
              <div className="about-contact-item">
                <span className="about-contact-label">Location</span>
                <span className="about-contact-value">Monrovia, Liberia</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
