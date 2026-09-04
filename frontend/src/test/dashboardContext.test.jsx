import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardProvider, useDashboard } from '../pages/admin/DashboardContext'

describe('DashboardContext', () => {
  it('hands the shared state to a consumer', () => {
    function Consumer() {
      const { stats } = useDashboard()
      return <span>{stats.total}</span>
    }
    render(
      <DashboardProvider value={{ stats: { total: 42 } }}>
        <Consumer />
      </DashboardProvider>,
    )
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('fails loudly when a tab is rendered outside the provider', () => {
    // Otherwise a misplaced tab would destructure undefined and throw a much
    // less obvious error deep inside the tab body.
    function Orphan() {
      useDashboard()
      return null
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Orphan />)).toThrow(/must be used within a DashboardProvider/)
    spy.mockRestore()
  })
})
