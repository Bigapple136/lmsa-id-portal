const brevo = require('@getbrevo/brevo')
const apiInstance = new brevo.TransactionalEmailsApi()
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY)

async function sendEmail(to, subject, html) {
  if (!process.env.BREVO_API_KEY) return
  const sendSmtpEmail = { to: [{ email: to }], sender: { email: 'noreply@lmsa-id.org', name: 'LMSA Portal' }, subject, htmlContent: html }
  try { await apiInstance.sendTransacEmail(sendSmtpEmail) } catch (e) { console.error('[Brevo] Email error:', e.message) }
}

module.exports = { sendEmail }
