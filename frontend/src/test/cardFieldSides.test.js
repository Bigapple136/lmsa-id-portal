import { describe, it, expect } from 'vitest'
import { FRONT_FIELD_ORDER, BACK_FIELD_ORDER } from '../lib/layoutConstants'

// CardCanvas builds its per-side render list by matching fieldSides against
// the side being drawn. This is the rule that makes 'none' work: a field
// assigned to no side matches neither pass, so it is never drawn — while
// remaining in the student record and the QR payload.
const MASTER_FIELD_ORDER = [...new Set([...FRONT_FIELD_ORDER, ...BACK_FIELD_ORDER])]

function fieldsForSide(fieldSides, side) {
  return MASTER_FIELD_ORDER.filter(
    (f) => fieldSides[f] === side || fieldSides[f] === 'both',
  )
}

describe('field sides control what the card renders', () => {
  const sides = {
    photo: 'front',
    full_name: 'front',
    student_id: 'none',
    qr: 'both',
    blood_type: 'back',
  }

  it('omits a none field from the front', () => {
    expect(fieldsForSide(sides, 'front')).not.toContain('student_id')
  })

  it('omits a none field from the back too', () => {
    expect(fieldsForSide(sides, 'back')).not.toContain('student_id')
  })

  it('still renders the sides a field is assigned to', () => {
    expect(fieldsForSide(sides, 'front')).toContain('full_name')
    expect(fieldsForSide(sides, 'back')).toContain('blood_type')
  })

  it('renders a both field on each side', () => {
    expect(fieldsForSide(sides, 'front')).toContain('qr')
    expect(fieldsForSide(sides, 'back')).toContain('qr')
  })

  it('draws nothing at all when every field is switched off', () => {
    const allOff = Object.fromEntries(MASTER_FIELD_ORDER.map((f) => [f, 'none']))
    expect(fieldsForSide(allOff, 'front')).toEqual([])
    expect(fieldsForSide(allOff, 'back')).toEqual([])
  })
})
