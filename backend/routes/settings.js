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

const DEFAULT_QR_FIELDS = {
  programme:               { label: 'Programme',               enabled: true  },
  blood_type:               { label: 'Blood Type',              enabled: true  },
  student_email:           { label: 'Student Email',           enabled: false },
  emergency_contact_name:   { label: 'Emergency Contact Name',  enabled: true  },
  emergency_contact_phone:  { label: 'Emergency Contact Phone', enabled: true  },
}

const QR_COLUMN_META = {
  programme:               { header: 'programme',               width: 20, note: 'QR only. e.g. MBBS, Pharm.D', qr: true },
  blood_type:              { header: 'blood_type',              width: 12, note: 'QR only. e.g. O+, AB-', qr: true },
  student_email:          { header: 'student_email',          width: 28, note: 'QR only. Student email address.', qr: true },
  emergency_contact_name:  { header: 'emergency_contact_name', width: 28, note: 'QR only. Full name of emergency contact.', qr: true },
  emergency_contact_phone: { header: 'emergency_contact_phone',width: 22, note: 'QR only. e.g. +231 770 405785', qr: true },
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

router.get('/qr-fields', async (req, res) => {
  const { data } = await supabase.from('portal_settings').select('value').eq('key', 'qr_fields').maybeSingle()
  res.json(data?.value || DEFAULT_QR_FIELDS)
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

router.put('/qr-fields', requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('portal_settings')
    .upsert({ key: 'qr_fields', value: req.body, updated_at: new Date().toISOString() })
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
  const [fieldsData, qrFieldsData] = await Promise.all([
    supabase.from('portal_settings').select('value').eq('key', 'card_fields').maybeSingle(),
    supabase.from('portal_settings').select('value').eq('key', 'qr_fields').maybeSingle(),
  ])
  const fields = fieldsData?.data?.value || DEFAULT_FIELDS
  const qrFields = qrFieldsData?.data?.value || DEFAULT_QR_FIELDS

  const cardColumnOrder = ['student_id', 'full_name', 'year_level', 'position']
  const activeCols = [
    ...cardColumnOrder.filter(k => fields[k]?.enabled !== false),
    ...Object.keys(DEFAULT_QR_FIELDS).filter(k => qrFields[k]?.enabled !== false),
  ]
  const YEAR_OPTIONS = ['1st Year','2nd Year','3rd Year','4th Year','5th Year','6th Year']
  const BLOOD_OPTIONS = ['A+','A-','B+','B-','AB+','AB-','O+','O-']

  const COL_META = {
    student_id:             { header: 'student_id',             width: 20, note: 'Required. Unique. e.g. AMD-2024-0001', qr: false },
    full_name:              { header: 'full_name',              width: 28, note: 'Required. Full name as on enrollment form.', qr: false },
    year_level:             { header: 'year_level',             width: 16, note: 'Required. Must match exactly: 1st Year … 6th Year', qr: false },
    position:               { header: 'position',               width: 22, note: 'Optional. Institutional role e.g. Class Rep, Secretary.', qr: false },
    programme:              { header: 'programme',              width: 20, note: 'QR only. e.g. MBBS, Pharm.D', qr: true },
    blood_type:             { header: 'blood_type',             width: 12, note: 'QR only. e.g. O+, AB-', qr: true },
    student_email:          { header: 'student_email',          width: 28, note: 'QR only. Student email address.', qr: true },
    emergency_contact_name: { header: 'emergency_contact_name', width: 28, note: 'QR only. Full name of emergency contact.', qr: true },
    emergency_contact_phone:{ header: 'emergency_contact_phone',width: 22, note: 'QR only. e.g. +231 770 405785', qr: true },
  }

  const FORM_META = {
    student_id:             { label: '* Student ID',             note: 'Required. Unique. Format: AMD-2024-0001' },
    full_name:              { label: '* Full Name',              note: 'Required. As it appears on your enrollment form.' },
    year_level:             { label: '* Year Level',             note: 'Required. Select from the dropdown.' },
    position:               { label: 'Position',               note: 'Optional. e.g. Class Representative, Secretary.' },
    programme:              { label: 'Programme',              note: 'QR code only. e.g. MBBS, Pharm.D' },
    blood_type:             { label: 'Blood Type',             note: 'QR code only. Select from the dropdown.' },
    student_email:          { label: 'Student Email',          note: 'QR code only. Email address.' },
    emergency_contact_name: { label: 'Emergency Contact Name', note: 'QR code only. Full name of emergency contact.' },
    emergency_contact_phone:{ label: 'Emergency Contact Phone',note: 'QR code only. e.g. +231 770 000000' },
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'GoldWay LMSA Portal'
  workbook.created = new Date()

  // ─── SHEET 1: Student Form ───────────────────────────────────────────────
  const formSheet = workbook.addWorksheet('\uD83D\uDCCB Student Form')

  formSheet.sheetProtection = { sheet: true, selectLockedCells: false, selectUnlockedCells: false }

  // Column widths
  formSheet.getColumn(1).width = 32
  formSheet.getColumn(2).width = 28
  formSheet.getColumn(3).width = 50

  // Row 1: Portal title header
  formSheet.mergeCells('A1:C1')
  const titleCell = formSheet.getCell('A1')
  titleCell.value = 'LMSA Student ID Card Portal'
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } }
  titleCell.font = { bold: true, size: 14, color: { argb: 'FFC9A84C' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  formSheet.getRow(1).height = 32

  // Row 2: Form subtitle
  formSheet.mergeCells('A2:C2')
  const subCell = formSheet.getCell('A2')
  subCell.value = 'Single Student Entry Form'
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A1A' } }
  subCell.font = { bold: false, size: 11, color: { argb: 'FFFFFFFF' } }
  subCell.alignment = { horizontal: 'center', vertical: 'middle' }
  formSheet.getRow(2).height = 22

  // Row 3: Spacer
  formSheet.getRow(3).height = 8

  // Rows 4-12: Field rows
  const formRowStart = 4
  activeCols.forEach((key, i) => {
    const meta = FORM_META[key]
    const rowNum = formRowStart + i
    const row = formSheet.getRow(rowNum)
    row.height = 22

    // Label cell (A)
    const labelCell = row.getCell(1)
    labelCell.value = meta.label
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    labelCell.font = { bold: true, size: 11, color: { argb: 'FFC9A84C' } }
    labelCell.alignment = { horizontal: 'left', vertical: 'middle' }
    labelCell.border = {
      left: { style: 'medium', color: { argb: 'FFD1D5DB' } },
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }

    // Input cell (B)
    const inputCell = row.getCell(2)
    inputCell.value = ''
    inputCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    inputCell.font = { size: 11 }
    inputCell.alignment = { horizontal: 'left', vertical: 'middle' }
    inputCell.border = { style: 'medium', color: { argb: 'FF0D1B2A' } }

    // Add dropdown validation for year_level and blood_type
    if (key === 'year_level') {
      formSheet.dataValidations.add(`B${rowNum}:B${rowNum}`, {
        type: 'list', allowBlank: true,
        formulae: [`"${YEAR_OPTIONS.join(',')}"`],
        showErrorMessage: true, errorTitle: 'Invalid value',
        error: 'Please select a year from the dropdown.'
      })
    }
    if (key === 'blood_type') {
      formSheet.dataValidations.add(`B${rowNum}:B${rowNum}`, {
        type: 'list', allowBlank: true,
        formulae: [`"${BLOOD_OPTIONS.join(',')}"`],
        showErrorMessage: true, errorTitle: 'Invalid value',
        error: 'Please select a blood type from the dropdown.'
      })
    }

    // Note cell (C)
    const noteCell = row.getCell(3)
    noteCell.value = meta.note
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
    noteCell.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    noteCell.alignment = { horizontal: 'left', vertical: 'middle' }
    noteCell.border = {
      right: { style: 'medium', color: { argb: 'FFD1D5DB' } },
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    }
  })

  // Spacer row after fields
  const spacerRow = formRowStart + activeCols.length
  formSheet.getRow(spacerRow).height = 12

  // Instructions footer
  const instrRow = spacerRow + 1
  formSheet.mergeCells(`A${instrRow}:C${instrRow}`)
  const instrCell = formSheet.getCell(`A${instrRow}`)
  instrCell.value = '\u2192 After completing this form, transfer the data to the Students sheet. Delete the sample row first, then paste your values.'
  instrCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } }
  instrCell.font = { italic: true, size: 10, color: { argb: 'FF92400E' } }
  instrCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  instrCell.border = { style: 'thin', color: { argb: 'FFFFC107' } }
  formSheet.getRow(instrRow).height = 28

  // ─── SHEET 2: Students ───────────────────────────────────────────────────
  const sheet = workbook.addWorksheet('Students', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.sheetProtection = { sheet: true, selectLockedCells: false, selectUnlockedCells: true }

  sheet.columns = activeCols.map(k => ({ header: COL_META[k].header, key: k, width: COL_META[k].width }))

  // Header row — locked
  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell, colNum) => {
    const key = activeCols[colNum - 1]
    const isQR = COL_META[key]?.qr
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isQR ? 'FF1A3A1A' : 'FF0D1B2A' } }
    cell.font = { bold: true, color: { argb: isQR ? 'FF88CC88' : 'FFC9A84C' }, size: 11 }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: isQR ? 'FF88CC88' : 'FFC9A84C' } } }
    cell.protection = { locked: true }
  })
  headerRow.height = 22

  // Sample row — locked
  const sample = {
    student_id: 'AMD-2024-0001', full_name: 'Josephine K. Freeman',
    year_level: '3rd Year', position: 'Class Representative',
    programme: 'MBBS', blood_type: 'O+',
    student_email: 'josephine@email.com',
    emergency_contact_name: 'Mary Freeman',
    emergency_contact_phone: '+231 770 000000'
  }
  const sampleRow = sheet.addRow(activeCols.map(k => sample[k] || ''))
  sampleRow.eachCell(cell => {
    cell.font = { italic: true, color: { argb: 'FF888780' } }
    cell.protection = { locked: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
  })

  // Add blank data rows (rows 3-20) with alternating colors
  for (let r = 3; r <= 20; r++) {
    const dataRow = sheet.getRow(r)
    const isEven = r % 2 === 0
    dataRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF9FAFB' : 'FFFFFFFF' } }
    })
  }

  // Year level dropdown for data rows
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

  // ─── SHEET 3: Instructions ────────────────────────────────────────────────
  const instr = workbook.addWorksheet('Instructions')
  instr.columns = [
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Required', key: 'req', width: 12 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Notes', key: 'notes', width: 55 },
  ]
  const instrHeader = instr.getRow(1)
  instrHeader.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } }
    cell.font = { bold: true, color: { argb: 'FFC9A84C' }, size: 11 }
  })
  instrHeader.height = 22
  activeCols.forEach(k => {
    const meta = COL_META[k]
    instr.addRow({
      field: meta.header,
      req: ['student_id','full_name','year_level'].includes(k) ? 'Yes' : 'No',
      type: meta.qr ? 'QR code only' : 'Card face',
      notes: meta.note
    })
  })
  instr.addRow({})
  instr.addRow({ field: 'signature', req: 'No', type: 'Card face', notes: 'Upload signature PNGs (transparent bg, named by student_id) in the signatures/ folder of your ZIP.' })
  instr.addRow({})
  instr.addRow({ field: 'NOTES', req: '', type: '', notes: 'Green-header columns are encoded in the QR code only — they do not appear on the printed card face.' })
  instr.addRow({ field: '', req: '', type: '', notes: '1. Use the \uD83D\uDCCB Student Form sheet to enter data for a single student.' })
  instr.addRow({ field: '', req: '', type: '', notes: '2. Transfer completed data to the Students sheet. Delete the sample row first.' })
  instr.addRow({ field: '', req: '', type: '', notes: '3. Save as CSV before uploading to the portal.' })
  instr.addRow({ field: '', req: '', type: '', notes: '4. Year Level must exactly match: ' + YEAR_OPTIONS.join(', ') })

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

async function getQRFields() {
  const { data } = await supabase.from('portal_settings')
    .select('value').eq('key', 'qr_fields').maybeSingle()
  return data?.value || DEFAULT_QR_FIELDS
}

module.exports = router
module.exports.getQRFields = getQRFields
