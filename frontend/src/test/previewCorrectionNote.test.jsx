import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PreviewPage from '../pages/PreviewPage'
import { ToastProvider } from '../components/Toast'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({ apiFetch: vi.fn(), adminFetch: vi.fn(), adminJson: vi.fn() }))

const STUDENT = {
  student_id: 'STU-001',
  full_name: 'Ama Serwah Boateng',
  year_level: '2nd Year',
  position: null,
  status: 'pending',
  programme: 'Nursing',
  blood_type: 'O+',
  student_email: 'ama@example.test',
  emergency_contact_name: 'Kwame Boateng',
  emergency_contact_phone: '0244000111',
  date_of_birth: '2003-04-01',
  nationality: 'Ghanaian',
  county_of_origin: 'Accra',
  current_address: 'North Campus, Hall 4',
}

const NOTE_LABEL = /what issue did you find with your details\?/i

function renderPreview() {
  return render(
    <MemoryRouter initialEntries={['/preview/test-token']}>
      <ToastProvider>
        <Routes>
          <Route path="/preview/:token" element={<PreviewPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function stubApi({ patchResponse } = {}) {
  const calls = []
  apiFetch.mockImplementation((url, opts) => {
    if (url.includes('/self-correct')) {
      calls.push({ url, body: JSON.parse(opts.body) })
      // The real shape: `student` is the record as it still stands, `request` is
      // the ask an admin has to approve. A correction is no longer an edit.
      return Promise.resolve(
        patchResponse || {
          ok: true,
          json: async () => ({
            student: STUDENT,
            request: {
              id: 'req-1',
              status: 'pending',
              created_at: new Date().toISOString(),
              fields: [{ key: 'full_name', label: 'full name', from: STUDENT.full_name, to: 'Ama Serwaa Boateng' }],
              student_note: null,
            },
          }),
        },
      )
    }
    if (url.includes('/settings/qr-fields')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          blood_type: { enabled: true },
          programme: { enabled: true },
          emergency_contact_phone: { enabled: true },
        }),
      })
    }
    if (url.includes('/preview/')) {
      return Promise.resolve({ ok: true, json: async () => STUDENT })
    }
    return Promise.resolve({ ok: false, json: async () => ({}) })
  })
  return calls
}

async function openReportFlow() {
  fireEvent.click(await screen.findByRole('button', { name: /Report an issue/i }))
}

describe('preview correction flow — the student note', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('asks what the student found wrong, on the step where they already know', async () => {
    stubApi()
    renderPreview()
    await openReportFlow()

    const box = screen.getByRole('textbox', { name: NOTE_LABEL })
    expect(box).toBeInTheDocument()
    // The API rejects longer text, so the box enforces the same ceiling.
    expect(box).toHaveAttribute('maxlength', '500')
    expect(screen.getByText(/only LMSA admins see this/i)).toBeInTheDocument()
  })

  it('posts the note alongside the correction', async () => {
    const calls = stubApi()
    renderPreview()
    await openReportFlow()

    fireEvent.click(screen.getByLabelText(/Misspelled name/i))
    fireEvent.change(screen.getByRole('textbox', { name: NOTE_LABEL }), {
      target: { value: '  my second name is missing from the register  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))

    fireEvent.change(await screen.findByLabelText(/Correct full name/i), {
      target: { value: 'Ama Serwaa Boateng' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Correction/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body.corrections.full_name).toBe('Ama Serwaa Boateng')
    // Trimmed client-side so what the admin reads matches what was typed, and
    // the backend's own whitespace collapsing agrees with it.
    expect(calls[0].body.student_note).toBe('my second name is missing from the register')
  })

  it('omits the note entirely when the student leaves it empty', async () => {
    const calls = stubApi()
    renderPreview()
    await openReportFlow()

    fireEvent.click(screen.getByLabelText(/Misspelled name/i))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.change(await screen.findByLabelText(/Correct full name/i), {
      target: { value: 'Ama Serwaa Boateng' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Correction/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body.student_note).toBeUndefined()
  })

  it('carries the note into a photo-only report, where it matters most', async () => {
    const calls = stubApi()
    renderPreview()
    await openReportFlow()

    fireEvent.click(screen.getByLabelText(/Wrong image/i))
    fireEvent.change(screen.getByRole('textbox', { name: NOTE_LABEL }), {
      target: { value: 'that is my cousin, not me' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Notify admin/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].body.photo_issue).toBe(true)
    expect(calls[0].body.student_note).toBe('that is my cousin, not me')
  })

  it('tells the student what the server rejected instead of a generic failure', async () => {
    stubApi({
      patchResponse: {
        ok: false,
        status: 400,
        json: async () => ({ error: 'Nothing to correct — the details you sent already match your record.' }),
      },
    })
    renderPreview()
    await openReportFlow()

    fireEvent.click(screen.getByLabelText(/Misspelled name/i))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.change(await screen.findByLabelText(/Correct full name/i), {
      target: { value: 'Ama Serwaa Boateng' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Correction/i }))

    expect(
      await screen.findByText('Nothing to correct — the details you sent already match your record.'),
    ).toBeInTheDocument()
  })
})
