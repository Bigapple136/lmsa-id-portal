import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentSubmissionForm from '../pages/StudentSubmissionForm'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
}))

function jsonResponse(data, ok = true) {
  return Promise.resolve({ ok, json: async () => data })
}

function renderSubmissionForm() {
  return render(
    <MemoryRouter>
      <StudentSubmissionForm />
    </MemoryRouter>,
  )
}

describe('StudentSubmissionForm', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    apiFetch.mockImplementation((path) => {
      if (path === '/api/submissions/status') return jsonResponse({ enabled: true })
      if (path === '/api/settings/fields') return jsonResponse({ position: { enabled: true } })
      if (path === '/api/settings/qr-fields') {
        return jsonResponse({ programme: { enabled: true }, student_email: { enabled: true } })
      }
      return jsonResponse({})
    })
  })

  it('announces required core fields before advancing', async () => {
    renderSubmissionForm()

    await screen.findByRole('heading', { name: /Student Information/i })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Please fix the highlighted field/i)
    expect(screen.getByText(/Enter your Student ID/i)).toBeInTheDocument()
    expect(screen.getByText(/Enter your full name/i)).toBeInTheDocument()
  })

  it('allows optional enabled fields to stay blank but validates filled email values', async () => {
    renderSubmissionForm()

    fireEvent.change(await screen.findByLabelText(/Student ID/i), {
      target: { value: 'AMD-2024-0001' },
    })
    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: 'Josephine K. Freeman' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await screen.findByRole('heading', { name: /Academic Information/i })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await screen.findByRole('heading', { name: /Additional Information/i })
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/Please fix the highlighted field/i)
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'student@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Review & Submit/i })).toBeInTheDocument()
    })
    expect(screen.getByText(/student@example.com/i)).toBeInTheDocument()
  })
})
