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

describe('QrViewPage credential state', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  const baseStudent = {
    full_name: 'Josephine K. Freeman',
    student_id: 'AMD-2024-0001',
    year_level: '3rd Year',
    issue_date: '2026-01-05',
    valid_until: '2027-01-05',
  }

  function mockVerify(payload) {
    apiFetch.mockResolvedValue({ ok: true, json: async () => payload })
  }

  it('shows the validity dates a verifier came to check', async () => {
    mockVerify({ verified: true, credential_state: 'valid', student: baseStudent })
    renderQrPage()
    expect(await screen.findByText('Credential verified')).toBeInTheDocument()
    expect(screen.getByText('Valid until')).toBeInTheDocument()
    // Rendered via toLocaleDateString, so assert on the parts rather than a
    // fixed locale ordering.
    expect(screen.getByText(/January.*2027/)).toBeInTheDocument()
    expect(screen.getByText(/January.*2026/)).toBeInTheDocument()
  })

  it('never labels an expired card as verified', async () => {
    mockVerify({
      verified: false,
      credential_state: 'expired',
      credential_reason: 'This card passed its validity date.',
      student: { ...baseStudent, valid_until: '2020-01-05' },
    })
    renderQrPage()

    expect(await screen.findByText('Card expired')).toBeInTheDocument()
    expect(screen.queryByText('Credential verified')).not.toBeInTheDocument()
    expect(screen.getByText('Expired')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/should be renewed/i)
  })

  it('still shows the record for an expired card so the verifier can see what expired', async () => {
    mockVerify({
      verified: false,
      credential_state: 'expired',
      student: { ...baseStudent, valid_until: '2020-01-05' },
    })
    renderQrPage()
    // The name appears in both the profile header and the detail table.
    expect((await screen.findAllByText('Josephine K. Freeman')).length).toBeGreaterThan(0)
    expect(screen.getByText('AMD-2024-0001')).toBeInTheDocument()
  })

  it('marks a non-approved record as not active', async () => {
    mockVerify({
      verified: false,
      credential_state: 'inactive',
      student: baseStudent,
    })
    renderQrPage()
    expect(await screen.findByText('Card not active')).toBeInTheDocument()
    expect(screen.queryByText('Credential verified')).not.toBeInTheDocument()
  })

  it('reports missing dates rather than rendering an invalid date', async () => {
    mockVerify({
      verified: true,
      credential_state: 'valid',
      student: { ...baseStudent, issue_date: null, valid_until: null },
    })
    renderQrPage()
    await screen.findByText('Credential verified')
    expect(screen.getAllByText('Not recorded')).toHaveLength(2)
  })

  it('still treats a bad signature as a hard failure', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid or expired credential.' }),
    })
    renderQrPage()
    expect(await screen.findByText('Credential not verified')).toBeInTheDocument()
  })
})
