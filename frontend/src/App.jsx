import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PreviewPage from './pages/PreviewPage'
import AdminDashboard from './pages/AdminDashboard'
import AboutPage from './pages/AboutPage'
import QrViewPage from './pages/QrViewPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/preview/:token" element={<PreviewPage />} />
        <Route path="/qr/:studentId" element={<QrViewPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </BrowserRouter>
  )
}
