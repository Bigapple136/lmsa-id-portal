import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QrViewPage from '../pages/QrViewPage'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

function renderQrPage(path = '/qr/v2.test-token') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/qr/:token" element={<QrViewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QrViewPage', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('uses the public signed-token verification endpoint', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        verified: true,
        student: {
          full_name: 'Josephine K. Freeman',
          student_id: 'AMD-2024-0001',
          year_level: '3rd Year',
          programme: 'Medicine',
        },
      }),
    })

    renderQrPage()

    expect(
      await screen.findByRole('heading', { name: /Josephine K. Freeman/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/^Medicine$/)).toBeInTheDocument()
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/qr/verify/v2.test-token', { retries: 1 })
    })
  })

  it('offers recovery actions for invalid credentials', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid or expired credential.' }),
    })

    renderQrPage()

    expect(
      await screen.findByRole('heading', { name: /Credential not verified/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Check card status/i })).toHaveAttribute(
      'href',
      '/check-status',
    )
    expect(screen.getByRole('link', { name: /Back to student portal/i })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
