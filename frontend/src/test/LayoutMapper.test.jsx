import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LayoutMapper from '../components/LayoutMapper'

// jsdom has no canvas; CardCanvas falls back to IDCardDisplay, and zone
// detection never resolves. Neither matters for the behaviour under test.
vi.mock('../lib/detectZones', () => ({
  detectZonesFromImage: vi.fn(() => Promise.resolve({ zones: [], width: 590, height: 1004 })),
}))

const baseProps = {
  enabledFields: {},
  templateUrlFront: 'https://example.test/front.png',
  templateNameFront: 'front.png',
  onSave: vi.fn(() => Promise.resolve()),
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.useRealTimers()
})

// The canvas chips are pointer-driven; the legend below the card is the
// keyboard/click route to selecting a field.
function selectName() {
  fireEvent.click(screen.getByRole('button', { name: 'Name', pressed: false }))
}

describe('LayoutMapper unsaved-work safety', () => {
  it('shows no unsaved indicator before anything is edited', () => {
    render(<LayoutMapper {...baseProps} />)
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('flags unsaved changes once a field is nudged', () => {
    render(<LayoutMapper {...baseProps} />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('confirms before Reset discards a side, and warns when work is unsaved', () => {
    render(<LayoutMapper {...baseProps} />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Reset the front layout?')
    expect(dialog).toHaveTextContent(/cannot be recovered/i)
  })

  it('does not reset when the confirmation is declined', () => {
    render(<LayoutMapper {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep my layout' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears the unsaved flag after a successful save', async () => {
    render(<LayoutMapper {...baseProps} />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(baseProps.onSave).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument())
  })

  it('keeps the edit and says so when saving fails', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('Layout column is read-only')))
    render(<LayoutMapper {...baseProps} onSave={onSave} />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText(/Layout column is read-only/)
    expect(screen.getByText(/Your changes are still here/)).toBeInTheDocument()
    // The work is not silently dropped.
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('announces status messages to assistive technology', async () => {
    render(<LayoutMapper {...baseProps} />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/Layout saved/)
  })
})

describe('LayoutMapper measurements', () => {
  it('reports millimetres against the portrait card, not a landscape one', () => {
    render(<LayoutMapper {...baseProps} />)
    selectName()
    // full_name sits at x = 0.5 in the calibrated front layout. On the
    // portrait card that is 0.5 x 53.98 = 27.0mm, not 0.5 x 85.6 = 42.8mm.
    expect(screen.getByText('27.0 mm from left')).toBeInTheDocument()
  })

  it('describes a field chip with its physical position for screen readers', () => {
    render(<LayoutMapper {...baseProps} />)
    const chip = screen.getByRole('button', { name: /^Name field at 27.0 millimetres from the left/ })
    expect(chip).toBeInTheDocument()
  })
})

describe('LayoutMapper side switching', () => {
  it('keeps unsaved edits on a side when switching away and back', () => {
    render(<LayoutMapper {...baseProps} templateUrlBack="https://example.test/back.png" />)
    selectName()
    fireEvent.click(screen.getByRole('button', { name: 'Nudge right' }))
    const before = screen.getByText(/mm from left/).textContent

    fireEvent.click(screen.getByRole('button', { name: /^Back/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Front/ }))
    selectName()
    expect(screen.getByText(/mm from left/).textContent).toBe(before)
    // Still flagged as unsaved after the round trip.
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })
})

describe('LayoutMapper "Not printed" field side', () => {
  function openFieldSides() {
    fireEvent.click(screen.getByRole('button', { name: /Field sides/ }))
  }

  it('offers Not printed for an ordinary field', () => {
    render(<LayoutMapper {...baseProps} />)
    openFieldSides()
    const select = screen.getByLabelText('Position')
    expect(
      [...select.options].map((o) => o.value),
    ).toEqual(['front', 'back', 'both', 'none'])
  })

  it('does not offer Not printed for the QR code', () => {
    render(<LayoutMapper {...baseProps} />)
    openFieldSides()
    const select = screen.getByLabelText('QR Code')
    expect([...select.options].map((o) => o.value)).toEqual(['front', 'back', 'both'])
  })

  it('removes a field from the card when set to Not printed', () => {
    const onSaveFieldSides = vi.fn()
    render(<LayoutMapper {...baseProps} onSaveFieldSides={onSaveFieldSides} />)
    // Name starts on the front, so it has a chip and a legend entry.
    expect(screen.getByRole('button', { name: 'Name', pressed: false })).toBeInTheDocument()

    openFieldSides()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'none' } })

    expect(screen.queryByRole('button', { name: 'Name', pressed: false })).not.toBeInTheDocument()
    expect(onSaveFieldSides).toHaveBeenCalledWith(
      expect.objectContaining({ full_name: 'none' }),
    )
  })

  it('summarises which fields are off the card, and says the data is kept', () => {
    render(<LayoutMapper {...baseProps} />)
    openFieldSides()
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'none' } })
    const summary = screen.getByText(/Not printed on the card:/)
    expect(summary).toHaveTextContent('Position')
    expect(summary).toHaveTextContent(/Still stored on the student record/)
  })

  it('honours a persisted none from the server', () => {
    render(<LayoutMapper {...baseProps} fieldSides={{ position: 'none' }} />)
    openFieldSides()
    expect(screen.getByLabelText('Position')).toHaveValue('none')
  })
})
