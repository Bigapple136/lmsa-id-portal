import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function QrViewPage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [qrFields, setQrFields] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/students/${encodeURIComponent(studentId)}`).then(r => r.json()),
      apiFetch('/api/settings/qr-fields').then(r => r.json()).catch(() => null),
    ]).then(([data, fields]) => {
      if (data.error) { setError(data.error); setLoading(false); return }
      setStudent(data)
      setQrFields(fields)
      setLoading(false)
    }).catch(() => { setError('Failed to load student data.'); setLoading(false) })
  }, [studentId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f6fbf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#00653c', fontFamily: 'Manrope, Arial, sans-serif', fontSize: '13px', fontWeight: 600 }}>Loading...</div>
    </div>
  )

  if (error || !student) return (
    <div style={{ minHeight: '100vh', background: '#f6fbf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#CC0000', fontFamily: 'Manrope, Arial, sans-serif', fontSize: '14px' }}>{error || 'Student not found.'}</div>
    </div>
  )

  const VERIFY_URL = `${import.meta.env.VITE_API_URL}/api/qr/html/${encodeURIComponent(studentId)}`

  const name = student.full_name || '—'
  const sid = student.student_id || '—'
  const level = student.year_level || '—'
  const position = student.position || null
  const programme = qrFields?.programme?.enabled ? student.programme : null
  const bloodType = qrFields?.blood_type?.enabled ? student.blood_type : null
  const email = qrFields?.student_email?.enabled ? student.student_email : null
  const emergName = qrFields?.emergency_contact_name?.enabled ? student.emergency_contact_name : null
  const emergPhone = qrFields?.emergency_contact_phone?.enabled ? student.emergency_contact_phone : null

  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  const topbar = {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
    background: 'rgba(6,45,27,0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
  }
  const topbarInner = {
    maxWidth: '480px', margin: '0 auto', padding: '14px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const topbarLogo = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 800, fontSize: '15px',
    color: '#fff', letterSpacing: '-0.01em',
  }
  const topbarCrest = {
    width: '32px', height: '32px', background: '#C9A84C', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 900, fontSize: '11px',
    color: '#0D1B2A', flexShrink: 0,
  }
  const hero = {
    background: 'linear-gradient(135deg,#00653c 0%,#1e7f51 100%)',
    borderRadius: '24px 24px 0 0',
    padding: '28px 24px 40px',
    position: 'relative', overflow: 'hidden',
  }
  const heroEyebrow = {
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: '8px',
  }
  const heroBadge = {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: 'rgba(255,255,255,0.18)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px',
  }
  const heroName = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 800, fontSize: '26px',
    color: '#fff', letterSpacing: '-0.02em', lineHeight: '1.1', margin: '12px 0 4px',
  }
  const heroSub = { fontSize: '13px', color: 'rgba(255,255,255,0.8)' }
  const profileRow = {
    padding: '0 24px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'flex-end', marginTop: '-28px', position: 'relative', zIndex: 2,
  }
  const profilePhoto = {
    width: '96px', height: '96px', borderRadius: '14px', objectFit: 'cover',
    border: '3px solid #fff', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    background: '#d7dbd5', display: 'block',
  }
  const photoBadge = {
    position: 'absolute', bottom: '-6px', right: '-6px', background: '#00653c',
    color: '#fff', width: '22px', height: '22px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
  }
  const profileIdLabel = {
    fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(24,29,25,0.5)', marginBottom: '2px', textAlign: 'right',
  }
  const profileId = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 800, fontSize: '18px',
    color: '#00653c', letterSpacing: '-0.01em', textAlign: 'right',
  }
  const bentoCard = {
    background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '16px', padding: '16px',
  }
  const bentoLabel = {
    fontSize: '9px', fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(24,29,25,0.45)', marginBottom: '6px',
  }
  const bentoValue = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 700, fontSize: '16px',
    color: '#181d19',
  }
  const contactIcon = {
    width: '36px', height: '36px', background: 'rgba(0,101,60,0.08)',
    borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }
  const contactLabel = {
    fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: 'rgba(24,29,25,0.45)', marginBottom: '2px',
  }
  const contactValue = { fontSize: '13px', fontWeight: 600, color: '#181d19' }
  const qrRefInner = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: '#f0f5ee', borderRadius: '14px', gap: '12px',
  }
  const qrRefTitle = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 700, fontSize: '13px',
    color: '#181d19', marginBottom: '2px',
  }
  const qrRefHint = { fontSize: '11px', color: 'rgba(24,29,25,0.5)' }
  const qrRefImg = { display: 'block', borderRadius: '8px', border: '2px solid #00653c', flexShrink: 0 }
  const footerOrg = {
    fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 700, fontSize: '13px',
    color: '#00653c', marginBottom: '4px',
  }
  const footerMeta = { fontSize: '10px', color: 'rgba(24,29,25,0.4)', letterSpacing: '0.04em' }

  return (
    <div style={{ minHeight: '100vh', background: '#f6fbf4', fontFamily: 'Inter, Arial, sans-serif', color: '#181d19' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        .material-symbols-outlined { font-variation-settings: 'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }
        .material-symbols-filled { font-variation-settings: 'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24; }
        @media print {
          .no-print { display: none !important }
          body { background: #fff; padding: 0 }
          .hero-bg { background: #00653c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
          .profile-photo { border-color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
          .photo-badge { background: #00653c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact }
        }
      `}</style>

      {/* Fixed top bar */}
      <header style={topbar} className="no-print">
        <div style={topbarInner}>
          <div style={topbarLogo}>LMSA — A.M. Dogliotti College of Medicine</div>
          <div style={topbarCrest}>LM</div>
        </div>
      </header>

      {/* Page content */}
      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '72px 16px 32px' }}>

        {/* Hero */}
        <div style={hero}>
          <div style={heroEyebrow}>Student Identity Verification</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={heroName}>{name}</div>
              <div style={heroSub}>{level}{position ? ' · ' + position : ''}</div>
            </div>
            <div style={heroBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#fff' }}>verified</span>
              Active
            </div>
          </div>
        </div>

        {/* Profile row */}
        <div style={profileRow}>
          <div style={{ position: 'relative' }}>
            {student.photo_url ? (
              <img className="profile-photo" style={profilePhoto} src={student.photo_url} alt={name} />
            ) : (
              <div className="profile-photo" style={{ ...profilePhoto, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 800, fontSize: '22px', color: 'rgba(255,255,255,0.7)', background: 'linear-gradient(135deg,#00653c,#1e7f51)' }}>
                {initials}
              </div>
            )}
            <div style={photoBadge} className="photo-badge">
              <span className="material-symbols-outlined" style={{ fontSize: '12px', color: '#fff' }}>verified</span>
            </div>
          </div>
          <div>
            <div style={profileIdLabel}>Student ID</div>
            <div style={profileId}><span style={{ color: '#CC0000' }}>{sid}</span></div>
          </div>
        </div>

        {/* Bento grid */}
        <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {(programme || bloodType) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {bloodType && (
                <div style={bentoCard}>
                  <div style={bentoLabel}>Blood Type</div>
                  <div style={bentoValue}>{bloodType}</div>
                </div>
              )}
              {programme && (
                <div style={bentoCard}>
                  <div style={bentoLabel}>Programme</div>
                  <div style={{ ...bentoValue, fontSize: '13px' }}>{programme}</div>
                </div>
              )}
            </div>
          )}

          {email && (
            <div style={bentoCard}>
              <div style={bentoLabel}>Email Address</div>
              <div style={{ ...bentoValue, fontSize: '14px', wordBreak: 'break-all' }}>{email}</div>
            </div>
          )}

          {(emergName || emergPhone) && (
            <div style={bentoCard}>
              <div style={{ ...bentoLabel, marginBottom: '12px' }}>Emergency Contact</div>
              <div>
                {emergName && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: emergPhone ? '12px' : 0, borderBottom: emergPhone ? '1px solid #f0f5ee' : 'none' }}>
                    <div style={contactIcon}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00653c' }}>person</span>
                    </div>
                    <div>
                      <div style={contactLabel}>Name</div>
                      <div style={contactValue}>{emergName}</div>
                    </div>
                  </div>
                )}
                {emergPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: emergName ? '12px' : 0 }}>
                    <div style={contactIcon}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#00653c' }}>call</span>
                    </div>
                    <div>
                      <div style={contactLabel}>Phone</div>
                      <div style={contactValue}>{emergPhone}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* QR reference section */}
        {student.qr_url && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', padding: '20px 16px 0', marginTop: '4px' }} className="no-print">
            <div style={qrRefInner}>
              <div style={{ flex: 1 }}>
                <div style={qrRefTitle}>Double-check with the QR</div>
                <div style={qrRefHint}>Scan to verify identity</div>
              </div>
              <img src={student.qr_url} alt="QR" style={{ width: '72px', height: '72px', ...qrRefImg }} />
            </div>
          </div>
        )}

        {/* Print button */}
        <div style={{ padding: '16px 0 0' }}>
          <a
            href={VERIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#00653c', color: '#fff', padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', fontFamily: 'Manrope, Arial, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>print</span>
            Print this page →
          </a>
        </div>

        {/* Footer */}
        <footer style={{ padding: '24px 16px 8px', textAlign: 'center' }} className="no-print">
          <div style={footerOrg}>LMSA — A.M. Dogliotti College of Medicine</div>
          <div style={footerMeta}>Student Identification · Official Verification Record</div>
        </footer>

      </main>
    </div>
  )
}
