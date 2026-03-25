const express = require('express')
const router = express.Router()
const ExcelJS = require('exceljs')
const JSZip = require('jszip')
const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('../middleware/auth')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const DEFAULT_FIELDS = {
  full_name:  { label: 'Full Name',  enabled: true,  locked: false },
  student_id: { label: 'Student ID', enabled: true,  locked: true  },
  year_level: { label: 'Level',      enabled: true,  locked: false },
  position:   { label: 'Position',   enabled: false, locked: false },
  signature:  { label: 'Signature',  enabled: false, locked: false },
}

const DEFAULT_LAYOUT = {
  photo:      { x:0.1271, y:0.1673, width:0.7458, height:0.3287, type:'image' },
  full_name:  { x:0.5,    y:0.5896, fontSize:0.0678, color:'#1A1A1A', bold:true,  textAlign:'center', type:'text' },
  student_id: { x:0.2441, y:0.6614, fontSize:0.0576, color:'#CC0000', bold:false, textAlign:'left',   type:'text' },
  position:   { x:0.0593, y:0.7231, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'left',   type:'text' },
  year_level: { x:0.0593, y:0.7749, fontSize:0.0508, color:'#1A1A1A', bold:true,  textAlign:'left',   type:'text' },
  signature:  { x:0.5254, y:0.8386, width:0.3898, height:0.0896, type:'image' },
}

// ── PUBLIC reads ──
router.get('/fields', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle()
  res.json(data?.value || DEFAULT_FIELDS)
})

router.get('/layout', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_layout').maybeSingle()
  res.json(data?.value || DEFAULT_LAYOUT)
})

// ── ADMIN writes ──
router.put('/fields', requireAdmin, async (req, res) => {
  const incoming = req.body
  if (incoming.student_id) incoming.student_id.enabled = true
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'card_fields', value: incoming, updated_at: new Date().toISOString() })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data.value)
})

router.put('/layout', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'card_layout', value: req.body, updated_at: new Date().toISOString() })
    .select().single()
  if (error) return res.status(400).json({ error: error.message })
  res.json(data.value)
})

// ── ADMIN downloads ──
router.get('/download-excel', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle()
  const fields = data?.value || DEFAULT_FIELDS

  const columnOrder = ['student_id', 'full_name', 'year_level', 'position']
  const activeCols = columnOrder.filter(k => fields[k]?.enabled !== false)
  const YEAR_OPTIONS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GoldWay LMSA Portal'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 1 }] })
  const COL_META = {
    student_id: { header: 'student_id', width: 20, note: 'Required. Unique. e.g. AMD-2024-0001' },
    full_name:  { header: 'full_name',  width: 28, note: 'Required. Full name as on enrollment form.' },
    year_level: { header: 'year_level', width: 16, note: 'Required. Must match exactly: 1st Year … 6th Year' },
    position:   { header: 'position',  width: 22, note: 'Optional. Institutional role e.g. Class Rep, Secretary.' },
  }

  sheet.columns = activeCols.map(k => ({ header: COL_META[k].header, key: k, width: COL_META[k].width }))
  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } }
    cell.font = { bold: true, color: { argb: 'FFC9A84C' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFC9A84C' } } }
  })
  headerRow.height = 22

  const sample = { student_id: 'AMD-2024-0001', full_name: 'Josephine K. Freeman', year_level: '3rd Year', position: 'Class Representative' }
  const sampleRow = sheet.addRow(activeCols.map(k => sample[k] || ''))
  sampleRow.eachCell(cell => { cell.font = { italic: true, color: { argb: 'FF888780' } } })

  if (activeCols.includes('year_level')) {
    const colIdx = activeCols.indexOf('year_level') + 1
    const colLetter = String.fromCharCode(64 + colIdx)
    sheet.dataValidations.add(`${colLetter}3:${colLetter}1000`, {
      type: 'list', allowBlank: false,
      formulae: [`"${YEAR_OPTIONS.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Invalid value',
      error: 'Please select a year from the dropdown.'
    })
  }

  const instr = workbook.addWorksheet('Instructions')
  instr.columns = [
    { header: 'Field', key: 'field', width: 18 },
    { header: 'Required', key: 'req', width: 12 },
    { header: 'Notes', key: 'notes', width: 60 },
  ]
  const instrHeader = instr.getRow(1)
  instrHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } }
    cell.font = { bold: true, color: { argb: 'FFC9A84C' }, size: 11 }
  })
  instrHeader.height = 22
  activeCols.forEach(k => {
    const meta = COL_META[k]
    instr.addRow({ field: meta.header, req: ['student_id','full_name','year_level'].includes(k) ? 'Yes' : 'No', notes: meta.note })
  })
  instr.addRow({})
  instr.addRow({ field: 'Signature', req: 'No', notes: 'Upload signature PNGs (transparent bg, named by student_id) in the signatures/ folder of your ZIP.' })
  instr.addRow({})
  instr.addRow({ field: 'Instructions', req: '', notes: '1. Fill in data from row 3. Delete the sample row first.' })
  instr.addRow({ field: '', req: '', notes: '2. Save as CSV before uploading to the portal.' })
  instr.addRow({ field: '', req: '', notes: '3. Year Level must exactly match: ' + YEAR_OPTIONS.join(', ') })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Student_Template.xlsx"')
  await workbook.xlsx.write(res)
  res.end()
})

router.get('/download-image-folder', requireAdmin, async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle()
  const fields = data?.value || DEFAULT_FIELDS
  const includeSignatures = fields.signature?.enabled === true

  const zip = new JSZip()
  const root = zip.folder('images').folder('idcard')
  const YEARS = ['year-1','year-2','year-3','year-4','year-5','year-6']
  const YEAR_LABELS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']

  YEARS.forEach((yr, i) => {
    const folder = root.folder(yr)
    folder.file('README.txt',
      `LMSA ID Portal — ${YEAR_LABELS[i]} Photos\n${'─'.repeat(40)}\n\n` +
      `Name each photo after the student ID.\nExamples: AMD-2024-0001.jpg\n\n` +
      `Requirements: JPG or PNG · Passport style · Min 300×375 px\n`
    )
  })

  if (includeSignatures) {
    root.folder('signatures').file('README.txt',
      `LMSA ID Portal — Signatures\n${'─'.repeat(40)}\n\n` +
      `PNG only · Transparent background required · Named by student ID.\nExample: AMD-2024-0001.png\n`
    )
  }

  zip.file('HOW_TO_USE.txt',
    `LMSA ID Portal — Bulk Photo Package\n${'─'.repeat(40)}\n\n` +
    `1. Add photos to the correct year subfolder (named by student ID)\n` +
    (includeSignatures ? `2. Add signature PNGs to signatures/ folder\n3. ` : `2. `) +
    `Compress everything to ZIP and upload alongside your CSV in the portal.\n\nGoldWay · goldway.estone@outlook.com\n`
  )

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="LMSA_Image_Upload_Folder.zip"')
  res.send(buffer)
})

module.exports = router
