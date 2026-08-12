// Single source of truth for calibrated card layout coordinates.
// All values are fractional (0–1) relative to card width/height.
// Pixel-calibrated for LMSA portrait template (590×1004 px).

export const CALIBRATED_LAYOUT_FRONT = {
  photo: { x: 0.1271, y: 0.1673, width: 0.7458, height: 0.3287, type: 'image' },
  full_name: {
    x: 0.5,
    y: 0.5896,
    fontSize: 0.0678,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.88,
  },
  student_id: {
    x: 0.2441,
    y: 0.6614,
    fontSize: 0.0576,
    color: '#CC0000',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  position: {
    x: 0.5,
    y: 0.7231,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.7,
  },
  year_level: {
    x: 0.0593,
    y: 0.7749,
    fontSize: 0.0508,
    color: '#1A1A1A',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.5,
  },
  signature: { x: 0.5254, y: 0.8386, width: 0.3898, height: 0.0896, type: 'image' },
  qr: { x: 0.0593, y: 0.8187, width: 0.2542, height: 0.1394, type: 'image' },
}

export const CALIBRATED_LAYOUT_BACK = {
  qr: { x: 0.1, y: 0.13, width: 0.35, height: 0.3, type: 'image' },
  blood_type: {
    x: 0.5,
    y: 0.15,
    fontSize: 0.05,
    color: '#CC0000',
    bold: true,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  emergency_contact_phone: {
    x: 0.5,
    y: 0.34,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  issue_date: {
    x: 0.5,
    y: 0.58,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
  valid_until: {
    x: 0.5,
    y: 0.66,
    fontSize: 0.04,
    color: '#1A1A1A',
    bold: false,
    textAlign: 'center',
    type: 'text',
    maxWidth: 0.8,
  },
}

export const FRONT_FIELD_ORDER = [
  'photo',
  'full_name',
  'student_id',
  'position',
  'year_level',
  'signature',
]

export const BACK_FIELD_ORDER = [
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

// Fields available for each side (used by LayoutMapper)
export const FRONT_FIELDS = [
  'photo',
  'full_name',
  'student_id',
  'year_level',
  'position',
  'signature',
]

export const BACK_FIELDS = [
  'qr',
  'blood_type',
  'emergency_contact_phone',
  'issue_date',
  'valid_until',
]

// Estimated characters per field, used to auto-fit font size to a detected box
export const EST_CHARS = {
  full_name: 18,
  student_id: 16,
  year_level: 14,
  position: 20,
  programme: 18,
  date_of_birth: 10,
  nationality: 14,
  county_of_origin: 14,
  current_address: 20,
  student_email: 22,
  blood_type: 6,
  emergency_contact_phone: 12,
  issue_date: 10,
  valid_until: 10,
}