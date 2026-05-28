import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <Navbar showLogin={true} />
      <div className="legal-container">
        <div className="legal-brand">GoldWay — Creative Design &amp; Production Services</div>
        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-effective">Effective date: May 28, 2026</p>

        <p className="legal-intro">
          GoldWay is committed to protecting the privacy of students and institutions who use its services and the LMSA ID Portal. This Privacy Policy explains what information we collect, how we use it, and your rights in relation to it.
        </p>

        <table className="legal-table">
          <tbody>
            <tr><td className="legal-td-label">Data Controller</td><td>GoldWay Creative Design &amp; Production Services</td></tr>
            <tr><td className="legal-td-label">Contact</td><td><a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a> &nbsp;|&nbsp; <a href="tel:+231770405785">+231770405785</a></td></tr>
            <tr><td className="legal-td-label">Portal</td><td><a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a></td></tr>
            <tr><td className="legal-td-label">Jurisdiction</td><td>Republic of Liberia</td></tr>
          </tbody>
        </table>

        <div className="legal-section">
          <h2 className="legal-section-title">1. Who This Policy Applies To</h2>
          <p>This policy applies to:</p>
          <ul className="legal-list">
            <li>Students who register on the LMSA ID Portal or whose information is submitted to the Portal by an institutional administrator</li>
            <li>Representatives of institutions that engage GoldWay for ID card production services</li>
            <li>Any person who contacts GoldWay directly for business enquiries</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">2. What Information We Collect</h2>

          <h3 className="legal-sub-title">2.1 Information collected through the Portal</h3>
          <p>When a student registers on the Portal or an administrator uploads student data, the following information may be collected:</p>
          <ul className="legal-list">
            <li>Full name</li>
            <li>Student ID number</li>
            <li>Year / level of study</li>
            <li>Institutional position or role (e.g. Class Representative)</li>
            <li>Student photograph</li>
            <li>Student signature (where provided)</li>
            <li>Programme of study (e.g. MBBS, Pharm.D)</li>
            <li>Student email address</li>
            <li>Blood type (where provided, for emergency purposes only)</li>
            <li>Emergency contact name and phone number (where provided)</li>
          </ul>

          <h3 className="legal-sub-title">2.2 Information encoded in QR codes</h3>
          <p>A subset of the above information — specifically student ID number, full name, year/level, programme, institutional position, email address, blood type, and emergency contact details — is encoded into the QR code printed on each physical ID card. This information is readable by any standard QR code scanner and is intended to facilitate student identity verification.</p>

          <h3 className="legal-sub-title">2.3 Information collected during production services</h3>
          <p>When GoldWay provides photography and printing services, we temporarily hold student photographs and personal details for the purpose of producing the ID cards. This information is held by GoldWay in its capacity as data processor on behalf of the Institution.</p>

          <h3 className="legal-sub-title">2.4 Contact information</h3>
          <p>If you contact GoldWay by email or phone, we retain your name, contact details, and the content of your communication for the purpose of responding to your enquiry.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">3. How We Use Your Information</h2>
          <p>GoldWay uses the information collected for the following purposes only:</p>
          <ul className="legal-list">
            <li>To produce student ID cards on behalf of the contracting Institution</li>
            <li>To populate and operate the LMSA ID Portal, including student record management, QR code generation, and card preview</li>
            <li>To allow students to verify their own details and submit corrections through the Portal</li>
            <li>To allow authorised institutional administrators to manage student records</li>
            <li>To communicate with institutions and students regarding the production process</li>
          </ul>
          <p>GoldWay does not use student data for marketing, advertising, profiling, or any purpose beyond those listed above.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">4. How We Store Your Information</h2>

          <h3 className="legal-sub-title">4.1 Portal data</h3>
          <p>Student records entered into or uploaded to the Portal are stored securely on Supabase, a third-party database and storage service. All data is stored with access controls and is protected by row-level security policies that restrict access to authorised users only.</p>

          <h3 className="legal-sub-title">4.2 Student photographs and signatures</h3>
          <p>Student photographs and signature images are stored in Supabase cloud storage. Public URLs are used to display images within the Portal; however, the files are accessible only via unique, non-guessable paths.</p>

          <h3 className="legal-sub-title">4.3 QR codes</h3>
          <p>Generated QR code images are stored in Supabase cloud storage, organised by year/level subfolder. Each QR code is named after the student's ID number.</p>

          <h3 className="legal-sub-title">4.4 Production data</h3>
          <p>Personal data held by GoldWay during the production process (photographs, design files, student lists) is stored on GoldWay's internal systems and is accessible only to GoldWay personnel directly involved in the project.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">5. Data Retention</h2>

          <h3 className="legal-sub-title">5.1 Portal data</h3>
          <p>Student records remain on the Portal for as long as the Institution's account is active. Institutions may request deletion of their data at any time by contacting GoldWay.</p>

          <h3 className="legal-sub-title">5.2 Production data</h3>
          <p>Personal data held by GoldWay for the purpose of producing ID cards is retained until the end of the academic year in which the order was completed, after which it is permanently deleted from GoldWay's systems. This includes photographs, design files, and student lists.</p>

          <h3 className="legal-sub-title">5.3 Contact and business records</h3>
          <p>Business correspondence and invoice records may be retained for up to three years for accounting and legal purposes.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">6. Who We Share Your Information With</h2>
          <p>GoldWay does not sell, rent, or trade student or institutional data to any third party.</p>
          <p>We may share information in the following limited circumstances:</p>
          <ul className="legal-list">
            <li><strong>Supabase</strong> (our hosting and database provider) — solely for the purpose of storing and serving Portal data. Supabase processes data in accordance with its own privacy policy.</li>
            <li><strong>Our PVC card printing partner</strong> — receives only the minimum data necessary to produce the physical cards (card design files). No raw student personal data is passed to the printing partner.</li>
            <li><strong>Legal obligations</strong> — where we are required by law or by a competent authority to disclose information.</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">7. Your Rights</h2>
          <p>Students and institutions have the following rights in relation to their personal data held by GoldWay:</p>
          <ul className="legal-list">
            <li><strong>Right of access:</strong> You may request a copy of the personal data GoldWay holds about you.</li>
            <li><strong>Right to correction:</strong> You may request that inaccurate or incomplete data be corrected. Students may also use the Portal's self-correction feature for certain fields.</li>
            <li><strong>Right to deletion:</strong> You may request that your personal data be deleted, subject to any legal obligations GoldWay has to retain it.</li>
            <li><strong>Right to object:</strong> You may object to the processing of your data for any purpose beyond those stated in Section 3.</li>
          </ul>
          <p>To exercise any of these rights, contact GoldWay using the details in Section 9.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">8. Cookies &amp; Tracking</h2>
          <p>The LMSA ID Portal does not use tracking cookies, advertising pixels, or third-party analytics tools. Session data is managed through Supabase authentication and is used solely to maintain secure admin login sessions.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">9. Governing Law</h2>
          <p>This Privacy Policy is governed by the laws of the Republic of Liberia. Any disputes arising in connection with this policy shall be subject to the exclusive jurisdiction of the courts of the Republic of Liberia.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">10. Changes to This Policy</h2>
          <p>GoldWay may update this Privacy Policy from time to time to reflect changes in our practices or legal obligations. The effective date at the top of this document will be updated when changes are made. We encourage students and institutions to review this policy periodically.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">11. Contact</h2>
          <p>For any questions, requests, or concerns regarding this Privacy Policy or the handling of your personal data, please contact:</p>
          <div className="legal-contact-card">
            <p><strong>Name:</strong> Emmett Stone Gbatu — GoldWay</p>
            <p><strong>Email:</strong> <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a></p>
            <p><strong>Phone:</strong> <a href="tel:+231770405785">+231770405785</a></p>
            <p><strong>Portal:</strong> <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a></p>
          </div>
        </div>

        <div className="legal-footer-line">
          GoldWay — Creative Design &amp; Production Services<br />
          <a href="tel:+231770405785">+231770405785</a> &nbsp;|&nbsp; <a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a> &nbsp;|&nbsp; <a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a>
        </div>
      </div>
      <Footer />
    </div>
  )
}
