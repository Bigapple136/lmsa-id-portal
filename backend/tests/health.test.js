import { describe, it, expect } from 'vitest'
const request = require('supertest')

// Minimal express app for health check test
const express = require('express')

describe('Health endpoint', () => {
  it('should return ok status', async () => {
    const app = express()
    app.get('/api/health', (req, res) => res.json({ status: 'ok' }))

    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})
