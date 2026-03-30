# Generate student_form_template.xlsm with real VBA macros.
# Uses MS-OVBA (Python) to create vbaProject.bin from VBA source.
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vbaProjectCompiler.vbaProject import VbaProject

VBA_CODE = (
    "Attribute VB_Name = \"FormMacros\"\n"
    "' ============================================================\n"
    "' LMSA Portal - Student Form Macros\n"
    "' Paste this entire block into the VBA Editor (Alt+F11)\n"
    "' ============================================================\n"
    "\n"
    "Sub SaveRecord()\n"
    "    Dim wsForm As Worksheet\n"
    "    Dim wsData As Worksheet\n"
    "    Dim lastRow As Long\n"
    "    Dim i As Integer\n"
    "    Dim fields As Variant\n"
    "    Dim msg As String\n"
    "\n"
    "    Set wsForm = ThisWorkbook.Worksheets(\"Sheet1\")\n"
    "    Set wsData = ThisWorkbook.Worksheets(\"Students\")\n"
    "\n"
    "    fields = Array(\"student_id\", \"full_name\", \"year_level\", \"position\", _\n"
    "                   \"programme\", \"blood_type\", \"student_email\", _\n"
    "                   \"emergency_contact_name\", \"emergency_contact_phone\")\n"
    "\n"
    "    ' Check required fields\n"
    "    If Trim(wsForm.Range(\"C4\").Value) = \"\" Then\n"
    "        MsgBox \"Student ID is required!\", vbCritical, \"Missing Field\"\n"
    "        wsForm.Range(\"C4\").Select\n"
    "        Exit Sub\n"
    "    End If\n"
    "    If Trim(wsForm.Range(\"C5\").Value) = \"\" Then\n"
    "        MsgBox \"Full Name is required!\", vbCritical, \"Missing Field\"\n"
    "        wsForm.Range(\"C5\").Select\n"
    "        Exit Sub\n"
    "    End If\n"
    "    If Trim(wsForm.Range(\"C6\").Value) = \"\" Then\n"
    "        MsgBox \"Year Level is required!\", vbCritical, \"Missing Field\"\n"
    "        wsForm.Range(\"C6\").Select\n"
    "        Exit Sub\n"
    "    End If\n"
    "\n"
    "    ' Check for duplicate student_id\n"
    "    Dim sid As String\n"
    "    sid = Trim(wsForm.Range(\"C4\").Value)\n"
    "    Dim r As Long\n"
    "    For r = 2 To wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row\n"
    "        If Trim(wsData.Cells(r, 1).Value) = sid Then\n"
    "            msg = \"Student ID '\" & sid & \"' already exists in the Students sheet!\" & vbCrLf & vbCrLf & _\n"
    "                  \"Row: \" & r & vbCrLf & _\n"
    "                  \"Name: \" & wsData.Cells(r, 2).Value\n"
    "            MsgBox msg, vbExclamation, \"Duplicate Entry\"\n"
    "            Exit Sub\n"
    "        End If\n"
    "    Next r\n"
    "\n"
    "    ' Find next empty row in Students sheet\n"
    "    lastRow = wsData.Cells(wsData.Rows.Count, 1).End(xlUp).Row + 1\n"
    "    If lastRow < 3 Then lastRow = 3\n"
    "\n"
    "    ' Copy form data to Students sheet (Sheet1 rows 4-12 col C -> Students cols 1-9)\n"
    "    Dim formRows As Variant\n"
    "    formRows = Array(4, 5, 6, 7, 8, 9, 10, 11, 12)\n"
    "\n"
    "    For i = 0 To UBound(fields)\n"
    "        wsData.Cells(lastRow, i + 1).Value = Trim(wsForm.Cells(formRows(i), 3).Value)\n"
    "    Next i\n"
    "\n"
    "    MsgBox \"Record saved successfully!\" & vbCrLf & vbCrLf & _\n"
    "           \"Student: \" & wsForm.Range(\"C5\").Value & vbCrLf & _\n"
    "           \"ID: \" & wsForm.Range(\"C4\").Value & vbCrLf & vbCrLf & _\n"
    "           \"Row \" & lastRow & \" in Students sheet.\", _\n"
    "           vbInformation, \"Saved!\"\n"
    "End Sub\n"
    "\n"
    "Sub NewRecord()\n"
    "    Dim wsForm As Worksheet\n"
    "    Dim formRows As Variant\n"
    "    Dim i As Integer\n"
    "\n"
    "    Set wsForm = ThisWorkbook.Worksheets(\"Sheet1\")\n"
    "    formRows = Array(4, 5, 6, 7, 8, 9, 10, 11, 12)\n"
    "\n"
    "    For i = 0 To UBound(formRows)\n"
    "        wsForm.Cells(formRows(i), 3).Value = \"\"\n"
    "    Next i\n"
    "\n"
    "    wsForm.Range(\"C4\").Select\n"
    "End Sub\n"
    "\n"
    "Sub Workbook_Open()\n"
    "    MsgBox \"LMSA Student ID Card Portal\" & vbCrLf & vbCrLf & _\n"
    "           \"Fill in the Student Form sheet, then use:\" & vbCrLf & _\n"
    "           \"  Save Record - to append to Students sheet\" & vbCrLf & _\n"
    "           \"  New Record - to clear the form\", _\n"
    "           vbInformation, \"Welcome to LMSA Portal\"\n"
    "End Sub\n"
)

def write_vba_file(vba_path, code):
    with open(vba_path, 'w') as f:
        f.write(code)

def build_vba_project(vba_path, output_path):
    project = VbaProject()
    project.addModule(vba_path)
    project.write_file()
    import glob, shutil
    bins = glob.glob(os.path.join(os.getcwd(), "vbaProject*.bin"))
    if bins:
        shutil.move(bins[0], output_path)
        print(f"Created: {output_path}")
    else:
        print("ERROR: vbaProject.bin was not created!")
        sys.exit(1)

if __name__ == "__main__":
    import tempfile
    import shutil
    import glob

    # Create temp VBA file
    tmp_dir = tempfile.mkdtemp()
    vba_path = os.path.join(tmp_dir, "FormMacros.bas")
    write_vba_file(vba_path, VBA_CODE)

    # Save to templates/vbaProject.bin
    script_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(script_dir, '..', 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    output_path = os.path.join(templates_dir, 'vbaProject.bin')

    # Run from temp dir so vbaProject.bin is created there
    orig_cwd = os.getcwd()
    os.chdir(tmp_dir)
    try:
        build_vba_project(vba_path, output_path)
    finally:
        os.chdir(orig_cwd)
        shutil.rmtree(tmp_dir)
