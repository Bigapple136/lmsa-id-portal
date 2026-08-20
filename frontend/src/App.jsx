import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import LandingPage from './pages/LandingPage'

// Lazy-loaded: every route past the landing page. Students visiting a
// /preview/:token link and admins visiting /admin share none of this code
// today — they're bundled together into one 640KB+ chunk regardless of
// which one a visitor actually needs. Splitting per-route means a student
// on a preview link only downloads PreviewPage's code, never the Layout
// Mapper, chart.js, or hCaptcha that only /admin needs, and vice versa.
const PreviewPage = lazy(() => import('./pages/PreviewPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const AdminManagementPage = lazy(() => import('./pages/AdminManagementPage'))
const QrKeyManagement = lazy(() => import('./pages/QrKeyManagement'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const QrViewPage = lazy(() => import('./pages/QrViewPage'))
const StudentSubmissionForm = lazy(() => import('./pages/StudentSubmissionForm'))
const StudentStatusPage = lazy(() => import('./pages/StudentStatusPage'))
const StudentStatusCheck = lazy(() => import('./pages/StudentStatusCheck'))

const SentryErrorBoundary = Sentry.ErrorBoundary || ErrorBoundary

function RouteLoadingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Arial, sans-serif',
        color: '#666',
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  )
}

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
        <Suspense fallback={<RouteLoadingFallback />}>
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}
