const express = require('express')
const router = express.Router()
const QRCode = require('qrcode')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const JSZip = require('jszip')

const FRONTEND_URL = process.env.ALLOWED_ORIGIN || 'https://lmsa-id-portal.vercel.app'

const DEFAULT_QR_FIELDS = {
  programme:               { label: 'Programme',               enabled: true  },
  blood_type:              { label: 'Blood Type',              enabled: true  },
  student_email:           { label: 'Student Email',           enabled: false },
  emergency_contact_name:  { label: 'Emergency Contact Name',  enabled: true  },
  emergency_contact_phone: { label: 'Emergency Contact Phone', enabled: true  },
}

async function getQRFields() {
  const { data } = await supabase.from('portal_settings')
    .select('value').eq('key', 'qr_fields').maybeSingle()
  return data?.value || DEFAULT_QR_FIELDS
}

// ── QR payload: verification page URL ──
function buildPayload(studentId) {
  return `${FRONTEND_URL}/qr/${encodeURIComponent(studentId)}`
}

// ── Generate QR PNG buffer ──
async function generateQRBuffer(student) {
  const payload = buildPayload(student.student_id)
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  })
  return buffer
}

// ── Upload QR PNG to Supabase Storage ──
async function uploadQR(buffer, student) {
  const yearFolder = (student.year_level || 'unknown')
    .toLowerCase().replace(/\s+/g, '-')
  const path = `${yearFolder}/${student.student_id}.png`

  const { error } = await supabase.storage
    .from('qr-codes')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('qr-codes').getPublicUrl(path)
  return publicUrl
}

// ── Save QR URL back to student record ──
async function saveQRUrl(studentId, url) {
  await supabase.from('students')
    .update({ qr_url: url })
    .eq('student_id', studentId)
}

// ── Generate QR for a single student (called internally + from route) ──
async function generateForStudent(student) {
  const buffer = await generateQRBuffer(student)
  const url = await uploadQR(buffer, student)
  await saveQRUrl(student.student_id, url)
  return url
}

// POST /api/qr/generate/:studentId — generate/regenerate for one student
router.post('/generate/:studentId', requireAdmin, async (req, res) => {
  const { data: student, error } = await supabase
    .from('students').select('*')
    .eq('student_id', req.params.studentId).maybeSingle()

  if (error || !student)
    return res.status(404).json({ error: 'Student not found.' })

  try {
    const url = await generateForStudent(student)
    res.json({ qr_url: url, student_id: student.student_id })
  } catch (err) {
    res.status(500).json({ error: 'QR generation failed: ' + err.message })
  }
})

// POST /api/qr/generate-all — bulk generate for all students missing a QR
router.post('/generate-all', requireAdmin, async (req, res) => {
  const { force } = req.body

  const query = supabase.from('students').select('*')
  if (!force) query.is('qr_url', null)

  const { data: students, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length) return res.json({ generated: 0, message: 'All students already have QR codes.' })

  let generated = 0, failed = 0
  for (const student of students) {
    try {
      await generateForStudent(student)
      generated++
    } catch {
      failed++
    }
  }

  res.json({ generated, failed, total: students.length })
})

// GET /api/qr/html/:studentId — self-contained branded verification page
router.get('/html/:studentId', async (req, res) => {
  const { data: student, error } = await supabase
    .from('students').select('*')
    .eq('student_id', req.params.studentId).maybeSingle()

  if (error || !student)
    return res.status(404).json({ error: 'Student not found.' })

  try {
    const verifyUrl = buildPayload(student.student_id)
    const qrFields = await getQRFields()

    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      type: 'image/png', width: 120, margin: 1,
      errorCorrectionLevel: 'L',
      color: { dark: '#00653c', light: '#FFFFFF' }
    })

    const qrHeroUrl = await QRCode.toDataURL(verifyUrl, {
      type: 'image/png', width: 160, margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#00653c', light: '#FFFFFF' }
    })

    const name = student.full_name || '—'
    const sid = student.student_id || '—'
    const level = student.year_level || '—'
    const position = student.position || null
    const programme = student.programme || null
    const bloodType = student.blood_type || null
    const email = student.student_email || null
    const emergName = student.emergency_contact_name || null
    const emergPhone = student.emergency_contact_phone || null

    const showProgramme    = qrFields.programme?.enabled              && programme
    const showBloodType    = qrFields.blood_type?.enabled            && bloodType
    const showEmail        = qrFields.student_email?.enabled         && email
    const showEmerContact  = qrFields.emergency_contact_name?.enabled  && emergName
    const showEmerPhone    = qrFields.emergency_contact_phone?.enabled && emergPhone

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${name} — LMSA ID Verification</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;background:#f6fbf4;color:#181d19;min-height:100vh}
.bg-hero{background:linear-gradient(135deg,#00653c 0%,#1e7f51 100%)}
.text-emerald-accent{color:#00653c}
.bg-emerald-accent{background:#00653c}
.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}
.material-symbols-filled{font-variation-settings:'FILL' 1,'wght' 400,'GRAD' 0,'opsz' 24}
.container{max-width:480px;margin:0 auto}

/* fixed header */
.topbar{position:fixed;top:0;left:0;right:0;z-index:50;background:rgba(6,45,27,0.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.topbar-inner{max-width:480px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between}
.topbar-logo{font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:15px;color:#fff;letter-spacing:-0.01em}
.topbar-crest{width:32px;height:32px;background:#C9A84C;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Manrope',Arial,sans-serif;font-weight:900;font-size:11px;color:#0D1B2A;flex-shrink:0}

/* page content */
.page{padding:72px 16px 32px}

/* hero card */
.hero{background:linear-gradient(135deg,#00653c 0%,#1e7f51 100%);border-radius:24px 24px 0 0;padding:28px 24px 40px;position:relative;overflow:hidden}
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
.profile-id span{color:#CC0000}

/* bento grid */
.bento{padding:20px 16px 0;display:flex;flex-direction:column;gap:12px}
.bento-card{background:#fff;border:1px solid rgba(0,0,0,0.07);border-radius:16px;padding:16px}
.bento-card-label{font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(24,29,25,0.45);margin-bottom:6px}
.bento-card-value{font-family:'Manrope',Arial,sans-serif;font-weight:700;font-size:16px;color:#181d19}
.bento-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}

/* contact / emergency cards */
.contact-row{display:flex;align-items:center;gap:12px;padding:12px 0}
.contact-row + .contact-row{border-top:1px solid #f0f5ee}
.contact-icon{width:36px;height:36px;background:rgba(0,101,60,0.08);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.contact-icon .material-symbols-outlined{font-size:18px;color:#00653c}
.contact-label{font-size:9px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(24,29,25,0.45);margin-bottom:2px}
.contact-value{font-size:13px;font-weight:600;color:#181d19}

/* scan QR reference */
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
  .topbar,.qr-ref,.footer-print-hide{display:none!important}
  body{background:#fff;padding:0}
  .hero{background:#00653c!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .profile-photo{border-color:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .photo-badge{background:#00653c!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bento-card,.qr-ref-inner{background:#fff!important}
  .page{padding-top:16px}
}
</style>
</head>
<body>

<!-- Fixed top bar -->
<header class="topbar">
  <div class="topbar-inner">
    <div class="topbar-logo">LMSA — A.M. Dogliotti College of Medicine</div>
    <div class="topbar-crest">LM</div>
  </div>
</header>

<!-- Page content -->
<main class="page container">

  <!-- Hero -->
  <div class="hero">
    <div class="hero-eyebrow">Student Identity Verification</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <div class="hero-name">${name}</div>
        <div class="hero-sub">${level}${position ? ' · ' + position : ''}</div>
      </div>
      <div class="hero-badge">
        <span class="material-symbols-outlined" style="font-size:12px">verified</span>
        Active
      </div>
    </div>
  </div>

  <!-- Profile row -->
  <div class="profile-row">
    <div class="profile-photo-wrap">
      ${student.photo_url
        ? `<img class="profile-photo" src="${student.photo_url}" alt="${name}"/>`
        : `<div class="profile-photo" style="display:flex;align-items:center;justify-content:center;font-family:'Manrope',Arial,sans-serif;font-weight:800;font-size:22px;color:rgba(255,255,255,0.7);background:linear-gradient(135deg,#00653c,#1e7f51)">${name.split(' ').map(w=>w[0]).filter(Boolean).slice(0,2).join('').toUpperCase()}</div>`
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

    ${showProgramme || showBloodType ? `
    <div class="bento-grid-2">
      ${showBloodType ? `
      <div class="bento-card">
        <div class="bento-card-label">Blood Type</div>
        <div class="bento-card-value">${bloodType}</div>
      </div>` : '<div></div>'}
      ${showProgramme ? `
      <div class="bento-card">
        <div class="bento-card-label">Programme</div>
        <div class="bento-card-value">${programme}</div>
      </div>` : '<div></div>'}
    </div>` : ''}

    ${showEmail ? `
    <div class="bento-card">
      <div class="contact-row">
        <div class="contact-icon"><span class="material-symbols-outlined">mail</span></div>
        <div>
          <div class="contact-label">Student Email</div>
          <div class="contact-value">${email}</div>
        </div>
      </div>
    </div>` : ''}

    ${showEmerContact || showEmerPhone ? `
    <div class="bento-card">
      <div style="font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(24,29,25,0.45);margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <span class="material-symbols-outlined" style="font-size:14px;color:#CC0000">emergency</span>
        Emergency Contact
      </div>
      ${showEmerContact ? `
      <div class="contact-row">
        <div class="contact-icon"><span class="material-symbols-outlined">person</span></div>
        <div>
          <div class="contact-label">Contact Name</div>
          <div class="contact-value">${emergName}</div>
        </div>
      </div>` : ''}
      ${showEmerPhone ? `
      <div class="contact-row">
        <div class="contact-icon"><span class="material-symbols-outlined">phone</span></div>
        <div>
          <div class="contact-label">Phone Number</div>
          <div class="contact-value">${emergPhone}</div>
        </div>
      </div>` : ''}
    </div>` : ''}

  </div>

  <!-- QR reference scan section -->
  <div class="qr-ref footer-print-hide">
    <div class="qr-ref-inner">
      <div class="qr-ref-text">
        <div class="qr-ref-title">Scan to Verify Identity</div>
        <div class="qr-ref-hint">Scan this QR code with any reader to confirm this identity record.</div>
      </div>
      <img src="${qrDataUrl}" alt="Verification QR" width="72" height="72"/>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer footer-print-hide">
    <div class="footer-org">GoldWay · LMSA</div>
    <div class="footer-meta">A.M. Dogliotti College of Medicine · Official Student ID Verification</div>
  </footer>

</main>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="LMSA_${sid}.html"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate page: ' + err.message })
  }
})

// GET /api/qr/export — download all QR codes as a ZIP organised by year level
router.get('/export', requireAdmin, async (req, res) => {
  const { data: students, error } = await supabase
    .from('students').select('student_id, full_name, year_level, qr_url')
    .not('qr_url', 'is', null)
    .order('year_level')

  if (error) return res.status(500).json({ error: error.message })
  if (!students?.length)
    return res.status(404).json({ error: 'No QR codes generated yet. Generate them first.' })

  const zip = new JSZip()
  const root = zip.folder('qr-codes')

  for (const s of students) {
    try {
      const resp = await fetch(s.qr_url)
      if (!resp.ok) continue
      const buffer = Buffer.from(await resp.arrayBuffer())
      const yearFolder = (s.year_level || 'unknown')
        .toLowerCase().replace(/\s+/g, '-')
      root.folder(yearFolder).file(`${s.student_id}.png`, buffer)
    } catch { /* skip failed fetch */ }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_QR_Codes.zip"')
  res.send(zipBuffer)
})

// Export generateForStudent so students.js can call it automatically
module.exports = router
module.exports.generateForStudent = generateForStudent
