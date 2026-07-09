const XLSX = require('xlsx')
const JSZip = require('jszip')
const fs = require('fs')
const path = require('path')

async function generateTemplate() {
  const tmpDir = path.join(__dirname, '..', 'templates')
  fs.mkdirSync(tmpDir, { recursive: true })

  const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
  const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

  const ALL_COLS = [
    'student_id',
    'full_name',
    'year_level',
    'position',
    'programme',
    'blood_type',
    'student_email',
    'emergency_contact_name',
    'emergency_contact_phone',
  ]
  const COL_META = {
    student_id: { w: 22, note: 'Required. Unique. Format: AMD-2024-0001' },
    full_name: { w: 28, note: 'Required. As on enrollment form.' },
    year_level: { w: 16, note: 'Required. Select from dropdown.' },
    position: { w: 22, note: 'Optional. e.g. Class Representative.' },
    programme: { w: 20, note: 'QR code only. e.g. MBBS, Pharm.D' },
    blood_type: { w: 12, note: 'QR code only. Select from dropdown.' },
    student_email: { w: 28, note: 'QR code only. Email address.' },
    emergency_contact_name: { w: 28, note: 'QR code only. Full name.' },
    emergency_contact_phone: { w: 22, note: 'QR code only. e.g. +231 770 000000' },
  }
  const LABELS = {
    student_id: '* Student ID',
    full_name: '* Full Name',
    year_level: '* Year Level',
    position: 'Position',
    programme: 'Programme',
    blood_type: 'Blood Type',
    student_email: 'Student Email',
    emergency_contact_name: 'Emergency Contact Name',
    emergency_contact_phone: 'Emergency Contact Phone',
  }

  const workbook = XLSX.utils.book_new()

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 1: Student Form — centered layout
  // ════════════════════════════════════════════════════════════════════════════
  const FORM_ROWS = []

  // Row 0: title (merged across A-E via !merges)
  FORM_ROWS.push([{ t: 's', v: 'LMSA Student ID Card Portal' }, null, null, null, null])

  // Row 1: subtitle (merged across A-E)
  FORM_ROWS.push([
    {
      t: 's',
      v: 'Single Student Entry Form  \u2192  Fill in below, then use the Developer tab to add buttons.',
    },
    null,
    null,
    null,
    null,
  ])

  // Row 2: spacer
  FORM_ROWS.push([null, null, null, null, null])

  // Rows 3–11: field rows — [spacer, label, input, note, spacer]
  ALL_COLS.forEach((key) => {
    FORM_ROWS.push([
      null, // A — left spacer
      { t: 's', v: LABELS[key] }, // B — label
      { t: 's', v: '' }, // C — input
      { t: 's', v: COL_META[key].note }, // D — note
      null, // E — right spacer
    ])
  })

  // Row 12: spacer
  FORM_ROWS.push([null, null, null, null, null])

  // Row 13: button row — Save Record (B) | New Record (C)
  FORM_ROWS.push([null, { t: 's', v: 'Save Record' }, { t: 's', v: 'New Record' }, null, null])

  // Row 14: note row (merged across B-D)
  FORM_ROWS.push([
    {
      t: 's',
      v: '\u26A0  Macros must be enabled. Enable Developer tab > Visual Basic > paste VBA code. See Instructions sheet.',
    },
    null,
    null,
    null,
    null,
  ])

  const formWs = XLSX.utils.aoa_to_sheet(FORM_ROWS)

  // Column widths: [spacer=3, label=32, input=30, note=52, spacer=3]
  formWs['!cols'] = [
    { wch: 3 }, // A — left spacer
    { wch: 32 }, // B — label
    { wch: 30 }, // C — input
    { wch: 52 }, // D — note
    { wch: 3 }, // E — right spacer
  ]

  // Merge title row across A–E
  formWs['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // Row 1: title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }, // Row 2: subtitle
    { s: { r: 14, c: 1 }, e: { r: 14, c: 3 } }, // Row 15: note row (merged B15:D15)
  ]

  // Row heights
  formWs['!rows'] = [
    { hpt: 36 }, // title
    { hpt: 24 }, // subtitle
    { hpt: 8 }, // spacer
    { hpt: 22 }, // field rows (all)
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 12 }, // spacer
    { hpt: 32 }, // button row
    { hpt: 24 }, // note row
  ]

  XLSX.utils.book_append_sheet(workbook, formWs, 'Sheet1')

  // Apply styles to form sheet cells (via XLSX.utils.sheet_add_aoa doesn't support styles)
  // Use the sheet object directly to set cell properties

  // Style title row (A1)
  const titleCell = formWs['A1']
  if (titleCell) {
    titleCell.s = {
      bold: true,
      fontSize: 14,
      fontColor: { rgb: 'C9A84C' },
      fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }
  }

  // Style subtitle row (A2)
  const subCell = formWs['A2']
  if (subCell) {
    subCell.s = {
      fontSize: 11,
      fontColor: { rgb: 'FFFFFF' },
      fill: { patternType: 'solid', fgColor: { rgb: '1A3A1A' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }
  }

  // Style field rows (rows 4-12 in Excel = row indices 3-11)
  ALL_COLS.forEach((key, i) => {
    const excelRow = 4 + i // Excel row numbers start at 1

    const labelCell = formWs[`B${excelRow}`]
    if (labelCell) {
      labelCell.s = {
        bold: true,
        fontSize: 11,
        fontColor: { rgb: 'C9A84C' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
          left: { style: 'thin', color: { rgb: 'D1D5DB' } },
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
      }
    }

    const inputCell = formWs[`C${excelRow}`]
    if (inputCell) {
      inputCell.s = {
        fontSize: 11,
        fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
          left: { style: 'medium', color: { rgb: '0D1B2A' } },
          right: { style: 'medium', color: { rgb: '0D1B2A' } },
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
      }
    }

    const noteCell = formWs[`D${excelRow}`]
    if (noteCell) {
      noteCell.s = {
        italic: true,
        fontSize: 10,
        fontColor: { rgb: '6B7280' },
        fill: { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: {
          right: { style: 'thin', color: { rgb: 'D1D5DB' } },
          top: { style: 'thin', color: { rgb: 'D1D5DB' } },
          bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        },
      }
    }
  })

  // Style button row (row 14)
  const saveCell = formWs['B14']
  if (saveCell) {
    saveCell.s = {
      bold: true,
      fontSize: 12,
      fontColor: { rgb: 'FFFFFF' },
      fill: { patternType: 'solid', fgColor: { rgb: '00653C' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
    }
  }
  const newCell = formWs['C14']
  if (newCell) {
    newCell.s = {
      bold: true,
      fontSize: 12,
      fontColor: { rgb: '00653C' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { style: 'medium', color: { rgb: '00653C' } },
    }
  }

  // Style note row (row 15)
  const noteCell2 = formWs['A15']
  if (noteCell2) {
    noteCell2.s = {
      fontSize: 9,
      fontColor: { rgb: '92400E' },
      fill: { patternType: 'solid', fgColor: { rgb: 'FFF8E1' } },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 2: Students
  // ════════════════════════════════════════════════════════════════════════════
  const studentsData = [
    ALL_COLS,
    [
      'AMD-2024-0001',
      'Josephine K. Freeman',
      '3rd Year',
      'Class Representative',
      'MBBS',
      'O+',
      'josephine@email.com',
      'Mary Freeman',
      '+231 770 000000',
    ],
    ...Array.from({ length: 18 }, () => Array(ALL_COLS.length).fill('')),
  ]

  const studentsWs = XLSX.utils.aoa_to_sheet(studentsData)

  // Column widths
  studentsWs['!cols'] = ALL_COLS.map((k) => ({ wch: COL_META[k].w }))

  // Header row styles
  const QR_KEYS = [
    'programme',
    'blood_type',
    'student_email',
    'emergency_contact_name',
    'emergency_contact_phone',
  ]
  ALL_COLS.forEach((key, i) => {
    const cell = studentsWs[XLSX.utils.encode_cell({ r: 0, c: i })]
    const isQR = QR_KEYS.includes(key)
    cell.s = {
      bold: true,
      fontColor: { rgb: isQR ? '88CC88' : 'C9A84C' },
      fill: { patternType: 'solid', fgColor: { rgb: isQR ? '1A3A1A' : '0D1B2A' } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    }
  })

  // Sample row (row 2) styles
  const sample = studentsData[1]
  sample.forEach((_, i) => {
    const cell = studentsWs[XLSX.utils.encode_cell({ r: 1, c: i })]
    cell.s = {
      italic: true,
      fontColor: { rgb: '888780' },
      fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
    }
  })

  // Alternating data rows (rows 3–20)
  for (let r = 2; r < 20; r++) {
    const isEven = r % 2 === 0
    ALL_COLS.forEach((_, i) => {
      const cell = studentsWs[XLSX.utils.encode_cell({ r, c: i })]
      cell.s = {
        fill: { patternType: 'solid', fgColor: { rgb: isEven ? 'F9FAFB' : 'FFFFFF' } },
      }
    })
  }

  studentsWs['!rows'] = [
    { hpt: 22 }, // header
    { hpt: 20 }, // sample
    ...Array.from({ length: 18 }, () => ({ hpt: 18 })), // data rows
  ]

  // Add year level dropdown
  const yearColIdx = ALL_COLS.indexOf('year_level')
  if (yearColIdx >= 0) {
    studentsWs['!dataValidation'] = studentsWs['!dataValidation'] || []
    studentsWs['!dataValidation'].push({
      sqref: `C3:C1000`,
      type: 'list',
      allowBlank: true,
      showInputMessage: true,
      promptTitle: 'Year Level',
      prompt: 'Select from the dropdown.',
      formulae: [`"${YEAR_OPTIONS.join(',')}"`],
    })
  }

  XLSX.utils.book_append_sheet(workbook, studentsWs, 'Students')

  // ════════════════════════════════════════════════════════════════════════════
  // SHEET 3: Instructions
  // ════════════════════════════════════════════════════════════════════════════
  const VBA_CODE = `' ============================================================'
' LMSA Portal - Student Form Macros
' Copy everything between the === lines into the VBA Editor
' ============================================================'

Sub SaveRecord()
    Dim wsForm As Worksheet, wsData As Worksheet
    Dim lastRow As Long, i As Integer
    Dim sid As String, r As Long

    Set wsForm = ThisWorkbook.Worksheets("Sheet1")
    Set wsData = ThisWorkbook.Worksheets("Students")

    If Trim(wsForm.Range("C4").Value) = "" Then
        MsgBox "Student ID is required!", vbCritical, "Missing Field"
        wsForm.Range("C4").Select
        Exit Sub
    End If
    If Trim(wsForm.Range("C5").Value) = "" Then
        MsgBox "Full Name is required!", vbCritical, "Missing Field"
        wsForm.Range("C5").Select
        Exit Sub
    End If
    If Trim(wsForm.Range("C6").Value) = "" Then
        MsgBox "Year Level is required!", vbCritical, "Missing Field"
        wsForm.Range("C6").Select
        Exit Sub
    End If

    sid = Trim(wsForm.Range("C4").Value)
    For r = 2 To wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row
        If Trim(wsData.Cells(r, 1).Value) = sid Then
            MsgBox "Student ID '" & sid & "' already exists in the Students sheet!", vbExclamation, "Duplicate Entry"
            Exit Sub
        End If
    Next r

    lastRow = wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row + 1
    If lastRow < 3 Then lastRow = 3

    Dim formRows: formRows = Array(4, 5, 6, 7, 8, 9, 10, 11, 12)
    For i = 0 To 8
        wsData.Cells(lastRow, i + 1).Value = Trim(wsForm.Cells(formRows(i), 3).Value)
    Next i

    MsgBox "Record saved!" & vbCrLf & vbCrLf & _
           "Student: " & wsForm.Range("C5").Value & vbCrLf & _
           "ID: " & wsForm.Range("C4").Value & vbCrLf & vbCrLf & _
           "Row " & lastRow & " in Students sheet.", _
           vbInformation, "Saved!"
End Sub

Sub NewRecord()
    Dim wsForm As Worksheet, i As Integer
    Set wsForm = ThisWorkbook.Worksheets("Sheet1")
    Dim formRows: formRows = Array(4, 5, 6, 7, 8, 9, 10, 11, 12)
    For i = 0 To 8
        wsForm.Cells(formRows(i), 3).Value = ""
    Next i
    wsForm.Range("C4").Select
End Sub`

  const instrData = [
    ['LMSA Student ID Card Portal — Setup Guide', '', '', ''],
    ['', '', '', ''],
    ['SECTION 1: HOW TO SET UP THE MACROS', '', '', ''],
    ['', '', '', ''],
    [
      'Step 1',
      'Enable the Developer Tab',
      '',
      'File > Options > Customize Ribbon > check "Developer" in the right panel > OK',
    ],
    ['Step 2', 'Open the VBA Editor', '', 'Press Alt+F11 (or Developer tab > Visual Basic)'],
    [
      'Step 3',
      'Insert a New Module',
      '',
      'In the VBA Editor: Insert > Module. A new code window opens.',
    ],
    [
      'Step 4',
      'Paste the VBA Code',
      '',
      'Select ALL the VBA code from the "VBA SOURCE CODE" section below this table,' +
        '\n' +
        'copy it, paste it into the module window, then close the VBA Editor.',
    ],
    [
      'Step 5',
      'Add the Buttons (optional but recommended)',
      '',
      'Sheet1 > Developer tab > Insert > Button (Form Control).' +
        '\n' +
        'Draw a button on the form, assign "SaveRecord" macro to one and "NewRecord" to the other.' +
        '\n' +
        'Tip: right-click each button to edit its text label.',
    ],
    [
      'Step 6',
      'Save as Macro-Enabled',
      '',
      'File > Save As > Browse > Save as type: Excel Macro-Enabled Workbook (*.xlsm)',
    ],
    ['', '', '', ''],
    ['SECTION 2: HOW TO USE THE FORM', '', '', ''],
    ['', '', '', ''],
    ['1', 'Go to the Student Form sheet', '', 'Sheet1 is the entry form.'],
    [
      '2',
      'Fill in the required fields',
      '',
      'Fields marked with * are required (Student ID, Full Name, Year Level).',
    ],
    ['3', 'Click "Save Record"', '', 'This appends your entry to the Students sheet.'],
    ['4', 'Click "New Record"', '', 'This clears the form so you can enter the next student.'],
    ['5', 'Year Level must match exactly', '', YEAR_OPTIONS.join(', ')],
    ['', '', '', ''],
    ['SECTION 3: COLUMN REFERENCE', '', '', ''],
    ['Column', 'Required', 'Type', 'Notes'],
    ...ALL_COLS.map((k) => [
      k,
      ['student_id', 'full_name', 'year_level'].includes(k) ? 'Yes' : 'No',
      QR_KEYS.includes(k) ? 'QR code only' : 'Card face',
      COL_META[k].note,
    ]),
    ['', '', '', ''],
    ['SECTION 4: VBA SOURCE CODE', '', '', ''],
    [
      'Copy everything from the next row down to the last row and paste into the VBA module:',
      '',
      '',
      '',
    ],
    [VBA_CODE, '', '', ''],
    ['', '', '', ''],
    ['SECTION 5: COLUMN REFERENCE', '', '', ''],
    [
      'Green-header columns in the Students sheet are encoded in the QR code only — they do not appear on the printed card face.',
      '',
      '',
      '',
    ],
  ]

  const instrWs = XLSX.utils.aoa_to_sheet(instrData)
  instrWs['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 20 }, { wch: 90 }]
  instrWs['!rows'] = instrData.map((_, i) => {
    if (i === 0) return { hpt: 30 }
    if (
      [
        'SECTION 1: HOW TO SET UP THE MACROS',
        'SECTION 2: HOW TO USE THE FORM',
        'SECTION 3: COLUMN REFERENCE',
        'SECTION 4: VBA SOURCE CODE',
        'SECTION 5: COLUMN REFERENCE',
      ].includes(instrData[i][0])
    )
      return { hpt: 22 }
    if (instrData[i][0] === 'VBA SOURCE CODE') return null
    if (instrData[i][0] === '') return { hpt: 8 }
    return { hpt: 18 }
  })

  // Style section headers
  const SECTION_ROWS = new Set([0, 2, 12, 20, 26, 30])
  instrData.forEach((row, r) => {
    row.forEach((_, c) => {
      const cell = instrWs[XLSX.utils.encode_cell({ r, c })]
      if (!cell || !cell.v) return
      const isSection = SECTION_ROWS.has(r)
      const isColRef = r === 21
      if (isSection) {
        cell.s = {
          bold: true,
          fontSize: 12,
          fontColor: { rgb: 'FFFFFF' },
          fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
        }
      } else if (isColRef) {
        cell.s = {
          bold: true,
          fontColor: { rgb: 'C9A84C' },
          fill: { patternType: 'solid', fgColor: { rgb: '0D1B2A' } },
        }
      }
    })
  })

  XLSX.utils.book_append_sheet(workbook, instrWs, 'Instructions')

  // Write XLSX (not XLSM — no real VBA binary, just embedded source code in Instructions)
  const outputPath = path.join(tmpDir, 'student_form_template.xlsx')

  const buf = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })
  const zip = await JSZip.loadAsync(buf)

  const sheet1Xml = await zip.file('xl/worksheets/sheet1.xml').async('string')
  const dvXml = `<dataValidations count="2"><dataValidation sqref="C6" type="list" allowBlank="1" showInputMessage="1" promptTitle="Year Level" prompt="Select from the dropdown."><formula1>"${YEAR_OPTIONS.join(',')}"</formula1></dataValidation><dataValidation sqref="C9" type="list" allowBlank="1" showInputMessage="1" promptTitle="Blood Type" prompt="Select from the dropdown."><formula1>"${BLOOD_OPTIONS.join(',')}"</formula1></dataValidation></dataValidations>`
  const updatedXml = sheet1Xml.replace('</worksheet>', dvXml + '</worksheet>')
  zip.file('xl/worksheets/sheet1.xml', updatedXml)

  const ctXml = await zip.file('[Content_Types].xml').async('string')
  zip.file('[Content_Types].xml', ctXml.replace(/<Default Extension="bin"[^>]*\/>/g, ''))

  const wbXml = await zip.file('xl/workbook.xml').async('string')
  zip.file('xl/workbook.xml', wbXml.replace(' codeName="ThisWorkbook"', ''))

  const outBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.writeFileSync(outputPath, outBuf)

  console.log('Generated:', outputPath)
  return outputPath
}

generateTemplate()
  .then((p) => console.log('Done:', p))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
