const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const { supabase } = require('../db')
const { requireAdmin, requireFullAdmin } = require('../middleware/auth')
const { maxLength } = require('../middleware/validate')
const { getQRFields } = require('./settings')
// Token sign/verify + rotatable key store live in qr-keys.js (single source).
// Re-exported below so existing `require('./qr')` consumers keep working.
const {
  signStudentToken,
  verifyStudentToken,
  signV2,
} = require('../qr-keys')
const logger = require('../logger')

const JSZip = require('jszip')

const BACKEND_URL = process.env.BACKEND_URL
const FRONTEND_URL = process.env.FRONTEND_URL

function getSupabaseHostname() {
  try {
    return new URL(process.env.SUPABASE_URL).hostname
  } catch {
    return '*.supabase.co'
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// signStudentToken and verifyStudentToken are imported from ../qr-keys.
// Phase 1: signing still emits v1 (see qr-keys.js); verify accepts v1 (shim)
// and v2. Issuer flip to v2 is the deliberate separate Phase 2 change.

async function buildPayload(student) {
  const token = await signStudentToken(student.student_id)
  return `${BACKEND_URL}/api/qr/html/${token}`
}

async function generateQRBuffer(student) {
  const url = await buildPayload(student)
  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0D1B2A', light: '#FFFFFF' },
  })
  return buffer
}

async function uploadQR(buffer, student) {
  const yearFolder = (student.year_level || 'unknown').toLowerCase().replace(/\s+/g, '-')
  const path = `${yearFolder}/${student.student_id}.png`

  const { error } = await supabase.storage
    .from('qr-codes')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)

  const {
    data: { publicUrl },
  } = supabase.storage.from('qr-codes').getPublicUrl(path)
  return publicUrl
}

async function saveQRUrl(studentId, url) {
  await supabase.from('students').update({ qr_url: url }).eq('student_id', studentId)
}

function normaliseYearFolder(yearLevel) {
  return (yearLevel || 'unknown').toLowerCase().replace(/\s+/g, '-')
}

async function deleteQRFile(studentId, yearLevel) {
  const folder = normaliseYearFolder(yearLevel)
  const path = `${folder}/${studentId}.png`
  await supabase.storage.from('qr-codes').remove([path])
}

async function generateForStudent(student) {
  // Generate and upload the new QR first, then delete the old file.
  // This prevents data loss if generation fails partway through.
  const buffer = await generateQRBuffer(student)
  const url = await uploadQR(buffer, student)
  await saveQRUrl(student.student_id, url)
  // Clean up old QR file (best-effort — the new one is already saved)
  if (student.year_level) {
    try {
      await deleteQRFile(student.student_id, student.year_level)
    } catch (err) {
      logger.warn({ studentId: student.student_id, err: err.message }, 'Failed to clean up old QR file')
    }
  }
  return url
}

router.post('/generate/:studentId', requireAdmin, requireFullAdmin, async (req, res) => {
  const sidErr = maxLength(req.params.studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', req.params.studentId)
    .maybeSingle()

  if (error || !student) return res.status(404).json({ error: 'Student not found.' })

  try {
    const url = await generateForStudent(student)
    res.json({ qr_url: url, student_id: student.student_id })
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed: ' + err.message })
  }
})

router.post('/generate-all', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data: students, error } = await supabase.from('students').select('*').is('qr_url', null)

  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length)
    return res.json({ generated: 0, message: 'All students already have QR codes.' })

  let generated = 0,
    failed = 0
  for (const student of students) {
    try {
      await generateForStudent(student)
      generated++
    } catch (err) {
      logger.warn({ studentId: student.student_id, err: err.message }, 'QR generation failed')
      failed++
    }
  }

  res.json({ generated, failed, total: students.length })
})

router.post('/regenerate/:studentId', requireAdmin, requireFullAdmin, async (req, res) => {
  const sidErr = maxLength(req.params.studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', req.params.studentId)
    .maybeSingle()

  if (error || !student) return res.status(404).json({ error: 'Student not found.' })

  try {
    await supabase.from('students').update({ qr_url: null }).eq('student_id', student.student_id)
    const url = await generateForStudent(student)
    res.json({ qr_url: url, student_id: student.student_id })
  } catch (err) {
    res.status(500).json({ error: 'QR regeneration failed: ' + err.message })
  }
})

router.post('/regenerate-all', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data: students, error } = await supabase.from('students').select('*')

  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length) return res.json({ generated: 0, message: 'No students found.' })

  let generated = 0,
    failed = 0
  for (const student of students) {
    try {
      await generateForStudent(student)
      generated++
    } catch (err) {
      logger.warn({ studentId: student.student_id, err: err.message }, 'QR regeneration failed')
      failed++
    }
  }

  res.json({ generated, failed, total: students.length })
})

router.get('/verification-url/:studentId', requireAdmin, async (req, res) => {
  const sidErr = maxLength(req.params.studentId, 50, 'studentId')
  if (sidErr) return res.status(400).json({ error: sidErr })

  try {
    const { data: student, error } = await supabase
      .from('students')
      .select('student_id')
      .eq('student_id', req.params.studentId)
      .maybeSingle()
    if (error || !student) return res.status(404).json({ error: 'Student not found.' })
    const token = await signStudentToken(student.student_id)
    const url = `${BACKEND_URL}/api/qr/html/${token}`
    res.json({ url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/html/:studentId', async (req, res) => {
  const rawToken = req.params.studentId
  const studentId = await verifyStudentToken(rawToken)
  if (!studentId)
    return res.status(403).send('Invalid or tampered QR code. Please request a new ID card.')

  const { data: student, error } = await supabase
    .from('students')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error || !student) return res.status(404).json({ error: 'Student not found.' })

  try {
    const qrFields = await getQRFields()

    const rawName = student.full_name || '—'
    const name = escapeHtml(rawName)
    const sid = escapeHtml(student.student_id || '—')
    const level = escapeHtml(student.year_level || '—')
    const position = escapeHtml(student.position) || null
    const programme = escapeHtml(student.programme) || null
    const bloodType = escapeHtml(student.blood_type) || null
    const email = escapeHtml(student.student_email) || null
    const emergName = escapeHtml(student.emergency_contact_name) || null
    const emergPhone = escapeHtml(student.emergency_contact_phone) || null
    const dob = escapeHtml(student.date_of_birth) || null
    const nationality = escapeHtml(student.nationality) || null
    const county = escapeHtml(student.county_of_origin) || null
    const address = escapeHtml(student.current_address) || null

    const showBloodType = qrFields.blood_type?.enabled && bloodType
    const showProgramme = qrFields.programme?.enabled && programme
    const showEmail = qrFields.student_email?.enabled && email
    const showEmerName = qrFields.emergency_contact_name?.enabled && emergName
    const showEmerPhone = qrFields.emergency_contact_phone?.enabled && emergPhone
    const showEmerCard = showEmerName || showEmerPhone
    const showDob = qrFields.date_of_birth?.enabled && dob
    const showNationality = qrFields.nationality?.enabled && nationality
    const showCounty = qrFields.county_of_origin?.enabled && county
    const showAddress = qrFields.current_address?.enabled && address

    const initials = rawName
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta http-equiv="Content-Security-Policy" content="img-src 'self' data: https://${getSupabaseHostname()} https://*.supabase.co ${FRONTEND_URL}"/>
<title>${escapeHtml(student.full_name || 'Student')} — LMSA ID Verification</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;background:#f6fbf4;color:#181d19;min-height:100vh}
.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}

.container{max-width:480px;margin:0 auto}

/* fixed topbar */
.topbar{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(6,45,27,0.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.topbar-inner{max-width:480px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.topbar-logo{font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#fff;letter-spacing:-0.01em}
.topbar-crest{width:40px;height:40px;flex-shrink:0;overflow:hidden}

/* page content */
.page{padding:72px 16px 32px}

/* hero */
.hero{background:linear-gradient(135deg,#00653c 0%,#1e7f51 100%);border-radius:24px 24px 0 0;padding:28px 24px 44px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;top:-40px;right:-40px;width:160px;height:160px;background:rgba(255,255,255,0.08);border-radius:50%}
.hero-eyebrow{font-size:10px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.65);margin-bottom:8px}
.hero-badge{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:6px}
.hero-name{font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:26px;color:#fff;letter-spacing:-0.02em;line-height:1.1;margin:12px 0 4px}
.hero-sub{font-size:13px;color:rgba(255,255,255,0.8)}

/* profile row */
.profile-row{padding:0 24px;display:flex;justify-content:space-between;align-items:flex-end;margin-top:-28px;position:relative;z-index:2}
.profile-photo-wrap{position:relative}
.profile-photo{width:96px;height:96px;border-radius:14px;object-fit:cover;border:3px solid #fff;box-shadow:0 4px 20px rgba(0,0,0,0.15);background:#d7dbd5;display:block}
.photo-badge{position:absolute;bottom:-6px;right:-6px;background:#00653c;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff}
.profile-meta{text-align:right;padding-bottom:6px}
.profile-id-label{font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(24,29,25,0.5);margin-bottom:2px}
.profile-id{font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:18px;color:#00653c;letter-spacing:-0.01em}
.profile-id span{color:#AE535B}

/* bento grid */
.bento{padding:20px 16px 0;display:flex;flex-direction:column;gap:12px}
.bento-card{background:#fff;border:1px solid rgba(0,0,0,0.07);border-radius:16px;padding:16px}
.bento-card-label{font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(24,29,25,0.45);margin-bottom:6px}
.bento-card-value{font-family:'Manrope',Arial,sans-serif;font-weight:700;font-size:16px;color:#181d19}
.bento-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* contact rows */
.contact-row{display:flex;align-items:center;gap:12px;padding:12px 0}
.contact-row+ .contact-row{border-top:1px solid #f0f5ee}
.contact-icon{width:36px;height:36px;background:rgba(0,101,60,0.08);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.contact-icon .material-symbols-outlined{font-size:18px;color:#00653c}
.contact-label{font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(24,29,25,0.45);margin-bottom:2px}
.contact-value{font-size:13px;font-weight:600;color:#181d19}

/* QR reference */
.qr-ref{border-top:1px solid rgba(0,0,0,0.07);padding:20px 16px 0;margin-top:4px}
.qr-ref-inner{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#f0f5ee;border-radius:14px;gap:12px}
.qr-ref-text{flex:1}
.qr-ref-title{font-family:'Manrope',Arial,sans-serif;font-weight:700;font-size:13px;color:#181d19;margin-bottom:2px}
.qr-ref-hint{font-size:11px;color:rgba(24,29,25,0.5)}
.qr-ref img{display:block;border-radius:8px;border:2px solid #00653c;flex-shrink:0}

/* footer */
.footer{padding:24px 16px 8px;text-align:center}
.footer-org{font-family:'Manrope',Arial,sans-serif;font-weight:700;font-size:13px;color:#00653c;margin-bottom:4px}
.footer-meta{font-size:10px;color:rgba(24,29,25,0.4);letter-spacing:0.04em}

/* print */
@media print{
  .topbar,.qr-ref,.footer,.no-print{display:none!important}
  body{background:#fff;padding:0}
  .hero{background:#00653c!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .profile-photo{border-color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .photo-badge{background:#00653c!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bento-card{background:#fff!important}
  .page{padding-top:16px}
}
</style>
</head>
<body>

<!-- Fixed topbar -->
<header class="topbar">
  <div class="topbar-inner">
    <div class="topbar-logo">LMSA — A.M. Dogliotti College of Medicine</div>
    <div class="topbar-crest" style="background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;">
      <img src="${escapeHtml(FRONTEND_URL)}/lmsa-logo.png" alt="LMSA Logo" width="36" height="36" style="border-radius:50%;object-fit:contain;" crossorigin="anonymous"/>
    </div>
  </div>
</header>

<!-- Page content -->
<main class="page container">

  <!-- Hero -->
  <div class="hero">
    <div class="hero-eyebrow"><span style="color:#ffffff">Student Doctor-In-Training</span></div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="hero-name">${name}</div>
        <div class="hero-sub">${level}${position ? ' · ' + position : ''}</div>
      </div>
      <div class="hero-badge">✓</div>
    </div>
  </div>

  <!-- Profile row -->
  <div class="profile-row">
    <div class="profile-photo-wrap">
      ${
        student.photo_url
          ? `<img class="profile-photo" src="${escapeHtml(student.photo_url)}" alt="${name}" crossorigin="anonymous"/>`
          : `<div class="profile-photo" style="display:flex;align-items:center;justify-content:center;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:22px;color:rgba(255,255,255,0.7);background:linear-gradient(135deg,#00653c,#1e7f51)">${initials}</div>`
      }
      <div class="photo-badge">
        <span class="material-symbols-outlined" style="font-size:12px;color:#fff">verified</span>
      </div>
    </div>
    <div class="profile-meta">
      <div class="profile-id-label">Student ID</div>
      <div class="profile-id"><span>${sid}</span></div>
    </div>
  </div>

  <!-- Bento grid -->
  <div class="bento">

    ${
      showBloodType || showProgramme
        ? `
    <div class="bento-grid-2">
      ${
        showBloodType
          ? `
      <div class="bento-card">
        <div class="bento-card-label">Blood Type</div>
        <div class="bento-card-value">${bloodType}</div>
      </div>`
          : '<div></div>'
      }
      ${
        showProgramme
          ? `
      <div class="bento-card">
        <div class="bento-card-label">Programme</div>
        <div class="bento-card-value" style="font-size:13px">${programme}</div>
      </div>`
          : '<div></div>'
      }
    </div>`
        : ''
    }

    ${
      showEmail
        ? `
    <div class="bento-card">
      <div class="bento-card-label">Email Address</div>
      <div class="bento-card-value" style="font-size:14px;word-break:break-all">${email}</div>
    </div>`
        : ''
    }

    ${
      showEmerCard
        ? `
    <div class="bento-card">
      <div class="bento-card-label">Emergency Contact</div>
      <div>
        ${
          showEmerName
            ? `
        <div class="contact-row" style="padding:12px 0;border-bottom:1px solid #f0f5ee">
          <div class="contact-icon"><span class="material-symbols-outlined">person</span></div>
          <div>
            <div class="contact-label">Name</div>
            <div class="contact-value">${emergName}</div>
          </div>
        </div>`
            : ''
        }
        ${
          showEmerPhone
            ? `
        <div class="contact-row" style="padding-top:${showEmerName ? '12px' : '0'}">
          <div class="contact-icon"><span class="material-symbols-outlined">call</span></div>
          <div>
            <div class="contact-label">Phone</div>
            <div class="contact-value">${emergPhone}</div>
          </div>
        </div>`
            : ''
        }
      </div>
    </div>`
        : ''
    }

    ${
      showDob || showNationality
        ? `
    <div class="bento-grid-2">
      ${
        showDob
          ? `
      <div class="bento-card">
        <div class="bento-card-label">Date of Birth</div>
        <div class="bento-card-value">${dob}</div>
      </div>`
          : '<div></div>'
      }
      ${
        showNationality
          ? `
      <div class="bento-card">
        <div class="bento-card-label">Nationality</div>
        <div class="bento-card-value">${nationality}</div>
      </div>`
          : '<div></div>'
      }
    </div>`
        : ''
    }

    ${
      showCounty
        ? `
    <div class="bento-card">
      <div class="bento-card-label">County of Origin</div>
      <div class="bento-card-value">${county}</div>
    </div>`
        : ''
    }

    ${
      showAddress
        ? `
    <div class="bento-card">
      <div class="bento-card-label">Current Address</div>
      <div class="bento-card-value" style="font-size:13px">${address}</div>
    </div>`
        : ''
    }

  </div>

  <!-- QR Reference section -->
  ${
    student.qr_url
      ? `
  <div class="qr-ref no-print">
    <div class="qr-ref-inner">
      <div class="qr-ref-text">
        <div class="qr-ref-title">Scan this card's QR code to verify identity</div>
        <div class="qr-ref-hint">Use any QR scanner app</div>
      </div>
      <img src="${escapeHtml(student.qr_url)}" alt="QR Code" crossorigin="anonymous" style="width:72px;height:72px"/>
    </div>
  </div>`
      : ''
  }

  <!-- Footer -->
  <footer class="footer no-print">
    <div class="footer-org">LMSA — A.M. Dogliotti College of Medicine</div>
    <div class="footer-org">University of Liberia</div>
    <div class="footer-meta">Student Identification · Official Verification Record</div>
  </footer>

</main>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="QR_${student.student_id}.html"`)
    res.setHeader(
      'Content-Security-Policy',
      `img-src 'self' data: https://${getSupabaseHostname()} https://*.supabase.co ${FRONTEND_URL}; frame-ancestors 'none'`,
    )
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR page: ' + err.message })
  }
})

router.get('/export', requireAdmin, requireFullAdmin, async (req, res) => {
  const { data: students, error } = await supabase
    .from('students')
    .select('student_id, full_name, year_level, qr_url')
    .not('qr_url', 'is', null)
    .order('year_level')

  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length)
    return res.status(404).json({ error: 'No QR codes generated yet. Generate them first.' })

  const zip = new JSZip()
  const root = zip.folder('qr-codes')

  const CONCURRENCY = 10
  let idx = 0
  async function downloadWorker() {
    while (idx < students.length) {
      const i = idx++
      const s = students[i]
      try {
        const resp = await fetch(s.qr_url)
        if (!resp.ok) continue
        const buffer = Buffer.from(await resp.arrayBuffer())
        const yearFolder = (s.year_level || 'unknown').toLowerCase().replace(/\s+/g, '-')
        root.folder(yearFolder).file(`${s.student_id}.png`, buffer)
      } catch (err) {
        logger.warn({ studentId: s.student_id, err: err.message }, 'QR export fetch failed')
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, students.length) }, downloadWorker))

  try {
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', 'attachment; filename="LMSA_QR_Codes.zip"')
    res.send(zipBuffer)
  } catch (err) {
    logger.error({ err }, 'QR export zip generation failed')
    res.status(500).json({ error: 'Failed to generate QR export ZIP.' })
  }
})

module.exports = router
module.exports.generateForStudent = generateForStudent
module.exports.deleteQRFile = deleteQRFile
module.exports.signStudentToken = signStudentToken
module.exports.verifyStudentToken = verifyStudentToken
// v2 surface re-exported for tests and the future Phase 2 issuer / Phase 3
// rotation endpoints. Issuance still emits v1 in this PR — see qr-keys.js.
module.exports.signV2 = signV2
