import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TruncatedText } from './TruncatedText'

describe('TruncatedText', () => {
  it('renders full text when under maxLength', () => {
    render(<TruncatedText text="short text" maxLength={200} />)
    expect(screen.getByText('short text')).toBeDefined()
    expect(screen.queryByTestId('truncated-toggle')).toBeNull()
  })

  it('truncates text over maxLength and shows See more', () => {
    const long = 'x'.repeat(300)
    render(<TruncatedText text={long} maxLength={200} />)
    expect(screen.getByTestId('truncated-toggle')).toBeDefined()
    expect(screen.getByTestId('truncated-toggle').textContent).toBe('See more')
    // Should show truncated content + "..."
    expect(screen.getByText(/\.\.\./).textContent).toContain('x'.repeat(200))
  })

  it('expands on click and shows See less', () => {
    const long = 'y'.repeat(300)
    render(<TruncatedText text={long} maxLength={200} />)
    fireEvent.click(screen.getByTestId('truncated-toggle'))
    expect(screen.getByTestId('truncated-toggle').textContent).toBe('See less')
  })

  it('collapses back on second click', () => {
    const long = 'z'.repeat(300)
    render(<TruncatedText text={long} maxLength={200} />)
    fireEvent.click(screen.getByTestId('truncated-toggle'))
    fireEvent.click(screen.getByTestId('truncated-toggle'))
    expect(screen.getByTestId('truncated-toggle').textContent).toBe('See more')
  })

  it('uses default maxLength of 200', () => {
    const exactly200 = 'a'.repeat(200)
    render(<TruncatedText text={exactly200} />)
    expect(screen.queryByTestId('truncated-toggle')).toBeNull()

    const over200 = 'b'.repeat(201)
    const { container } = render(<TruncatedText text={over200} />)
    expect(container.querySelector('[data-testid="truncated-toggle"]')).toBeDefined()
  })
})
