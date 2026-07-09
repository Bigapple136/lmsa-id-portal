import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function TermsPage() {
  return (
    <div className="legal-page">
      <Navbar showLogin={true} />
      <div className="legal-container">
        <div className="legal-brand">
          LMSA ID Portal — Operated by GoldWay Creative Design &amp; Production Services
        </div>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-effective">Effective date: May 29, 2026</p>

        <p className="legal-intro">
          These Terms of Service govern your use of the LMSA ID Portal. By accessing or using the
          Portal, you agree to these terms. Please read them carefully.
        </p>

        <table className="legal-table">
          <tbody>
            <tr>
              <td className="legal-td-label">Portal</td>
              <td>
                <a
                  href="https://lmsa-id-portal.vercel.app"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  lmsa-id-portal.vercel.app
                </a>
              </td>
            </tr>
            <tr>
              <td className="legal-td-label">Operated by</td>
              <td>GoldWay Creative Design &amp; Production Services</td>
            </tr>
            <tr>
              <td className="legal-td-label">Contact</td>
              <td>
                <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a>
              </td>
            </tr>
            <tr>
              <td className="legal-td-label">Jurisdiction</td>
              <td>Republic of Liberia</td>
            </tr>
          </tbody>
        </table>

        <div className="legal-section">
          <h2 className="legal-section-title">1. What This Portal Is</h2>
          <p>
            The LMSA ID Portal is an online platform that allows students of institutions served by
            GoldWay to view their ID card details, verify their information, and submit corrections.
            It also allows authorised institutional administrators to manage student records.
          </p>
          <p>
            The Portal is not a general-purpose platform. It is provided exclusively in connection
            with GoldWay's student ID card production services.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">2. Who Can Use the Portal</h2>
          <p>The Portal is intended for:</p>
          <ul className="legal-list">
            <li>
              Students enrolled at institutions that have engaged GoldWay for ID card services
            </li>
            <li>Authorised administrators of those institutions</li>
          </ul>
          <p>
            If you do not fall into one of these categories, you are not authorised to use the
            Portal.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">3. Your Account and Information</h2>

          <h3 className="legal-sub-title">3.1 Accessing Your Record</h3>
          <p>
            You access your record by entering your student ID number and full name. You are
            responsible for keeping this information secure. If you believe your record has been
            accessed by someone else, contact your institution's administrator immediately.
          </p>

          <h3 className="legal-sub-title">3.2 Accuracy of Information</h3>
          <p>
            You are responsible for reviewing your ID card details carefully. If any information is
            incorrect, you may submit a correction through the Portal. You must only submit accurate
            information about yourself.
          </p>

          <h3 className="legal-sub-title">3.3 Photo Corrections</h3>
          <p>
            If your photo is incorrect, you can flag this through the Portal. Photo corrections
            cannot be made online — your institution's administrator will contact you to arrange a
            re-shoot.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">4. Your Responsibilities</h2>
          <p>When using the Portal, you agree not to:</p>
          <ul className="legal-list">
            <li>Attempt to access, view, or modify another student's record</li>
            <li>Submit false or misleading information</li>
            <li>Impersonate another person</li>
            <li>
              Use the Portal for any purpose other than verifying and correcting your own ID card
              details
            </li>
            <li>Attempt to interfere with, disrupt, or compromise the security of the Portal</li>
            <li>Use automated tools to access or scrape the Portal</li>
          </ul>
          <p>
            Violation of these rules may result in your access being suspended and the matter being
            referred to your institution.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">5. Administrator Responsibilities</h2>
          <p>
            Institutional administrators who are granted access to the admin dashboard are
            responsible for:
          </p>
          <ul className="legal-list">
            <li>Keeping their login credentials secure and not sharing them with others</li>
            <li>
              Ensuring that student data uploaded to the Portal is accurate and has been collected
              with appropriate consent
            </li>
            <li>
              Reviewing and acting on student correction requests and issue reports in a timely
              manner
            </li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">6. Portal Availability</h2>
          <p>
            GoldWay will make reasonable efforts to keep the Portal available. However, the Portal
            is provided on an "as is" basis and may occasionally be unavailable due to maintenance,
            technical issues, or circumstances outside our control.
          </p>
          <p>
            GoldWay is not liable for any inconvenience or loss resulting from the Portal being
            temporarily unavailable.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">7. Limitation of Liability</h2>
          <p>
            GoldWay's liability to you in connection with your use of the Portal is limited to the
            fullest extent permitted by law. GoldWay is not liable for any indirect or consequential
            loss arising from your use of, or inability to use, the Portal.
          </p>
          <p>
            GoldWay is not responsible for errors in your ID card details that result from incorrect
            information you or your institution provided.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">8. Termination of Access</h2>
          <p>
            GoldWay may suspend or remove access to the Portal at any time if these Terms are
            breached, or if the Portal is discontinued. Your institution may also request that your
            access be removed.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the Republic of Liberia. Any disputes arising in
            connection with these Terms shall be subject to the jurisdiction of the courts of the
            Republic of Liberia.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">10. Changes to These Terms</h2>
          <p>
            GoldWay may update these Terms from time to time. The effective date at the top of this
            page will reflect the latest version. Continued use of the Portal after changes are
            published means you accept the updated Terms.
          </p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">11. Contact Us</h2>
          <p>If you have any questions about these Terms, please contact:</p>
          <div className="legal-contact-card">
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a>
            </p>
            <p>
              <strong>Portal:</strong>{' '}
              <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">
                lmsa-id-portal.vercel.app
              </a>
            </p>
          </div>
        </div>

        <div className="legal-footer-line">
          LMSA ID Portal &mdash; Operated by GoldWay
          <br />
          <a href="mailto:goldway.estone@outlook.com">
            goldway.estone@outlook.com
          </a> &nbsp;|&nbsp;{' '}
          <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">
            lmsa-id-portal.vercel.app
          </a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
