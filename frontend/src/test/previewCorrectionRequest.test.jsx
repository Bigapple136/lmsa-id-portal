import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PreviewPage from '../pages/PreviewPage'
import { ToastProvider } from '../components/Toast'
import { apiFetch } from '../lib/api'

vi.mock('../lib/api', () => ({ apiFetch: vi.fn(), adminFetch: vi.fn(), adminJson: vi.fn() }))

// The student's half of the gated correction flow: an ask an admin decides, not an
// edit the student makes. These tests are about what the page therefore has to say
// — what is waiting, that nothing has changed yet, and how to back out.

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

const OPEN_REQUEST = {
  id: 'req-1',
  student_id: 'STU-001',
  status: 'pending',
  created_at: '2026-09-05T10:00:00.000Z',
  reviewed_at: null,
  admin_note: null,
  student_note: 'my second name is missing from the register',
  fields: [
    { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
    { key: 'year_level', label: 'year level', from: '2nd Year', to: '3rd Year' },
  ],
}

function stubApi({ mine = { requests: [OPEN_REQUEST], open: OPEN_REQUEST }, patchResponse } = {}) {
  const calls = []
  let mineCalls = 0
  apiFetch.mockImplementation((url, opts = {}) => {
    if (url.includes('/self-correct')) {
      calls.push({ url, body: JSON.parse(opts.body) })
      return Promise.resolve(
        patchResponse || { ok: true, json: async () => ({ student: STUDENT, request: OPEN_REQUEST }) },
      )
    }
    if (url.includes('/api/corrections/mine')) {
      mineCalls += 1
      return Promise.resolve(mine ? { ok: true, json: async () => mine } : { ok: false, json: async () => ({}) })
    }
    if (url.includes('/withdraw')) {
      calls.push({ url, method: opts.method })
      return Promise.resolve({ ok: true, json: async () => ({ request: { ...OPEN_REQUEST, status: 'withdrawn' } }) })
    }
    if (url.includes('/settings/qr-fields')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ blood_type: { enabled: true }, programme: { enabled: true } }),
      })
    }
    if (url.includes('/preview/')) {
      return Promise.resolve({ ok: true, json: async () => STUDENT })
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
  })
  return { calls, mineCalls: () => mineCalls }
}

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

describe('preview page — a correction is a request under review', () => {
  beforeEach(() => {
    apiFetch.mockReset()
  })

  it('shows what is waiting, including the student’s own words', async () => {
    const { container } = stubApi() && renderPreview()

    await waitFor(() => expect(container.querySelector('.review-banner')).toBeTruthy())
    // Scoped to the banner: the values it quotes are the same ones the record table
    // and the card render, and a page-wide query would match those too.
    const banner = container.querySelector('.review-banner')
    // The status line says the same thing in the summary row, which is what a
    // student skimming the panel reads first.
    expect(screen.getAllByText('Correction under review').length).toBe(2)

    expect(within(banner).getByText('You asked to change')).toBeInTheDocument()
    expect(within(banner).getByText('Ama Serwah Boateng')).toBeInTheDocument()
    expect(within(banner).getByText('Ama Serwaa Boateng')).toBeInTheDocument()
    expect(within(banner).getByText('2nd Year')).toBeInTheDocument()
    expect(within(banner).getByText('3rd Year')).toBeInTheDocument()
    expect(within(banner).getByText('my second name is missing from the register')).toBeInTheDocument()
    expect(
      within(banner).getByText(/an LMSA admin checks corrections before they are applied/i),
    ).toBeInTheDocument()
    expect(banner.querySelector('.review-banner-withdraw')).not.toBeDisabled()
  })

  it('locks Confirm, and says why rather than looking broken', async () => {
    stubApi()
    renderPreview()

    const confirm = await screen.findByRole('button', { name: /Confirm — all correct/i })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/waiting on the admin reviewing your request/i)).toBeInTheDocument()
  })

  it('still offers a way to add to the request', async () => {
    stubApi()
    renderPreview()

    const add = await screen.findByRole('button', { name: /Add to your request/i })
    fireEvent.click(add)
    expect(await screen.findByText(/What needs correcting\?/i)).toBeInTheDocument()
  })

  it('withdraws the open request and re-reads the queue', async () => {
    const { calls, mineCalls } = stubApi()
    renderPreview()

    fireEvent.click(await screen.findByRole('button', { name: /Withdraw request/i }))
    const before = mineCalls()

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes('/api/corrections/req-1/withdraw') && c.method === 'POST')).toBe(true),
    )
    await waitFor(() => expect(mineCalls()).toBeGreaterThan(before))
    expect(screen.getByText(/Request withdrawn/i)).toBeInTheDocument()
  })

  it('does not pretend the record changed when the request is filed', async () => {
    const { calls } = stubApi()
    renderPreview()

    // The secondary button reads "Add to your request" while a request is open —
    // revising is the same flow, and this test is about what the submit does.
    fireEvent.click(await screen.findByRole('button', { name: /Add to your request/i }))
    fireEvent.click(screen.getByLabelText(/Misspelled name/i))
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }))
    fireEvent.change(await screen.findByLabelText(/Correct full name/i), {
      target: { value: 'Ama Serwaa Boateng' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Submit Correction/i }))

    await waitFor(() => expect(calls).toHaveLength(1))
    expect(await screen.findByText(/Sent for review/i)).toBeInTheDocument()
    expect(screen.getByText(/keeps showing what LMSA has on record/i)).toBeInTheDocument()
    // No optimistic rewrite of the card: the record above is what the API says it
    // is, which is still the old name.
    expect(screen.getAllByText('Ama Serwah Boateng').length).toBeGreaterThan(0)
  })

  it('brings the admin’s reason back to the student after a rejection', async () => {
    const decided = {
      ...OPEN_REQUEST,
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      admin_note: 'the register has the spelling right — bring your ID to the office',
    }
    stubApi({ mine: { requests: [decided], open: null } })
    renderPreview()

    expect(await screen.findByText(/left your details as they were/i)).toBeInTheDocument()
    expect(screen.getByText(/the register has the spelling right/i)).toBeInTheDocument()
    // Unlocked: with nothing in the way, the student can confirm the card.
    expect(screen.getByRole('button', { name: /Confirm — all correct/i })).toBeEnabled()
  })

  it('stays usable when the queue cannot be read', async () => {
    // e.g. sql/016 not applied, or the endpoint is down — the card itself is the
    // page's job, and a missing banner must not cost an admin's approval to a
    // student who is only trying to check their details.
    stubApi({ mine: null })
    renderPreview()

    const confirm = await screen.findByRole('button', { name: /Confirm — all correct/i })
    expect(confirm).toBeEnabled()
    expect(screen.queryByText('Correction under review')).not.toBeInTheDocument()
  })
})
