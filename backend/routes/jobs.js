const express = require('express')
const router = express.Router()
const { requireAdmin } = require('../middleware/auth')
const { logAdminAction } = require('../auditLog')
const { getJob, getJobFilePath } = require('../jobStore')

// Generic job status / download endpoint for optimistic exports and backups
// GET /api/jobs/:jobId?status=true returns JSON status, otherwise returns file if ready
router.get('/:jobId', requireAdmin, async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' })

  // Backup zips contain the whole database plus every uploaded file: only
  // full admins may see their status or download them, mirroring
  // /api/backup's own guards. Other job types keep this route's base
  // requireAdmin rule.
  if (job.type === 'backup' && req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Insufficient permissions. Full admin required.' })
  }

  if (job.status === 'ready') {
    if (req.query.status === 'true') {
      return res.json({
        status: 'ready',
        jobId: job.id,
        filename: job.filename,
        size: job.size || 0,
        type: job.type,
        mimeType: job.mimeType,
      })
    }
    const filePath = getJobFilePath(job.id)
    if (!filePath) return res.status(500).json({ error: 'Result file is no longer available.' })
    // Same audit trail as downloading straight from /api/backup/:jobId —
    // a full PII export must be traceable whichever endpoint served it.
    if (job.type === 'backup') {
      await logAdminAction(req, 'backup_downloaded', {
        targetType: 'backup',
        targetId: job.id,
        details: { filename: job.filename, bytes: job.size || 0, via: 'jobs' },
      })
    }
    res.setHeader('Content-Type', job.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
    return res.sendFile(filePath)
  }

  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error || 'Job failed', type: job.type })
  }

  res.json({ status: job.status, jobId: job.id, message: `${job.type} still processing...`, type: job.type })
})

module.exports = router
