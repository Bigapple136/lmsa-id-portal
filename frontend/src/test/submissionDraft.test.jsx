import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import StudentSubmissionForm from '../pages/StudentSubmissionForm'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({ apiFetch: vi.fn() }))

const DRAFT_KEY = 'lmsa:submission-draft:v1'

function mockOpenForm() {
  apiFetch.mockImplementation((url) => {
    if (url.includes('/submissions/status')) {
      return Promise.resolve({ ok: true, json: async () => ({ enabled: true }) })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
}

function renderForm() {
  return render(
    <MemoryRouter>
      <StudentSubmissionForm />
    </MemoryRouter>,
  )
}

describe('submission draft persistence', () => {
  beforeEach(() => {
    apiFetch.mockReset()
    window.sessionStorage.clear()
    mockOpenForm()
  })

  it('saves what the student has typed', async () => {
    renderForm()
    const idInput = await screen.findByLabelText(/Student ID/i)
    fireEvent.change(idInput, { target: { value: 'AMD-2024-0007' } })

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(DRAFT_KEY)
      expect(raw).toBeTruthy()
      expect(JSON.parse(raw).form.student_id).toBe('AMD-2024-0007')
    })
  })

  it('does not write a draft before anything is entered', async () => {
    renderForm()
    await screen.findByLabelText(/Student ID/i)
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('restores a saved draft and tells the student it did', async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form: { student_id: 'AMD-2024-0009', full_name: 'Ada Doe' }, step: 0 }),
    )
    renderForm()

    expect(await screen.findByText(/We restored the details you started earlier/)).toBeInTheDocument()
    expect(await screen.findByDisplayValue('AMD-2024-0009')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ada Doe')).toBeInTheDocument()
  })

  it('lets the student discard a restored draft and start over', async () => {
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ form: { student_id: 'AMD-2024-0009' }, step: 0 }),
    )
    renderForm()
    await screen.findByDisplayValue('AMD-2024-0009')

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))

    expect(screen.queryByDisplayValue('AMD-2024-0009')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('ignores a corrupt draft instead of breaking the form', async () => {
    window.sessionStorage.setItem(DRAFT_KEY, '{not valid json')
    renderForm()
    expect(await screen.findByLabelText(/Student ID/i)).toBeInTheDocument()
    expect(screen.queryByText(/We restored the details/)).not.toBeInTheDocument()
  })
})
