import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PreviewPage from './pages/PreviewPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminManagementPage from './pages/AdminManagementPage'
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import QrViewPage from './pages/QrViewPage'
import StudentSubmissionForm from './pages/StudentSubmissionForm'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/preview/:token" element={<PreviewPage />} />
        <Route path="/qr/:studentId" element={<QrViewPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/admins" element={<AdminManagementPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/submit" element={<StudentSubmissionForm />} />
      </Routes>
    </BrowserRouter>
  )
}
