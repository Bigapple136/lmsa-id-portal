import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import LandingPage from './pages/LandingPage'
import PreviewPage from './pages/PreviewPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminManagementPage from './pages/AdminManagementPage'
import QrKeyManagement from './pages/QrKeyManagement'
import AboutPage from './pages/AboutPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import QrViewPage from './pages/QrViewPage'
import StudentSubmissionForm from './pages/StudentSubmissionForm'
import StudentStatusPage from './pages/StudentStatusPage'
import StudentStatusCheck from './pages/StudentStatusCheck'

const SentryErrorBoundary = Sentry.ErrorBoundary || ErrorBoundary

function NotFoundPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
        fontFamily: 'Inter, Arial, sans-serif',
        background: '#f6fbf4',
        color: '#181d19',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 64, fontWeight: 800, margin: 0, color: '#00653c' }}>404</h1>
      <p style={{ fontSize: 16, color: '#666', margin: 0 }}>Page not found</p>
      <a
        href="/"
        style={{
          marginTop: 8,
          padding: '10px 24px',
          borderRadius: 8,
          border: 'none',
          background: '#00653c',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          textDecoration: 'none',
        }}
      >
        Go Home
      </a>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/preview/:token" element={<PreviewPage />} />
          <Route path="/qr/:studentId" element={<QrViewPage />} />
          <Route
            path="/admin"
            element={
              <SentryErrorBoundary>
                <AdminDashboard />
              </SentryErrorBoundary>
            }
          />
          <Route
            path="/admin/admins"
            element={
              <SentryErrorBoundary>
                <AdminManagementPage />
              </SentryErrorBoundary>
            }
          />
          <Route
            path="/admin/qr-keys"
            element={
              <SentryErrorBoundary>
                <QrKeyManagement />
              </SentryErrorBoundary>
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/submit" element={<StudentSubmissionForm />} />
          <Route path="/status" element={<StudentStatusPage />} />
          <Route path="/check-status" element={<StudentStatusCheck />} />
          <Route
            path="/admin/qr-keys"
            element={
              <SentryErrorBoundary>
                <QrKeyManagement />
              </SentryErrorBoundary>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
