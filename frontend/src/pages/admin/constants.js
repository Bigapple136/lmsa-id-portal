// Shared constants for the admin dashboard, extracted from AdminDashboard.jsx
// so the tab components can import them without pulling in the whole page.

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year']
export const LIBERIA_COUNTIES = [
  'Bomi',
  'Bong',
  'Gbarpolu',
  'Grand Bassa',
  'Grand Cape Mount',
  'Grand Gedeh',
  'Grand Kru',
  'Lofa',
  'Margibi',
  'Maryland',
  'Montserrado',
  'Nimba',
  'River Cess',
  'River Gee',
  'Sinoe',
]

export const FIELD_META = {
  student_id: { label: 'Student ID', locked: true },
  full_name: { label: 'Full Name', locked: false },
  year_level: { label: 'Level', locked: false },
  position: { label: 'Position', locked: false },
  signature: { label: 'Signature', locked: false },
}
