import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

// AdminNav now lives in its own module, so this no longer needs the
// supabase/api mocks that importing the whole dashboard page required.
import AdminNav, { ADMIN_TABS } from '../pages/admin/AdminNav'

function renderNav(props = {}) {
  const onSelect = vi.fn()
  const onNavigate = vi.fn()
  const utils = render(
    <AdminNav
      tabs={ADMIN_TABS}
      activeTab="overview"
      onSelect={onSelect}
      userRole="admin"
      onNavigate={onNavigate}
      {...props}
    />,
  )
  return { ...utils, onSelect, onNavigate }
}

describe('AdminNav', () => {
  it('exposes the sections as a tablist with a single selected tab', () => {
    renderNav()
    const lists = screen.getAllByRole('tablist')
    // Sidebar and mobile strip are two presentations of one definition.
    expect(lists).toHaveLength(2)
    lists.forEach((list) => {
      const selected = within(list)
        .getAllByRole('tab')
        .filter((t) => t.getAttribute('aria-selected') === 'true')
      expect(selected).toHaveLength(1)
      expect(selected[0]).toHaveTextContent('Overview')
    })
  })

  it('marks the active tab and only the active tab as selected', () => {
    renderNav({ activeTab: 'students' })
    const [list] = screen.getAllByRole('tablist')
    const active = within(list)
      .getAllByRole('tab')
      .find((t) => t.getAttribute('aria-selected') === 'true')
    expect(active).toHaveTextContent('Students')
  })

  it('keeps exactly one tab in the tab order per list (roving tabindex)', () => {
    renderNav()
    const [list] = screen.getAllByRole('tablist')
    const tabbable = within(list)
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })

  it('selects a section when clicked', () => {
    const { onSelect } = renderNav()
    fireEvent.click(screen.getAllByRole('tab', { name: 'Submissions' })[0])
    expect(onSelect).toHaveBeenCalledWith('submissions')
  })

  it('moves between tabs with the arrow keys', () => {
    const { onSelect } = renderNav()
    const tab = screen.getAllByRole('tab', { name: 'Overview' })[0]
    fireEvent.keyDown(tab, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('upload')
  })

  it('wraps from the first tab back to the last', () => {
    const { onSelect } = renderNav()
    const tab = screen.getAllByRole('tab', { name: 'Overview' })[0]
    fireEvent.keyDown(tab, { key: 'ArrowLeft' })
    expect(onSelect).toHaveBeenCalledWith('settings')
  })

  it('hides the admin-only route from a support admin', () => {
    renderNav({ userRole: 'support_admin' })
    expect(screen.queryByText('Admins')).not.toBeInTheDocument()
    expect(screen.getAllByText('QR Keys').length).toBeGreaterThan(0)
  })

  it('treats sibling routes as links, not tabs', () => {
    const { onNavigate } = renderNav()
    const qrKeys = screen.getAllByText('QR Keys')[0].closest('button')
    expect(qrKeys).not.toHaveAttribute('role', 'tab')
    fireEvent.click(qrKeys)
    expect(onNavigate).toHaveBeenCalledWith('/admin/qr-keys')
  })
})
