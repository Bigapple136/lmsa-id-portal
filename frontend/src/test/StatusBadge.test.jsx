import { render, screen } from '@testing-library/react'
import StatusBadge from '../components/StatusBadge'

describe('StatusBadge', () => {
  it('renders a known status with its friendly label', () => {
    render(<StatusBadge status="photo_issue" />)
    expect(screen.getByText('Photo issue')).toHaveClass('pill-photo')
  })

  it('falls back safely for an unknown status', () => {
    render(<StatusBadge status="archived" />)
    expect(screen.getByText('archived')).toHaveClass('pill-gray')
  })
})
