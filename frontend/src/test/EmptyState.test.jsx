import { render, screen } from '@testing-library/react'
import EmptyState from '../components/EmptyState'

describe('EmptyState', () => {
  it('renders the supplied empty-state message', () => {
    render(<EmptyState>No students added yet.</EmptyState>)
    expect(screen.getByText('No students added yet.')).toHaveClass('empty-state')
  })
})
