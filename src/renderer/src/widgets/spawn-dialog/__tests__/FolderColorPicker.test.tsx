import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FolderColorPicker from '../FolderColorPicker'

describe('FolderColorPicker', () => {
  it('renders color swatches from palette', () => {
    render(<FolderColorPicker currentColor="#89b4fa" onSelect={vi.fn()} onClose={vi.fn()} />)
    const swatches = screen.getAllByRole('button')
    expect(swatches.length).toBeGreaterThanOrEqual(8)
  })

  it('calls onSelect with chosen color', () => {
    const onSelect = vi.fn()
    render(<FolderColorPicker currentColor="#89b4fa" onSelect={onSelect} onClose={vi.fn()} />)
    const swatches = screen.getAllByRole('button')
    fireEvent.click(swatches[2])
    expect(onSelect).toHaveBeenCalled()
  })
})
