const express = require('express')
const router = express.Router()
const { requireAdmin } = require('../middleware/auth')
const { getJob } = require('../jobStore')

// Generic job status / download endpoint for optimistic exports and backups
// GET /api/jobs/:jobId?status=true returns JSON status, otherwise returns file if ready
router.get('/:jobId', requireAdmin, async (req, res) => {
  const job = getJob(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found or expired.' })

  if (job.status === 'ready' && job.buffer) {
    if (req.query.status === 'true') {
      return res.json({
        status: 'ready',
        jobId: job.id,
        filename: job.filename,
        size: job.buffer.length,
        type: job.type,
        mimeType: job.mimeType,
      })
    }
    res.setHeader('Content-Type', job.mimeType || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`)
    return res.send(job.buffer)
  }

  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error || 'Job failed', type: job.type })
  }

  res.json({ status: job.status, jobId: job.id, message: `${job.type} still processing...`, type: job.type })
})

module.exports = router
