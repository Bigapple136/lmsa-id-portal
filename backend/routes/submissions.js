const express = require('express')
const router = express.Router()
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const ALLOWED_YEARS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

function requireFullAdmin(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }
  next()
}

// Public: Check if submission form is enabled
router.get('/status', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'submission_form').maybeSingle()
  const enabled = data?.value?.enabled === true
  res.json({ enabled })
})

// Public: Submit student data
router.post('/', async (req, res) => {
  const { data: settings } = await supabase.from('portal_settings').select('value').eq('key', 'submission_form').maybeSingle()
  if (!settings?.value?.enabled) {
    return res.status(403).json({ error: 'Submission form is currently disabled.' })
  }

  const { student_id, full_name, year_level, position, programme, blood_type, student_email, emergency_contact_name, emergency_contact_phone } = req.body

  if (!student_id || !full_name || !year_level) {
    return res.status(400).json({ error: 'student_id, full_name, and year_level are required.' })
  }
  if (!ALLOWED_YEARS.includes(year_level)) {
    return res.status(400).json({ error: `year_level must be one of: ${ALLOWED_YEARS.join(', ')}` })
  }

  const { data, error } = await supabase.from('student_submissions').insert({
    student_id: student_id.trim(),
    full_name: full_name.trim(),
    year_level,
    position: position?.trim() || null,
    programme: programme?.trim() || null,
    blood_type: blood_type?.trim() || null,
    student_email: student_email?.trim() || null,
    emergency_contact_name: emergency_contact_name?.trim() || null,
    emergency_contact_phone: emergency_contact_phone?.trim() || null,
  }).select().single()

  if (error) return res.status(400).json({ error: error.message })
  res.status(201).json({ id: data.id, message: 'Submission received. Awaiting admin review.' })
})

// Admin: List all submissions
router.get('/', requireAdmin, async (req, res) => {
  const { status } = req.query
  let query = supabase.from('student_submissions').select('*').order('created_at', { ascending: false })
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    query = query.eq('status', status)
  }
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// Admin: Approve submission
router.post('/:id/approve', requireAdmin, async (req, res) => {
  const { data: submission, error: fetchErr } = await supabase
    .from('student_submissions').select('*').eq('id', req.params.id).maybeSingle()
  if (fetchErr) return res.status(500).json({ error: fetchErr.message })
  if (!submission) return res.status(404).json({ error: 'Submission not found.' })
  if (submission.status !== 'pending') return res.status(400).json({ error: `Submission already ${submission.status}.` })

  const { data: student, error: insertErr } = await supabase.from('students').insert({
    student_id: submission.student_id,
    full_name: submission.full_name,
    year_level: submission.year_level,
    position: submission.position,
    programme: submission.programme,
    blood_type: submission.blood_type,
    student_email: submission.student_email,
    emergency_contact_name: submission.emergency_contact_name,
    emergency_contact_phone: submission.emergency_contact_phone,
    status: 'pending',
  }).select().single()

  if (insertErr) return res.status(400).json({ error: insertErr.message })

  try {
    const { generateForStudent } = require('./qr')
    await generateForStudent(student)
  } catch {}

  const { error: updateErr } = await supabase.from('student_submissions').update({
    status: 'approved',
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', req.params.id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })
  res.json({ student, message: 'Student approved and record created.' })
})

// Admin: Reject submission
router.patch('/:id/reject', requireAdmin, async (req, res) => {
  const { admin_notes } = req.body
  const { data: submission, error: fetchErr } = await supabase
    .from('student_submissions').select('*').eq('id', req.params.id).maybeSingle()
  if (fetchErr) return res.status(500).json({ error: fetchErr.message })
  if (!submission) return res.status(404).json({ error: 'Submission not found.' })
  if (submission.status !== 'pending') return res.status(400).json({ error: `Submission already ${submission.status}.` })

  const { error } = await supabase.from('student_submissions').update({
    status: 'rejected',
    admin_notes: admin_notes?.trim() || null,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString(),
  }).eq('id', req.params.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ message: 'Submission rejected.' })
})

// Admin: Delete submission
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await supabase.from('student_submissions').delete().eq('id', req.params.id)
  if (error) return res.status(500).json({ error: error.message })
  res.status(204).send()
})

// Admin: Export approved submissions as Word document
router.get('/export', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('student_submissions')
    .select('*').eq('status', 'approved').order('year_level').order('full_name')
  if (error) return res.status(500).json({ error: error.message })

  const grouped = {}
  for (const row of data) {
    if (!grouped[row.year_level]) grouped[row.year_level] = []
    grouped[row.year_level].push(row)
  }

  const yearOrder = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
  const children = []

  children.push(
    new Paragraph({
      text: 'LMSA ID Portal — Student Data for Photoshoot',
      heading: 'Heading1',
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      text: `Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  for (const year of yearOrder) {
    const students = grouped[year]
    if (!students || students.length === 0) continue

    children.push(
      new Paragraph({
        text: `${year} — ${students.length} student(s)`,
        heading: 'Heading2',
        spacing: { before: 400, after: 200 },
      })
    )

    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: ['#', 'Student ID', 'Full Name', 'Position', 'Programme', 'Blood Type', 'Email', 'Emergency Contact', 'Phone', 'Photo', 'Signature'].map(header =>
          new TableCell({
            children: [new Paragraph({ text: header, bold: true, size: 18 })],
            shading: { fill: '#1E3A5A', color: '#FFFFFF', type: 'clear' },
          })
        ),
      }),
    ]

    students.forEach((s, i) => {
      tableRows.push(
        new TableRow({
          children: [
            [String(i + 1), s.student_id, s.full_name, s.position || '—', s.programme || '—', s.blood_type || '—',
             s.student_email || '—', s.emergency_contact_name || '—', s.emergency_contact_phone || '—', '', ''].map(cell =>
              new TableCell({
                children: [new Paragraph({ text: cell, size: 18 })],
              })
            ),
          ],
        })
      )
    })

    children.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )
  }

  if (children.length === 2) {
    children.push(new Paragraph({ text: 'No approved submissions yet.', spacing: { before: 400 } }))
  }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: { run: { size: 22, font: 'Calibri' } },
      },
    },
  })

  const buffer = await Packer.toBuffer(doc)
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Student_Submissions.docx"')
  res.send(buffer)
})

module.exports = router
