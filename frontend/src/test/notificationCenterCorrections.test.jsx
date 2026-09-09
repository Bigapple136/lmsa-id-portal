import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import NotificationCenter from '../components/NotificationCenter'
import { adminFetch } from '../lib/api'

vi.mock('../lib/api', () => ({ adminFetch: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: () => ({ on: () => ({ on: () => ({ subscribe: () => ({}) }) }) }),
    removeChannel: vi.fn(),
  },
}))

const SELF_CORRECTION = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'self_correction',
  title: 'Detail correction',
  message: 'Ama Serwah Boateng (STU-001) corrected their full name and emergency contact phone',
  student_id: 'STU-001',
  is_read_by_me: false,
  created_at: new Date().toISOString(),
  details: {
    fields: [
      { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
      {
        key: 'emergency_contact_phone',
        label: 'emergency contact phone',
        from: '0244000111',
        to: '0209888777',
      },
    ],
    student_note: 'my father changed his number in june',
    photo_issue: false,
  },
}

function stubNotifications(rows) {
  adminFetch.mockImplementation((url) => {
    if (url.startsWith('/api/notifications?') || url === '/api/notifications') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ notifications: rows, total: rows.length, unread: rows.length }),
      })
    }
    return Promise.resolve({ ok: true, json: async () => ({}) })
  })
}

async function openPanel(rows) {
  stubNotifications(rows)
  render(<NotificationCenter onNavigateStudent={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))
  await waitFor(() => expect(screen.getByText(rows[0]?.title ?? '')).toBeInTheDocument())
}

describe('NotificationCenter — correction detail in the feed', () => {
  beforeEach(() => adminFetch.mockReset())
  afterEach(() => vi.restoreAllMocks())

  it('renders the changed fields and the student note, not just the headline', async () => {
    await openPanel([SELF_CORRECTION])

    expect(screen.getByText('Ama Serwaa Boateng')).toBeInTheDocument()
    expect(screen.getByText('0209888777')).toBeInTheDocument()
    expect(screen.getByText('my father changed his number in june')).toBeInTheDocument()
    expect(screen.getByText('Student’s note')).toBeInTheDocument()
  })

  it('still renders a pre-015 notification with no details, without an empty shell', async () => {
    const legacy = { ...SELF_CORRECTION, details: null }
    await openPanel([legacy])

    expect(screen.getByText(legacy.message)).toBeInTheDocument()
    expect(screen.queryByText('What changed')).not.toBeInTheDocument()
    expect(screen.queryByText('Student’s note')).not.toBeInTheDocument()
  })

  it('passes the whole notification to the student drill-through', async () => {
    const onNavigateStudent = vi.fn()
    stubNotifications([SELF_CORRECTION])
    render(<NotificationCenter onNavigateStudent={onNavigateStudent} />)
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }))

    fireEvent.click(await screen.findByRole('button', { name: /View student/i }))
    expect(onNavigateStudent).toHaveBeenCalledWith('STU-001', 'self_correction', expect.objectContaining({ details: expect.objectContaining({ student_note: expect.any(String) }) }))
  })
})
