import { describe, it, expect } from 'vitest'
const {
  email,
  maxLength,
  firstError,
  uuid,
  enumValue,
  checkFieldSidesConfig,
  FIELD_SIDE_VALUES,
} = require('../middleware/validate')

describe('validate middleware', () => {
  describe('email', () => {
    it('returns null for valid emails', () => {
      expect(email('test@example.com')).toBeNull()
      expect(email('user+tag@domain.co')).toBeNull()
    })
    it('returns error for invalid emails', () => {
      expect(email('not-an-email')).toBeTruthy()
      expect(email('@domain.com')).toBeTruthy()
    })
    it('returns null for empty string, undefined, null', () => {
      expect(email('')).toBeNull()
      expect(email(undefined)).toBeNull()
      expect(email(null)).toBeNull()
    })
  })

  describe('maxLength', () => {
    it('returns null when under limit', () => {
      expect(maxLength('short', 100, 'field')).toBeNull()
    })
    it('returns error when over limit', () => {
      expect(maxLength('a'.repeat(101), 100, 'field')).toBeTruthy()
    })
    it('returns null for undefined', () => {
      expect(maxLength(undefined, 100, 'field')).toBeNull()
    })
  })

  describe('firstError', () => {
    it('returns first error from arguments', () => {
      expect(firstError(null, 'error1', 'error2')).toBe('error1')
    })
    it('returns null if all null', () => {
      expect(firstError(null, null)).toBeNull()
    })
    it('returns null for no arguments', () => {
      expect(firstError()).toBeNull()
    })
  })

  describe('uuid', () => {
    it('returns null for valid UUID', () => {
      expect(uuid('550e8400-e29b-41d4-a716-446655440000')).toBeNull()
    })
    it('returns error for invalid UUID', () => {
      expect(uuid('not-a-uuid')).toBeTruthy()
    })
  })

  describe('enumValue', () => {
    it('returns null for valid enum value', () => {
      expect(enumValue('admin', ['admin', 'support_admin'], 'role')).toBeNull()
    })
    it('returns error for invalid enum value', () => {
      expect(enumValue('superadmin', ['admin', 'support_admin'], 'role')).toBeTruthy()
    })
  })

  describe('checkFieldSidesConfig', () => {
    it('accepts every supported side, including none', () => {
      expect(FIELD_SIDE_VALUES).toEqual(['front', 'back', 'both', 'none'])
      expect(
        checkFieldSidesConfig({
          photo: 'front',
          blood_type: 'back',
          qr: 'both',
          position: 'none',
        }),
      ).toBeNull()
    })

    it('accepts an empty object', () => {
      expect(checkFieldSidesConfig({})).toBeNull()
    })

    it('rejects an unknown side', () => {
      expect(checkFieldSidesConfig({ photo: 'middle' })).toMatch(/must be one of/)
      expect(checkFieldSidesConfig({ photo: 'hidden' })).toMatch(/must be one of/)
    })

    it('rejects a non-string side', () => {
      expect(checkFieldSidesConfig({ photo: false })).toBeTruthy()
      expect(checkFieldSidesConfig({ photo: null })).toBeTruthy()
    })

    it('rejects a non-object payload', () => {
      expect(checkFieldSidesConfig(null)).toBeTruthy()
      expect(checkFieldSidesConfig('front')).toBeTruthy()
    })
  })
})
