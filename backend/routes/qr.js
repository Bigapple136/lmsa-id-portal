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

async function buildPayload(student) {
  const qrFields = await getQRFields()
  const payload = {
    id: student.student_id,
    name: student.full_name,
    level: student.year_level,
    position: student.position || '',
    issued_by: 'LMSA — A.M. Dogliotti College of Medicine',
  }
  if (qrFields.programme?.enabled)               payload.programme = student.programme || ''
  if (qrFields.blood_type?.enabled)              payload.blood_type = student.blood_type || ''
  if (qrFields.student_email?.enabled)             payload.email = student.student_email || ''
  if (qrFields.emergency_contact_name?.enabled)  payload.emergency_contact = student.emergency_contact_name || ''
  if (qrFields.emergency_contact_phone?.enabled) payload.emergency_phone = student.emergency_contact_phone || ''
  return JSON.stringify(payload)
}

async function generateQRBuffer(student) {
  const payload = await buildPayload(student)
  const buffer = await QRCode.toBuffer(payload, {
    type: 'png',
    width: 400,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#0D1B2A', light: '#FFFFFF' }
  })
  return buffer
}

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

async function saveQRUrl(studentId, url) {
  await supabase.from('students')
    .update({ qr_url: url })
    .eq('student_id', studentId)
}

async function generateForStudent(student) {
  const buffer = await generateQRBuffer(student)
  const url = await uploadQR(buffer, student)
  await saveQRUrl(student.student_id, url)
  return url
}

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

router.get('/html/:studentId', async (req, res) => {
  const { data: student, error } = await supabase
    .from('students').select('*')
    .eq('student_id', req.params.studentId).maybeSingle()

  if (error || !student)
    return res.status(404).json({ error: 'Student not found.' })

  try {
    const payload = await buildPayload(student)
    const qrDataUrl = await QRCode.toDataURL(payload, {
      type: 'image/png', width: 280, margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0D1B2A', light: '#FFFFFF' }
    })
    const qrFields = await getQRFields()

    const INFO_ROWS = [
      { label: 'Full Name',            value: student.full_name              || '—' },
      { label: 'Student ID',           value: student.student_id            || '—', style: 'color:#CC0000' },
      { label: 'Level',                value: student.year_level            || '—' },
      { label: 'Position',             value: student.position             || '—' },
      { label: 'Programme',             value: student.programme,            show: qrFields.programme?.enabled               },
      { label: 'Blood Type',           value: student.blood_type,           show: qrFields.blood_type?.enabled              },
      { label: 'Email',               value: student.student_email,         show: qrFields.student_email?.enabled          },
      { label: 'Emergency Contact',    value: student.emergency_contact_name, show: qrFields.emergency_contact_name?.enabled },
      { label: 'Emergency Phone',      value: student.emergency_contact_phone, show: qrFields.emergency_contact_phone?.enabled },
    ]

    const infoRows = INFO_ROWS
      .filter(r => r.show === undefined || r.show === true)
      .map(r => `<div class="info-row">
        <span class="info-label">${r.label}</span>
        <span class="info-value"${r.style ? ` style="${r.style}"` : ''}>${r.value || '—'}</span>
      </div>`).join('\n')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>ID Verification — ${student.full_name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #0D1B2A;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      overflow: hidden;
      max-width: 400px;
      width: 100%;
    }
    .header {
      background: #0D1B2A;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .crest {
      width: 48px; height: 48px;
      background: #C9A84C; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 14px; color: #0D1B2A; flex-shrink: 0;
    }
    .header-text h1 { font-size: 13px; font-weight: 700; color: #C9A84C; letter-spacing: 0.08em; text-transform: uppercase; }
    .header-text p  { font-size: 10px; color: #8a9ab5; margin-top: 2px; letter-spacing: 0.04em; }
    .body     { padding: 24px; text-align: center; }
    .qr-wrap  { display: inline-block; border: 4px solid #0D1B2A; border-radius: 8px; padding: 8px; background: #fff; }
    .qr-wrap img { display: block; width: 280px; height: 280px; }
    .scan-hint { margin-top: 12px; font-size: 11px; color: #888; letter-spacing: 0.05em; }
    .print-btn {
      display: inline-block; margin-top: 16px;
      background: #0D1B2A; color: #C9A84C; border: none;
      padding: 10px 28px; border-radius: 8px;
      font-size: 13px; font-weight: 600; cursor: pointer; letter-spacing: 0.05em;
    }
    .print-btn:hover { background: #1a2d45; }
    .divider { height: 1px; background: #eee; margin: 20px 0; }
    .info    { text-align: left; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-value { font-weight: 600; color: #1a1a2e; text-align: right; }
    .footer { background: #f8f9fa; padding: 12px 24px; text-align: center; font-size: 10px; color: #aaa; letter-spacing: 0.04em; }
    @media print {
      body { background: white; padding: 0; }
      .card { box-shadow: none; max-width: 100%; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="crest">LM</div>
      <div class="header-text">
        <h1>LMSA — A.M. Dogliotti College of Medicine</h1>
        <p>Student Identification · Official Verification Record</p>
      </div>
    </div>
    <div class="body">
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="QR Code"/>
      </div>
      <p class="scan-hint">Scan with any QR reader to verify identity</p>
      <button class="print-btn" onclick="window.print()">Print this page</button>
    </div>
    <div class="divider"></div>
    <div class="body" style="padding-top:0">
      <div class="info">${infoRows}</div>
    </div>
    <div class="footer">LMSA ID VERIFICATION · GoldWay · A.M. Dogliotti College of Medicine</div>
  </div>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html')
    res.setHeader('Content-Disposition', `inline; filename="QR_${student.student_id}.html"`)
    res.send(html)
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR page: ' + err.message })
  }
})

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

module.exports = router
module.exports.generateForStudent = generateForStudent
