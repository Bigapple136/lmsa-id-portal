import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import CorrectionsTab from '../pages/admin/CorrectionsTab'
import AdminNav, { ADMIN_TABS } from '../pages/admin/AdminNav'
import { DashboardProvider } from '../pages/admin/DashboardContext'

// The admin half of the gated correction flow. A student's PATCH can no longer
// move their own record, so this queue is the only path from "I asked" to "it is
// changed" — which makes the two things it must get right: showing the request as
// the student wrote it, and refusing to overwrite a change made since.

const REQUEST = {
  id: 'req-1',
  student_id: 'STU-001',
  status: 'pending',
  created_at: '2026-09-01T09:00:00.000Z',
  reviewed_at: null,
  reviewed_by: null,
  admin_note: null,
  student_note: 'my name is missing an a, and the blood group is wrong',
  fields: [
    { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
    { key: 'blood_type', label: 'blood type', from: 'O+', to: 'A-' },
  ],
  student: {
    student_id: 'STU-001',
    full_name: 'Ama Serwah Boateng',
    year_level: '2nd Year',
    programme: 'Nursing',
    status: 'pending',
  },
}

function renderTab(overrides = {}) {
  const value = {
    correctionConflict: null,
    correctionMsg: null,
    corrections: [REQUEST],
    correctionsFilter: 'pending',
    correctionsLoading: false,
    focusCorrectionId: null,
    handleApproveCorrection: vi.fn(),
    handleRejectCorrection: vi.fn(),
    setCorrectionConflict: vi.fn(),
    setCorrectionsFilter: vi.fn(),
    ...overrides,
  }
  const utils = render(
    <DashboardProvider value={value}>
      <CorrectionsTab />
    </DashboardProvider>,
  )
  return { ...utils, ...value }
}

describe('CorrectionsTab', () => {
  it('shows the request as the student wrote it', () => {
    renderTab()

    // The current name appears twice by design — as the row's student and as the
    // value being corrected away from — so the row and the diff are queried apart.
    expect(screen.getByText('Ama Serwah Boateng', { selector: '.student-name' })).toBeInTheDocument()
    expect(screen.getByText(/STU-001 · 2nd Year/)).toBeInTheDocument()
    expect(screen.getByText('They asked to change')).toBeInTheDocument()
    const diff = screen.getAllByText('Ama Serwaa Boateng')
    expect(diff).toHaveLength(1)
    expect(diff[0].closest('.correction-details')).toBeTruthy()
    expect(screen.getByText('A-')).toBeInTheDocument()
    expect(screen.getByText(/my name is missing an a/)).toBeInTheDocument()
    // How long it has waited, because a queue nobody triages is where students
    // get quietly stuck with a locked card.
    expect(screen.getByText(/Asked Sep 1, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/days waiting/)).toBeInTheDocument()
  })

  it('explains that nothing is applied until an admin acts', () => {
    renderTab()
    expect(
      screen.getByText(/Nothing is applied until you approve it/i),
    ).toBeInTheDocument()
  })

  it('approves the row it is showing, with no force by default', () => {
    const value = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(value.handleApproveCorrection).toHaveBeenCalledWith(REQUEST)
  })

  it('routes a rejection through a note the student will read', () => {
    const value = renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    expect(value.handleRejectCorrection).toHaveBeenCalledWith(REQUEST)
  })

  it('turns a conflict into an explicit override, never a silent one', () => {
    const { container, ...value } = renderTab({
      correctionConflict: {
        id: 'req-1',
        error: 'The record changed since this was requested: full name. Approving now would overwrite that change.',
        conflicts: [
          {
            key: 'full_name',
            label: 'full name',
            requested: 'Ama Serwaa Boateng',
            current: 'Ama Serwah Awudi',
          },
        ],
      },
    })

    const box = container.querySelector('.correction-conflict')
    expect(box).toBeTruthy()
    expect(within(box).getByText(/The record changed since this was requested/)).toBeInTheDocument()
    expect(
      within(box).getByText(/they asked for “Ama Serwaa Boateng”, the record now says “Ama Serwah Awudi”/),
    ).toBeInTheDocument()

    fireEvent.click(within(box).getByRole('button', { name: /Apply anyway/i }))
    expect(value.handleApproveCorrection).toHaveBeenCalledWith(REQUEST, { force: true })
    // The conflict stays on screen only until the admin decides; dismissing it
    // leaves the request pending and untouched.
    expect(value.handleApproveCorrection.mock.calls[0][1]).toEqual({ force: true })

    fireEvent.click(within(box).getByRole('button', { name: /Leave it/i }))
    expect(value.setCorrectionConflict).toHaveBeenCalledWith(null)
  })

  it('does not offer decisions on a request that is already decided', () => {
    renderTab({
      corrections: [{ ...REQUEST, status: 'rejected', admin_note: 'registrar has it right' }],
      correctionsFilter: 'rejected',
    })

    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument()
    expect(screen.getByText('Review note: registrar has it right')).toBeInTheDocument()
  })

  it('keeps an unreadable queue from reading as an empty one', () => {
    renderTab({ corrections: [], correctionMsg: { ok: false, text: 'Could not load correction requests. Try again.' } })
    expect(screen.getByText('Could not load correction requests. Try again.')).toBeInTheDocument()
  })

  it('filters by status and clears a stale conflict on the way', () => {
    const value = renderTab({
      correctionsFilter: 'pending',
      correctionConflict: { id: 'req-1', error: 'stale', conflicts: [] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'withdrawn' }))
    expect(value.setCorrectionsFilter).toHaveBeenCalledWith('withdrawn')
    expect(value.setCorrectionConflict).toHaveBeenCalledWith(null)
  })

  it('marks the request a notification pointed at', () => {
    const { container } = renderTab({ focusCorrectionId: 'STU-001' })
    expect(container.querySelector('.corrections-row--focus')).toBeTruthy()
  })

  it('says so when nothing is waiting', () => {
    renderTab({ corrections: [] })
    expect(screen.getByText(/No pending correction requests waiting\./i)).toBeInTheDocument()
  })
})

describe('Corrections in the dashboard navigation', () => {
  it('sits between the record list and the enrollment queue', () => {
    expect(ADMIN_TABS.map((t) => t.id)).toEqual([
      'overview',
      'upload',
      'layout',
      'students',
      'corrections',
      'submissions',
      'settings',
    ])
  })

  it('carries the pending count on both navigation surfaces', () => {
    const tabs = ADMIN_TABS.map((t) => (t.id === 'corrections' ? { ...t, count: 3 } : t))
    render(
      <AdminNav tabs={tabs} activeTab="corrections" onSelect={vi.fn()} userRole="admin" onNavigate={vi.fn()} />,
    )
    expect(screen.getAllByText('3')).toHaveLength(2)
    expect(screen.getAllByLabelText('3 waiting')).toHaveLength(2)
  })

  it('shows no badge when the queue is empty', () => {
    render(
      <AdminNav
        tabs={ADMIN_TABS}
        activeTab="corrections"
        onSelect={vi.fn()}
        userRole="admin"
        onNavigate={vi.fn()}
      />,
    )
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
