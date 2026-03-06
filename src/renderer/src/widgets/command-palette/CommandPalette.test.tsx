import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CommandPalette from './CommandPalette'
import type { SearchResult } from '@shared/types/search.types'

const mockResults: SearchResult[] = [
  { type: 'agent', id: 'a1', title: 'Fix OAuth', subtitle: 'payment-service — busy', score: 1 },
  { type: 'task', id: 't1', title: 'Add tests', subtitle: 'Frontend — P2 — backlog', score: 1 },
  { type: 'repo', id: 'r1', title: 'api-gateway', subtitle: '/workspace/api-gateway', score: 1 }
]

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.agentHub = {
    search: {
      query: vi.fn().mockResolvedValue({ success: true, data: mockResults })
    }
  } as any
})

afterEach(() => {
  vi.useRealTimers()
})

describe('CommandPalette', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelectResult: vi.fn()
  }

  it('renders when open', () => {
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByTestId('command-palette')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<CommandPalette {...defaultProps} open={false} />)
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
  })

  it('has an input field', () => {
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByTestId('command-palette-input')).toBeInTheDocument()
  })

  it('shows placeholder text when empty', () => {
    render(<CommandPalette {...defaultProps} />)
    expect(screen.getByText(/Type to search/)).toBeInTheDocument()
  })

  it('searches on input with debounce', async () => {
    render(<CommandPalette {...defaultProps} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'auth' } })
      vi.advanceTimersByTime(200)
    })

    expect(window.agentHub.search.query).toHaveBeenCalledWith('auth')
  })

  it('displays categorized results', async () => {
    render(<CommandPalette {...defaultProps} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'query' } })
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByTestId('search-result-agent-a1')).toBeInTheDocument()
    expect(screen.getByTestId('search-result-task-t1')).toBeInTheDocument()
    expect(screen.getByTestId('search-result-repo-r1')).toBeInTheDocument()
  })

  it('shows "No results" for empty search results', async () => {
    window.agentHub.search.query = vi.fn().mockResolvedValue({ success: true, data: [] })

    render(<CommandPalette {...defaultProps} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'nonexistent' } })
      vi.advanceTimersByTime(200)
    })

    expect(screen.getByText(/No results for/)).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<CommandPalette {...defaultProps} onClose={onClose} />)
    const input = screen.getByTestId('command-palette-input')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes on overlay click', () => {
    const onClose = vi.fn()
    render(<CommandPalette {...defaultProps} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('command-palette-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('selects result on Enter', async () => {
    const onSelectResult = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} onSelectResult={onSelectResult} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[0])
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates results with arrow keys', async () => {
    const onSelectResult = vi.fn()
    const onClose = vi.fn()
    render(<CommandPalette open={true} onClose={onClose} onSelectResult={onSelectResult} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[1])
  })

  it('does not go past last result with ArrowDown', async () => {
    const onSelectResult = vi.fn()
    render(<CommandPalette open={true} onClose={vi.fn()} onSelectResult={onSelectResult} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    // Press down more times than results
    for (let i = 0; i < 10; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' })
    }
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[2])
  })

  it('does not go past first result with ArrowUp', async () => {
    const onSelectResult = vi.fn()
    render(<CommandPalette open={true} onClose={vi.fn()} onSelectResult={onSelectResult} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[0])
  })

  it('calls onSelectResult when result is clicked', async () => {
    const onSelectResult = vi.fn()
    render(<CommandPalette open={true} onClose={vi.fn()} onSelectResult={onSelectResult} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    fireEvent.click(screen.getByTestId('search-result-task-t1'))
    expect(onSelectResult).toHaveBeenCalledWith(mockResults[1])
  })

  it('resets state when reopened', async () => {
    const { rerender } = render(<CommandPalette {...defaultProps} />)
    const input = screen.getByTestId('command-palette-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
      vi.advanceTimersByTime(200)
    })

    // Close and reopen
    rerender(<CommandPalette {...defaultProps} open={false} />)
    rerender(<CommandPalette {...defaultProps} open={true} />)

    const newInput = screen.getByTestId('command-palette-input')
    expect((newInput as HTMLInputElement).value).toBe('')
  })
})

// Import afterEach for timer cleanup
import { afterEach } from 'vitest'
