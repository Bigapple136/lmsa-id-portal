import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <Navbar showLogin={true} />
      <div className="legal-container">
        <div className="legal-brand">LMSA ID Portal — Operated by GoldWay Creative Design &amp; Production Services</div>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-effective">Effective date: May 29, 2026</p>

        <p className="legal-intro">
          GoldWay takes your privacy seriously. This Privacy Policy explains what personal information the LMSA ID Portal collects, why it is collected, how it is kept safe, and your rights in relation to it. It is written in plain language so every student can understand it.
        </p>

        <table className="legal-table">
          <tbody>
            <tr><td className="legal-td-label">Portal</td><td><a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a></td></tr>
            <tr><td className="legal-td-label">Data controller</td><td>GoldWay Creative Design &amp; Production Services</td></tr>
            <tr><td className="legal-td-label">Contact</td><td><a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a></td></tr>
            <tr><td className="legal-td-label">Jurisdiction</td><td>Republic of Liberia</td></tr>
          </tbody>
        </table>

        <div className="legal-section">
          <h2 className="legal-section-title">1. Who This Policy Applies To</h2>
          <p>This policy applies to students whose information appears on the Portal, and to institutional administrators who use the Portal to manage student records. It covers information collected through the Portal as well as information collected during GoldWay's ID card production process.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">2. What Information We Collect</h2>

          <h3 className="legal-sub-title">2.1 Your ID card details</h3>
          <p>When your information is added to the Portal — either by you or by your institution's administrator — the following details may be collected:</p>
          <ul className="legal-list">
            <li>Full name</li>
            <li>Student ID number</li>
            <li>Year or level of study</li>
            <li>Institutional position or role</li>
            <li>Student photograph</li>
            <li>Student signature (where provided)</li>
            <li>Programme of study</li>
            <li>Student email address</li>
            <li>Blood type (optional — used for emergency identification purposes only)</li>
            <li>Emergency contact name and phone number (optional)</li>
          </ul>

          <h3 className="legal-sub-title">2.2 What is on your QR code</h3>
          <p>Every ID card includes a QR code. When scanned, it displays a subset of your details to help verify your identity. This includes your name, student ID, year/level, programme, and position. Sensitive details such as your blood type and emergency contact are also encoded in the QR code for emergency use, but are not displayed on the card face itself.</p>
          <p>You should be aware that anyone with a standard QR scanner can read the information in your QR code when they scan your physical card.</p>

          <h3 className="legal-sub-title">2.3 Correction requests</h3>
          <p>If you submit a correction through the Portal, we retain a record of what was changed and when, to help administrators manage updates accurately.</p>

          <h3 className="legal-sub-title">2.4 Administrator activity</h3>
          <p>Actions taken by institutional administrators — such as uploading student records or approving corrections — are logged for accountability purposes.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">3. Why We Collect This Information</h2>
          <p>We collect and use your information only for the following purposes:</p>
          <ul className="legal-list">
            <li>To produce your student ID card with accurate details</li>
            <li>To display your card details on the Portal so you can review and confirm them</li>
            <li>To generate the QR code on your ID card for identity verification</li>
            <li>To process corrections you submit through the Portal</li>
            <li>To allow your institution's administrator to manage student records</li>
          </ul>
          <p>We do not use your information for advertising, marketing, or any purpose unrelated to your ID card.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">4. How We Keep Your Information Safe</h2>
          <p>Your information is stored on secure, access-controlled cloud infrastructure. Access to student records is restricted — only authorised administrators of your institution can view or edit your record. Your data is protected by authentication controls that prevent unauthorised access.</p>
          <p>Student photographs and other files are stored securely and are only accessible within the Portal by authorised users.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">5. How Long We Keep Your Information</h2>

          <h3 className="legal-sub-title">5.1 Portal records</h3>
          <p>Your student record remains on the Portal for as long as your institution's account is active. Your institution may request deletion of all student data at any time.</p>

          <h3 className="legal-sub-title">5.2 Production records</h3>
          <p>Any personal information GoldWay holds during the ID card production process — including photographs and student lists — is deleted at the end of the academic year in which your cards were produced.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">6. Who We Share Your Information With</h2>
          <p>GoldWay does not sell or share your personal information with third parties for commercial purposes.</p>
          <p>Your information may be shared only in these limited circumstances:</p>
          <ul className="legal-list">
            <li><strong>Secure infrastructure providers</strong> — we use trusted third-party services to host and store Portal data securely. These providers process data only on our instructions and do not have independent access to your information.</li>
            <li><strong>Your institution</strong> — your record is accessible to authorised administrators at your institution for the purpose of managing your ID card.</li>
            <li><strong>Legal requirements</strong> — if we are required by law or by a competent authority to disclose information, we will do so.</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">7. Your Rights</h2>
          <p>You have the following rights regarding your personal information:</p>
          <ul className="legal-list">
            <li><strong>Access:</strong> You can ask to see the information we hold about you.</li>
            <li><strong>Correction:</strong> You can ask us to correct inaccurate information. You can also use the Portal's self-correction feature directly.</li>
            <li><strong>Deletion:</strong> You can ask us to delete your information. We will do so subject to any obligations your institution has regarding student records.</li>
            <li><strong>Objection:</strong> You can ask us to stop processing your information for any purpose beyond operating your ID card.</li>
          </ul>
          <p>To make any of these requests, contact us using the details in Section 9.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">8. Cookies and Tracking</h2>
          <p>The LMSA ID Portal does not use advertising cookies or tracking tools. The Portal uses only the minimum session data necessary to keep you securely logged in during your visit. No data is shared with advertising networks or analytics platforms.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">9. Governing Law</h2>
          <p>This Privacy Policy is governed by the laws of the Republic of Liberia. Any disputes arising in connection with this policy shall be subject to the jurisdiction of the courts of the Republic of Liberia.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">10. Changes to This Policy</h2>
          <p>If we make changes to this Privacy Policy, the updated version will be published on the Portal with a revised effective date. We encourage you to review this page periodically. Continued use of the Portal after changes are published means you accept the updated policy.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">11. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or how your information is handled, please contact:</p>
          <div className="legal-contact-card">
            <p><strong>Email:</strong> <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a></p>
            <p><strong>Portal:</strong> <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a></p>
          </div>
        </div>

        <div className="legal-footer-line">
          LMSA ID Portal &mdash; Operated by GoldWay<br />
          <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a> &nbsp;|&nbsp; <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
