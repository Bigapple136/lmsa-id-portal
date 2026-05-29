const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'QR_SIGNING_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
]

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key].startsWith('your-'))
  if (missing.length > 0) {
    console.error(
      `[FATAL] Missing or placeholder environment variables:\n  ${missing.join('\n  ')}\n` +
        'Set them in your .env file or environment before starting.',
    )
    process.exit(1)
  }

  if (process.env.QR_SIGNING_SECRET && process.env.QR_SIGNING_SECRET.length < 32) {
    console.error('[FATAL] QR_SIGNING_SECRET must be at least 32 characters long.')
    process.exit(1)
  }
}

module.exports = { validateEnv }
