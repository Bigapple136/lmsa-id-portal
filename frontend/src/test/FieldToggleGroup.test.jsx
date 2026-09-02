import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FieldToggleGroup from '../components/FieldToggleGroup'

describe('FieldToggleGroup', () => {
  it('renders field controls as keyboard-accessible switches and preserves locked fields', () => {
    const onToggle = vi.fn()

    render(
      <FieldToggleGroup
        items={[
          { key: 'student_id', label: 'Student ID', enabled: true, locked: true },
          { key: 'signature', label: 'Signature', enabled: false, locked: false },
        ]}
        onToggle={onToggle}
      />,
    )

    const locked = screen.getByRole('switch', { name: /Student ID/i })
    expect(locked).toBeDisabled()
    expect(locked).toHaveAttribute('aria-checked', 'true')

    const signature = screen.getByRole('switch', { name: /Signature/i })
    expect(signature).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(signature)

    expect(onToggle).toHaveBeenCalledWith('signature')
  })
})
