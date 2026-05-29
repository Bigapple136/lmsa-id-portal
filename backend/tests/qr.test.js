import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

const OLD_ENV = process.env

beforeAll(() => {
  process.env = {
    ...OLD_ENV,
    SUPABASE_URL: 'https://test-project.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    QR_SIGNING_SECRET: 'test-secret-that-is-long-enough-for-hmac',
  }
})

afterAll(() => {
  process.env = OLD_ENV
})

beforeEach(() => {
  vi.resetModules()
})

describe('QR module', () => {
  it('should sign and verify a student token', () => {
    const { signStudentToken, verifyStudentToken } = require('../routes/qr')
    const studentId = 'STU-2024-001'
    const token = signStudentToken(studentId)
    expect(token).toBeTruthy()
    expect(token).toContain('.')

    const decoded = verifyStudentToken(token)
    expect(decoded).toBe(studentId)
  })

  it('should reject a tampered token', () => {
    const { signStudentToken, verifyStudentToken } = require('../routes/qr')
    const token = signStudentToken('STU-2024-001')
    const [payload] = token.split('.')
    const tampered = `${payload}.invalidsignature`
    expect(verifyStudentToken(tampered)).toBeNull()
  })

  it('should return null for empty token', () => {
    const { verifyStudentToken } = require('../routes/qr')
    expect(verifyStudentToken('')).toBeNull()
    expect(verifyStudentToken(null)).toBeNull()
    expect(verifyStudentToken(undefined)).toBeNull()
  })
})
