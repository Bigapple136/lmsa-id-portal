import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CorrectionDetails from '../components/CorrectionDetails'

// The notification row used to say "…requested corrections to their details"
// and nothing else. `details` is what the backend now attaches to every
// self-correction notification, and this is the only thing that turns it back
// into something an admin can act on without opening the record.

describe('CorrectionDetails', () => {
  it('shows which field changed and what it changed to', () => {
    render(
      <CorrectionDetails
        details={{
          fields: [
            { key: 'full_name', label: 'full name', from: 'Ama Serwah Boateng', to: 'Ama Serwaa Boateng' },
            { key: 'year_level', label: 'year level', from: '2nd Year', to: '3rd Year' },
          ],
          student_note: 'my second name is misspelled',
        }}
      />,
    )

    expect(screen.getByText('full name')).toBeInTheDocument()
    expect(screen.getByText('Ama Serwaa Boateng')).toBeInTheDocument()
    expect(screen.getByText('3rd Year')).toBeInTheDocument()
    expect(screen.getByText('my second name is misspelled')).toBeInTheDocument()
    expect(screen.getByText(/Student’s note/i)).toBeInTheDocument()
  })

  it('labels a missing or cleared value instead of rendering a blank', () => {
    render(
      <CorrectionDetails
        details={{
          fields: [
            { key: 'blood_type', label: 'blood type', from: null, to: 'O-' },
            { key: 'current_address', label: 'current address', from: 'Hall 4', to: null },
          ],
        }}
      />,
    )

    const empties = screen.getAllByText(/not set|cleared/)
    expect(empties).toHaveLength(2)
  })

  it('keeps the arrow decorative but spells the change out for screen readers', () => {
    // A sighted admin reads "Prefect → Prefect" as before/after by the arrow
    // alone; a screen-reader user needs the words.
    const { container } = render(
      <CorrectionDetails
        details={{
          fields: [
            { key: 'position', label: 'position', from: 'Prefect', to: 'Hall Tutor' },
            { key: 'programme', label: 'programme', from: 'Nursing', to: null },
          ],
        }}
      />,
    )

    expect(container.querySelector('.correction-detail-arrow')).toHaveAttribute('aria-hidden', 'true')
    const rows = [...container.querySelectorAll('.correction-detail-row')]
    expect([...rows[0].querySelectorAll('.sr-only')].map((n) => n.textContent.trim())).toEqual(['was', 'now'])
    // A value being removed has no "now" to announce — "cleared" says it all.
    expect([...rows[1].querySelectorAll('.sr-only')].map((n) => n.textContent.trim())).toEqual(['was'])
    expect(rows[1].textContent).toContain('cleared')
  })

  it('renders nothing for a notification without structured details', () => {
    const { container } = render(<CorrectionDetails details={null} />)
    expect(container).toBeEmptyDOMElement()

    // Rows written before sql/015, and notifications stored while that column
    // was missing, only ever have the message — which reads fine on its own.
    const empty = render(<CorrectionDetails details={{ fields: [], student_note: null }} />)
    expect(empty.container).toBeEmptyDOMElement()
  })

  it('shows the heading only when there are fields to head', () => {
    const noteOnly = render(<CorrectionDetails details={{ fields: [], student_note: 'the photo is not mine' }} />)
    expect(noteOnly.queryByText('What changed')).not.toBeInTheDocument()
    expect(screen.getByText('the photo is not mine')).toBeInTheDocument()

    const { getByText } = render(
      <CorrectionDetails details={{ fields: [{ key: 'blood_type', label: 'blood type', from: 'O+', to: 'AB-' }] }} />,
    )
    expect(getByText('What changed')).toBeInTheDocument()
  })
})
