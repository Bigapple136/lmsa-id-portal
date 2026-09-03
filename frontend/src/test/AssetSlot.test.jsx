import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AssetSlot from '../components/AssetSlot'

const base = {
  id: 'photo-input',
  label: 'Photo',
  accept: '.jpg,.png',
  onPick: vi.fn(),
  onRemove: vi.fn(),
  onUndo: vi.fn(),
}

describe('AssetSlot', () => {
  it('shows the upload affordance and no Remove button when nothing is on file', () => {
    render(<AssetSlot {...base} currentUrl={null} stagedFile={null} markedForRemoval={false} />)
    expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument()
  })

  it('offers Remove when a current file exists and calls onRemove', () => {
    const onRemove = vi.fn()
    render(
      <AssetSlot
        {...base}
        onRemove={onRemove}
        currentUrl="https://cdn/photo.jpg?v=1"
        stagedFile={null}
        markedForRemoval={false}
      />,
    )
    const remove = screen.getByRole('button', { name: /remove photo/i })
    fireEvent.click(remove)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('switches to the removing state with an Undo action and a notice', () => {
    const onUndo = vi.fn()
    render(
      <AssetSlot
        {...base}
        onUndo={onUndo}
        currentUrl="https://cdn/photo.jpg?v=1"
        stagedFile={null}
        markedForRemoval
      />,
    )
    expect(screen.getByText(/will be removed on save/i)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/deleted from storage when you save/i)
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /undo removal of photo/i }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('shows the staged filename with an Undo action when a new file is picked', () => {
    const onUndo = vi.fn()
    const file = new File(['x'], 'new-portrait.jpg', { type: 'image/jpeg' })
    render(
      <AssetSlot
        {...base}
        onUndo={onUndo}
        currentUrl="https://cdn/photo.jpg?v=1"
        stagedFile={file}
        markedForRemoval={false}
      />,
    )
    expect(screen.getByText('new-portrait.jpg')).toBeInTheDocument()
    expect(screen.getByText(/ready to upload/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /undo replacement of photo/i }))
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('forwards a picked file to onPick', () => {
    const onPick = vi.fn()
    const { container } = render(
      <AssetSlot {...base} onPick={onPick} currentUrl={null} stagedFile={null} markedForRemoval={false} />,
    )
    const input = container.querySelector('input[type="file"]')
    const file = new File(['x'], 'sig.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onPick).toHaveBeenCalledWith(file)
  })

  it('has a keyboard-operable drop zone', () => {
    const { container } = render(
      <AssetSlot {...base} currentUrl={null} stagedFile={null} markedForRemoval={false} />,
    )
    const input = container.querySelector('input[type="file"]')
    const click = vi.spyOn(input, 'click')
    const zone = screen.getByRole('button', { name: /upload photo/i })
    expect(zone).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(zone, { key: 'Enter' })
    expect(click).toHaveBeenCalled()
  })
})
