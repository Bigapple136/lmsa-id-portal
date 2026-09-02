import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LandingPage from '../pages/LandingPage'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('exposes accessible student lookup fields and support paths', () => {
    renderLandingPage()

    expect(screen.getByLabelText(/Student ID Number/i)).toHaveAttribute('name', 'student_id')
    expect(screen.getByLabelText(/Full Name/i)).toHaveAttribute('name', 'full_name')
    expect(screen.getByRole('button', { name: /Look Up My Card/i })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: /Verification steps/i })).toHaveTextContent(
      /Preview card/i,
    )
    expect(screen.getByRole('link', { name: /Submit your details/i })).toHaveAttribute(
      'href',
      '/submit',
    )
    expect(screen.getByRole('link', { name: /Check card status/i })).toHaveAttribute(
      'href',
      '/check-status',
    )
  })

  it('shows an announced validation error before submitting an incomplete lookup', () => {
    renderLandingPage()

    fireEvent.click(screen.getByRole('button', { name: /Look Up My Card/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter both/i)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('offers recovery routes when no matching student record is found', async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ found: false }),
    })
    renderLandingPage()

    fireEvent.change(screen.getByLabelText(/Student ID Number/i), {
      target: { value: 'AMD-2024-0001' },
    })
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Josephine K. Freeman' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Look Up My Card/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/could not find a matching record/i)
    expect(screen.getByLabelText(/Lookup recovery options/i)).toHaveTextContent(
      /official AMD student ID/i,
    )
    expect(screen.getByRole('link', { name: 'Submit details' })).toHaveAttribute('href', '/submit')
    expect(screen.getByRole('link', { name: 'Check status' })).toHaveAttribute(
      'href',
      '/check-status',
    )
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1))
  })
})
