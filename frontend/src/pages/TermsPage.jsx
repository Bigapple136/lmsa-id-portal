import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function TermsPage() {
  return (
    <div className="legal-page">
      <Navbar showLogin={true} />
      <div className="legal-container">
        <div className="legal-brand">GoldWay — Creative Design &amp; Production Services</div>
        <h1 className="legal-title">Terms of Service</h1>
        <p className="legal-effective">Effective date: May 28, 2026</p>

        <p className="legal-intro">
          These Terms of Service govern your use of the LMSA ID Portal (lmsa-id-portal.vercel.app) and the professional services provided by GoldWay Creative Design &amp; Production Services. By using the portal or engaging GoldWay for services, you agree to these terms.
        </p>

        <table className="legal-table">
          <tbody>
            <tr><td className="legal-td-label">Operator</td><td>GoldWay Creative Design &amp; Production Services</td></tr>
            <tr><td className="legal-td-label">Contact</td><td><a href="mailto:goldway.estone@outlook.com">goldway.estone@outlook.com</a> &nbsp;|&nbsp; <a href="tel:+231770405785">+231770405785</a></td></tr>
            <tr><td className="legal-td-label">Portal</td><td><a href="https://lmsa-id-portal.vercel.app" target="_blank" rel="noopener noreferrer">lmsa-id-portal.vercel.app</a></td></tr>
            <tr><td className="legal-td-label">Jurisdiction</td><td>Republic of Liberia</td></tr>
          </tbody>
        </table>

        <div className="legal-section">
          <h2 className="legal-section-title">1. Definitions</h2>
          <p>In these Terms, the following definitions apply:</p>
          <ul className="legal-list">
            <li><strong>"GoldWay"</strong> means GoldWay Creative Design &amp; Production Services, operated by Emmett Stone Gbatu, Monrovia, Liberia.</li>
            <li><strong>"Portal"</strong> means the LMSA ID Card Verification Portal accessible at lmsa-id-portal.vercel.app.</li>
            <li><strong>"Student"</strong> means any individual who registers on the Portal or whose information is submitted to the Portal.</li>
            <li><strong>"Institution"</strong> means any student association, college, or university that engages GoldWay for ID card production services, including LMSA.</li>
            <li><strong>"Services"</strong> means photography, graphic design, PVC card printing, and digital portal access provided by GoldWay.</li>
            <li><strong>"ID Card"</strong> means the physical PVC student identification card produced by GoldWay.</li>
          </ul>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">2. Use of the Portal</h2>

          <h3 className="legal-sub-title">2.1 Eligibility</h3>
          <p>The Portal is intended for use by registered students of institutions that have contracted GoldWay for ID card services, and by authorised institutional administrators. Use of the Portal by any other person is not permitted.</p>

          <h3 className="legal-sub-title">2.2 Student Registration</h3>
          <p>Students access the Portal by registering with their student ID number and full name. Students are responsible for providing accurate and complete information at the time of registration. GoldWay is not liable for errors arising from incorrect information submitted by the student.</p>

          <h3 className="legal-sub-title">2.3 Self-Correction</h3>
          <p>Students may submit corrections to their details through the Portal's self-correction feature. Corrections to photographs cannot be made online and must be reported through the Portal for administrative review. GoldWay will action approved correction requests within a reasonable time.</p>

          <h3 className="legal-sub-title">2.4 Prohibited Use</h3>
          <p>You must not:</p>
          <ul className="legal-list">
            <li>Attempt to access, modify, or delete another student's record</li>
            <li>Use the Portal for any fraudulent, unlawful, or unauthorised purpose</li>
            <li>Attempt to reverse-engineer, copy, or reproduce the Portal or its underlying systems</li>
            <li>Submit false information or impersonate another person</li>
            <li>Interfere with the security or operation of the Portal in any way</li>
          </ul>

          <h3 className="legal-sub-title">2.5 Administrator Access</h3>
          <p>Institutional administrators are granted access to the admin dashboard. Administrators are responsible for the accuracy of student data they upload and must not share their login credentials with unauthorised persons.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">3. GoldWay Production Services</h2>

          <h3 className="legal-sub-title">3.1 Scope</h3>
          <p>GoldWay's services are provided under a separate written agreement or accepted bid proposal between GoldWay and the Institution. These Terms apply in addition to any such agreement.</p>

          <h3 className="legal-sub-title">3.2 Payment</h3>
          <ul className="legal-list">
            <li>A non-refundable deposit of 50% of the agreed total is required before work commences.</li>
            <li>The remaining 50% is due upon delivery of the completed ID cards to the Institution.</li>
            <li>Pricing is as agreed in the accepted bid proposal. GoldWay reserves the right to adjust pricing for orders that differ materially from the agreed quantity.</li>
          </ul>

          <h3 className="legal-sub-title">3.3 Delivery</h3>
          <p>GoldWay will use reasonable efforts to meet the estimated timeline provided in the proposal. Delays caused by late data submission, late approval of designs, or factors outside GoldWay's control will extend the delivery timeline accordingly.</p>

          <h3 className="legal-sub-title">3.4 Design Approval</h3>
          <p>No cards will be sent to print without written approval of the final design by an authorised representative of the Institution. Once approval is given, GoldWay proceeds with production. Changes requested after approval may incur additional charges.</p>

          <h3 className="legal-sub-title">3.5 Reprints</h3>
          <p>Reprints required due to errors in information provided by the Institution or students will be charged at cost to the Institution. Reprints due to errors made by GoldWay will be corrected at GoldWay's expense.</p>

          <h3 className="legal-sub-title">3.6 Intellectual Property</h3>
          <p>GoldWay retains ownership of all design templates, tools, and systems used in producing the ID cards. The Institution is granted a non-exclusive licence to use the final card design for the purpose of the contracted project. The Portal and all underlying software remain the property of GoldWay.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">4. Disclaimers &amp; Limitation of Liability</h2>
          <p>The Portal is provided on an "as is" basis. GoldWay makes no warranties, express or implied, regarding the Portal's availability, accuracy, or fitness for a particular purpose.</p>
          <p>GoldWay's total liability to the Institution or any student arising from these Terms or the Services shall not exceed the amount paid by the Institution for the relevant order.</p>
          <p>GoldWay is not liable for any indirect, incidental, or consequential loss arising from use of the Portal or the Services, including but not limited to loss of data, loss of revenue, or reputational harm.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">5. Termination</h2>
          <p>GoldWay may suspend or terminate access to the Portal at any time if these Terms are breached or if the Portal is discontinued. The Institution may terminate a service agreement by written notice, subject to the deposit terms in Section 3.2.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">6. Governing Law</h2>
          <p>These Terms are governed by and construed in accordance with the laws of the Republic of Liberia. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the courts of the Republic of Liberia.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">7. Changes to These Terms</h2>
          <p>GoldWay may update these Terms from time to time. The effective date at the top of this document will be updated accordingly. Continued use of the Portal after changes are posted constitutes acceptance of the revised Terms.</p>
        </div>

        <div className="legal-section">
          <h2 className="legal-section-title">8. Contact</h2>
          <p>For any questions about these Terms, contact:</p>
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
