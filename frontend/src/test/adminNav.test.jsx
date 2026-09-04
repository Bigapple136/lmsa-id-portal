import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '../components/Toast'

describe('Toast accessibility', () => {
  function Harness() {
    const toast = useToast()
    return (
      <>
        <button onClick={() => toast.success('Saved')}>ok</button>
        <button onClick={() => toast.error('Boom')}>bad</button>
      </>
    )
  }

  function renderHarness() {
    return render(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    )
  }

  it('keeps the live region mounted before any toast exists', () => {
    const { container } = renderHarness()
    const region = container.querySelector('.toast-container')
    expect(region).toBeTruthy()
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('role', 'status')
  })

  it('announces a success message in the polite region', () => {
    renderHarness()
    fireEvent.click(screen.getByText('ok'))
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('escalates errors to an assertive alert', () => {
    renderHarness()
    fireEvent.click(screen.getByText('bad'))
    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
  })

  it('hides the decorative status glyph from assistive tech', () => {
    const { container } = renderHarness()
    fireEvent.click(screen.getByText('ok'))
    expect(container.querySelector('.toast-icon')).toHaveAttribute('aria-hidden', 'true')
  })

  it('can be dismissed', () => {
    renderHarness()
    fireEvent.click(screen.getByText('ok'))
    fireEvent.click(screen.getByLabelText('Dismiss'))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
