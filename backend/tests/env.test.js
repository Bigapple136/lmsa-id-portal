import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const OLD_ENV = process.env

beforeAll(() => {
  process.env = { ...OLD_ENV }
})

afterAll(() => {
  process.env = OLD_ENV
})

describe('validateEnv', () => {
  it('should exit when SUPABASE_URL is missing', () => {
    delete process.env.SUPABASE_URL
    process.env.SUPABASE_SERVICE_KEY = 'real-key'
    process.env.QR_SIGNING_SECRET = 'a'.repeat(32)
    process.env.FRONTEND_URL = 'https://example.com'
    process.env.BACKEND_URL = 'https://api.example.com'

    const exitStub = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const { validateEnv } = require('../env')
    validateEnv()
    expect(exitStub).toHaveBeenCalledWith(1)
    exitStub.mockRestore()
  })

  it('should exit when QR_SIGNING_SECRET is too short', () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'real-key'
    process.env.QR_SIGNING_SECRET = 'short'
    process.env.FRONTEND_URL = 'https://example.com'
    process.env.BACKEND_URL = 'https://api.example.com'

    const exitStub = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const { validateEnv } = require('../env')
    validateEnv()
    expect(exitStub).toHaveBeenCalledWith(1)
    exitStub.mockRestore()
  })

  it('should pass when all env vars are set correctly', () => {
    process.env.SUPABASE_URL = 'https://project.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'real-service-key'
    process.env.QR_SIGNING_SECRET = 'a'.repeat(32)
    process.env.FRONTEND_URL = 'https://example.com'
    process.env.BACKEND_URL = 'https://api.example.com'

    const exitStub = vi.spyOn(process, 'exit').mockImplementation(() => {})
    const { validateEnv } = require('../env')
    validateEnv()
    expect(exitStub).not.toHaveBeenCalled()
    exitStub.mockRestore()
  })
})
