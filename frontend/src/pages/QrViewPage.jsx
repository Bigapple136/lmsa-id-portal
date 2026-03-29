import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { apiFetch } from '../lib/api'

export default function QrViewPage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`/api/students/${encodeURIComponent(studentId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return }
        setStudent(data)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load student data.'); setLoading(false) })
  }, [studentId])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#C9A84C', fontFamily: 'Arial, sans-serif', fontSize: '14px', letterSpacing: '0.05em' }}>Loading...</div>
    </div>
  )

  if (error || !student) return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#CC0000', fontFamily: 'Arial, sans-serif', fontSize: '14px' }}>{error || 'Student not found.'}</div>
    </div>
  )

  const VERIFY_URL = `${import.meta.env.VITE_API_URL}/api/qr/html/${encodeURIComponent(studentId)}`

  return (
    <div style={{ minHeight: '100vh', background: '#0D1B2A' }}>
      <Navbar />
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>

          <div style={{ background: '#0D1B2A', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', background: '#C9A84C', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '14px', color: '#0D1B2A', flexShrink: 0 }}>
              LM
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#C9A84C', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                LMSA — A.M. Dogliotti College of Medicine
              </div>
              <div style={{ fontSize: '10px', color: '#8a9ab5', marginTop: '2px', letterSpacing: '0.04em' }}>
                Student Identification · Official Verification Record
              </div>
            </div>
          </div>

          <div style={{ padding: '24px', textAlign: 'center' }}>
            {student.qr_url ? (
              <div style={{ display: 'inline-block', border: '4px solid #0D1B2A', borderRadius: '8px', padding: '8px', background: '#fff' }}>
                <img src={student.qr_url} alt="QR Code" style={{ display: 'block', width: '280px', height: '280px' }} />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '4px solid #0D1B2A', borderRadius: '8px', padding: '24px', background: '#f5f5f5', width: '296px', height: '296px' }}>
                <div style={{ fontSize: '32px' }}>🔲</div>
                <div style={{ fontSize: '12px', color: '#888' }}>QR code not generated yet.</div>
              </div>
            )}
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#888', letterSpacing: '0.05em' }}>
              Scan with any QR reader to verify identity
            </div>
          </div>

          <div style={{ height: '1px', background: '#eee', margin: '0 24px' }} />

          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ textAlign: 'left' }}>
              {[
                { label: 'Full Name',             value: student.full_name,             style: null },
                { label: 'Student ID',           value: student.student_id,           style: 'color:#CC0000' },
                { label: 'Level',                 value: student.year_level,            style: null },
                { label: 'Position',              value: student.position,             style: null },
                { label: 'Programme',             value: student.programme,             style: null },
                { label: 'Blood Type',            value: student.blood_type,           style: null },
                { label: 'Email',               value: student.student_email,        style: null },
                { label: 'Emergency Contact',    value: student.emergency_contact_name, style: null },
                { label: 'Emergency Phone',      value: student.emergency_contact_phone, style: null },
              ].filter(r => r.value).map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: '13px' }}>
                  <span style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</span>
                  <span style={{ fontWeight: '600', color: '#1a1a2e', textAlign: 'right', ...(r.style ? { style: r.style } : {}) }}>{r.value}</span>
                </div>
              ))}
            </div>

            {student.qr_url && (
              <a
                href={VERIFY_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '16px', background: '#0D1B2A', color: '#C9A84C', textAlign: 'center', padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', letterSpacing: '0.05em' }}
              >
                Open print-ready page →
              </a>
            )}
          </div>

          <div style={{ background: '#f8f9fa', padding: '12px 24px', textAlign: 'center', fontSize: '10px', color: '#aaa', letterSpacing: '0.04em' }}>
            LMSA ID VERIFICATION · GoldWay · A.M. Dogliotti College of Medicine
          </div>
        </div>
      </div>
    </div>
  )
}
