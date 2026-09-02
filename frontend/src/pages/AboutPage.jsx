/* eslint-disable react/prop-types */
import { Link } from 'react-router-dom'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'

const SERVICES = [
  {
    icon: 'design',
    name: 'Graphic Design',
    desc: 'Brand identity, ID cards, certificates, print layouts, and institutional materials.',
  },
  {
    icon: 'camera',
    name: 'Photography',
    desc: 'On-site portrait and ID photography sessions for institutions and organisations.',
  },
  {
    icon: 'print',
    name: 'Print Production',
    desc: 'PVC ID cards, business cards, banners, and institutional print materials.',
  },
  {
    icon: 'portal',
    name: 'Digital Solutions',
    desc: 'Custom web portals, management systems, and digital tools for institutions.',
  },
]

export default function AboutPage() {
  return (
    <div className="about-wrapper">
      <Navbar showLogin={false} />

      <section className="about-hero">
        <div className="about-hero-inner">
          <img src="/lmsa-logo.png" alt="LMSA" className="about-hero-logo" />
          <p className="about-goldway-tag">LMSA ID Portal</p>
          <h1 className="about-hero-title">Student ID verification for A.M. Dogliotti</h1>
          <p className="about-hero-tagline">
            Official review, correction, and QR verification workflow.
          </p>
          <p className="about-hero-desc">
            This portal helps Liberia Medical Students&apos; Association coordinate student records,
            photos, QR details, confirmation, and print production in one controlled process.
          </p>
        </div>
      </section>

      <main className="about-body">
        <section className="about-section">
          <h2 className="about-section-title">About this portal</h2>
          <p className="about-section-text">
            The LMSA ID Portal was designed and developed by GoldWay for the Liberia Medical
            Students&apos; Association and A.M. Dogliotti College of Medicine. Students can preview
            their ID card before printing, confirm their details, or report corrections online.
          </p>
          <p className="about-section-text">
            Some issues, such as a missing or incorrect photo, still require LMSA or faculty-office
            follow-up so the identity record remains secure.
          </p>
        </section>

        <section className="about-section about-operator-section">
          <div>
            <h2 className="about-section-title">Operated by GoldWay</h2>
            <p className="about-section-text">
              GoldWay Creative Design &amp; Production Services is a Liberia-based design and
              production studio supporting institutional identity, photography, print, and digital
              workflow projects.
            </p>
          </div>
          <div className="about-operator-badge" aria-hidden="true">
            GW
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">GoldWay services</h2>
          <div className="about-services-grid">
            {SERVICES.map((service) => (
              <article className="about-service-card" key={service.name}>
                <div className="about-service-icon" aria-hidden="true">
                  <ServiceIcon type={service.icon} />
                </div>
                <div className="about-service-name">{service.name}</div>
                <div className="about-service-desc">{service.desc}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2 className="about-section-title">Get in touch</h2>
          <p className="about-section-text">
            For portal support, start with LMSA or the faculty office. For GoldWay production or
            service enquiries, use the contact details below.
          </p>

          <div className="about-contact-card">
            <div className="about-contact-row">
              <div className="about-contact-avatar" aria-hidden="true">
                EG
              </div>
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
        </section>

        <div className="about-back-cta">
          <Link className="btn-primary" to="/">
            Back to Student Portal
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ServiceIcon({ type }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true',
  }

  if (type === 'camera') {
    return (
      <svg {...common}>
        <path d="M4 8h4l1.5-2h5L16 8h4v10H4V8z" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    )
  }

  if (type === 'print') {
    return (
      <svg {...common}>
        <path d="M7 8V4h10v4M7 17H5V9h14v8h-2" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 14h8v6H8v-6z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M17 11h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'portal') {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M8 20h8M12 17v3M8 9h8M8 12h5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path
        d="M5 19l4.5-1 8.75-8.75a2.1 2.1 0 0 0-3-3L6.5 15 5 19z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M14 7l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
