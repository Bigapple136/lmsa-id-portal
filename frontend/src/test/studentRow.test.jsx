import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import StudentRow from '../pages/admin/StudentRow'

const student = {
  id: 1,
  student_id: 'AMD-2024-0001',
  full_name: 'Josephine K. Freeman',
  year_level: '3rd Year',
  status: 'confirmed',
  qr_url: 'https://example.test/qr.png',
}

function renderRow(props = {}) {
  const handlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onGenerateQR: vi.fn(),
    onRegenerateQR: vi.fn(),
  }
  render(
    <table>
      <tbody>
        <StudentRow
          student={student}
          session={{ access_token: 't' }}
          userRole="admin"
          statusPill={(s) => <span>{s}</span>}
          getInitials={(n) => n[0]}
          {...handlers}
          {...props}
        />
      </tbody>
    </table>,
  )
  return handlers
}

describe('StudentRow', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('falls back to initials, hidden from assistive tech, when there is no photo', () => {
    renderRow()
    // The row header already announces the name; the initials would repeat it.
    expect(document.querySelector('.avatar')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders as a table row with the name as the row header', () => {
    renderRow()
    const row = screen.getByRole('row')
    const rowHeader = within(row).getByRole('rowheader')
    expect(rowHeader).toHaveTextContent('Josephine K. Freeman')
  })

  it('gives every action an accessible name that names the student', () => {
    renderRow()
    // Without this, a screen-reader user hears a page of identical "Edit" and
    // "Delete" buttons with no way to tell the rows apart.
    expect(screen.getByRole('button', { name: /Edit Josephine K\. Freeman/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete Josephine K\. Freeman/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /View preview for Josephine K\. Freeman/ }),
    ).toBeInTheDocument()
  })

  it('treats a decorative photo as decorative', () => {
    renderRow({ student: { ...student, photo_url: 'https://example.test/p.jpg' } })
    // The name is already the row header, so the photo must not repeat it.
    // alt="" removes it from the a11y tree, so query the DOM directly.
    const img = document.querySelector('.student-photo')
    expect(img).toBeTruthy()
    expect(img).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('offers Generate QR instead of the ready chip when no QR exists', () => {
    renderRow({ student: { ...student, qr_url: null } })
    expect(screen.getByRole('button', { name: /Generate QR/ })).toBeInTheDocument()
    expect(screen.queryByText('QR ready')).not.toBeInTheDocument()
  })

  it('hides destructive actions from a support admin', () => {
    renderRow({ userRole: 'support_admin' })
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Regenerate/ })).not.toBeInTheDocument()
    // Read-only actions survive.
    expect(screen.getByRole('button', { name: /View page/ })).toBeInTheDocument()
  })

  it('passes the student to the edit and delete handlers', () => {
    const h = renderRow()
    fireEvent.click(screen.getByRole('button', { name: /Edit Josephine/ }))
    expect(h.onEdit).toHaveBeenCalledWith(student)
    fireEvent.click(screen.getByRole('button', { name: /Delete Josephine/ }))
    expect(h.onDelete).toHaveBeenCalledWith(student)
  })

  it('opens a signed preview URL in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://example.test/p' }),
    })
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: /View preview/ }))
    await vi.waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://example.test/p', '_blank', 'noopener,noreferrer'),
    )
  })

  it('does not open a tab when the signed URL request fails', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) })
    renderRow()
    fireEvent.click(screen.getByRole('button', { name: /View page/ }))
    await new Promise((r) => setTimeout(r, 10))
    expect(open).not.toHaveBeenCalled()
  })

  it('escapes the student id when building the signed URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'u' }),
    })
    vi.spyOn(window, 'open').mockImplementation(() => {})
    renderRow({ student: { ...student, student_id: 'AMD/2024 0001' } })
    fireEvent.click(screen.getByRole('button', { name: /View preview/ }))
    await vi.waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/students/preview-url/AMD%2F2024%200001',
        expect.anything(),
      ),
    )
  })
})
