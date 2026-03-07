import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import HistoryTab from './HistoryTab'
import type { AgentState } from '@shared/types/agent.types'
import type { HistoryEntry } from '@shared/types/history.types'

const mockHistoryGet = vi.fn()
const mockHistorySearch = vi.fn()

// Mock clipboard
const mockClipboardWrite = vi.fn().mockResolvedValue(undefined)

// Mock URL
const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
const mockRevokeObjectURL = vi.fn()

// Mock ResizeObserver for virtualized list
const originalResizeObserver = globalThis.ResizeObserver

class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

beforeAll(() => {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

  Object.defineProperty(window, 'agentHub', {
    value: {
      history: {
        get: mockHistoryGet,
        search: mockHistorySearch
      }
    },
    writable: true
  })

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: mockClipboardWrite },
    writable: true
  })

  globalThis.URL.createObjectURL = mockCreateObjectURL
  globalThis.URL.revokeObjectURL = mockRevokeObjectURL
})

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver
})

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    name: 'test-agent',
    status: 'busy',
    statusConfidence: 'confirmed',
    cwd: '/test/repo',
    repoId: 'repo-1',
    model: 'claude-sonnet-4-20250514',
    taskDescription: 'Test task',
    createdAt: new Date().toISOString(),
    color: '#3B82F6',
    ...overrides
  }
}

function createMockEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 1,
    agentId: 'agent-1',
    content: 'Test output content',
    createdAt: '2026-03-06T10:30:00.000Z',
    ...overrides
  }
}

describe('HistoryTab', () => {
  const mockAgent = createMockAgent()

  beforeEach(() => {
    vi.clearAllMocks()
    mockHistoryGet.mockResolvedValue({ success: true, data: [] })
    mockHistorySearch.mockResolvedValue({ success: true, data: [] })
  })

  it('renders export button', async () => {
    render(<HistoryTab agent={mockAgent} />)
    await waitFor(() => {
      expect(screen.getByTestId('history-export')).toBeInTheDocument()
    })
  })

  it('renders copy button', async () => {
    render(<HistoryTab agent={mockAgent} />)
    await waitFor(() => {
      expect(screen.getByTestId('history-copy')).toBeInTheDocument()
    })
  })

  it('clicking export creates and downloads markdown file', async () => {
    const entries = [createMockEntry({ content: 'Hello world' })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.queryByText('No output recorded yet')).not.toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('history-export'))
    })

    // Verify Blob URL was created and revoked
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('clicking copy copies text to clipboard', async () => {
    const entries = [createMockEntry({ content: 'Copy this' })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.queryByText('No output recorded yet')).not.toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('history-copy'))
    })

    expect(mockClipboardWrite).toHaveBeenCalledWith(
      expect.stringContaining('Copy this')
    )
  })

  it('copy button shows "Copied!" feedback temporarily', async () => {
    const entries = [createMockEntry()]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.queryByText('No output recorded yet')).not.toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('history-copy'))
    })

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument()
    })
  })

  it('long entries are collapsed by default (> 500 chars)', async () => {
    const longContent = 'a'.repeat(600) // > 500 chars
    const entries = [createMockEntry({ content: longContent })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      // Should show "Show more" button
      expect(screen.getByText(/Show more/)).toBeInTheDocument()
    })
  })

  it('clicking "Show more" expands collapsed entry', async () => {
    const longContent = 'line1\nline2\nline3\nline4\n' + 'x'.repeat(500)
    const entries = [createMockEntry({ id: 42, content: longContent })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.getByText(/Show more/)).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByTestId('expand-toggle-42'))
    })

    expect(screen.getByText('Show less')).toBeInTheDocument()
  })

  it('clicking "Show less" collapses expanded entry', async () => {
    const longContent = 'line1\nline2\nline3\nline4\n' + 'x'.repeat(500)
    const entries = [createMockEntry({ id: 42, content: longContent })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.getByText(/Show more/)).toBeInTheDocument()
    })

    // Expand
    await act(async () => {
      fireEvent.click(screen.getByTestId('expand-toggle-42'))
    })
    expect(screen.getByText('Show less')).toBeInTheDocument()

    // Collapse
    await act(async () => {
      fireEvent.click(screen.getByTestId('expand-toggle-42'))
    })
    expect(screen.getByText(/Show more/)).toBeInTheDocument()
  })

  it('timeline marker shows green dot for first entry', async () => {
    const entries = [
      createMockEntry({ id: 1, content: 'First entry' }),
      createMockEntry({ id: 2, content: 'Second entry' })
    ]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      const marker = screen.getByTestId('timeline-marker-0')
      expect(marker.className).toContain('bg-success')
    })
  })

  it('timeline marker shows red dot for error entries', async () => {
    const entries = [
      createMockEntry({ id: 1, content: 'Starting...' }),
      createMockEntry({ id: 2, content: 'Error: something went wrong' }),
      createMockEntry({ id: 3, content: 'Done' })
    ]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      const marker = screen.getByTestId('timeline-marker-1')
      expect(marker.className).toContain('bg-error')
    })
  })

  it('short entries are not collapsed', async () => {
    const entries = [createMockEntry({ content: 'short text' })]
    mockHistoryGet.mockResolvedValue({ success: true, data: entries })

    render(<HistoryTab agent={mockAgent} />)

    await waitFor(() => {
      expect(screen.getByText('short text')).toBeInTheDocument()
      expect(screen.queryByText(/Show more/)).not.toBeInTheDocument()
    })
  })

  describe('Virtualized list', () => {
    function generateManyEntries(count: number): HistoryEntry[] {
      return Array.from({ length: count }, (_, i) =>
        createMockEntry({
          id: i + 1,
          content: `Entry number ${i + 1}`,
          createdAt: `2026-03-06T10:${String(i % 60).padStart(2, '0')}:00.000Z`
        })
      )
    }

    it('renders virtualized list container with many items', async () => {
      const entries = generateManyEntries(100)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        expect(screen.getByTestId('virtualized-list-container')).toBeInTheDocument()
      })
    })

    it('sets spacer height to total items * item height', async () => {
      const entries = generateManyEntries(200)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        const spacer = screen.getByTestId('virtualized-list-spacer')
        // 200 entries * 60px ITEM_HEIGHT = 12000px
        expect(spacer.style.height).toBe('12000px')
      })
    })

    it('does not render all items at once for a large list', async () => {
      const entries = generateManyEntries(1000)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        expect(screen.getByTestId('virtualized-list-container')).toBeInTheDocument()
      })

      // With default containerHeight=400 and ITEM_HEIGHT=60, visible count is
      // ceil(400/60) + BUFFER*2 = 7 + 10 = 17 at most (minus clamped start buffer)
      // Certainly far fewer than 1000
      const renderedEntries = screen.getAllByTestId(/^history-entry-/)
      expect(renderedEntries.length).toBeLessThan(1000)
      expect(renderedEntries.length).toBeLessThan(50)
    })

    it('renders correct entries in the visible window', async () => {
      const entries = generateManyEntries(100)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        // First entry should be visible (scrollTop=0, so startIndex=0)
        expect(screen.getByTestId('history-entry-1')).toBeInTheDocument()
      })

      // Entry 1 content should be visible
      expect(screen.getByText('Entry number 1')).toBeInTheDocument()
    })

    it('does not render entries far outside the visible window', async () => {
      const entries = generateManyEntries(500)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        expect(screen.getByTestId('virtualized-list-container')).toBeInTheDocument()
      })

      // With scrollTop=0 and containerHeight=400, entries near the end
      // (e.g., entry 500) should not be rendered
      expect(screen.queryByTestId('history-entry-500')).not.toBeInTheDocument()
      expect(screen.queryByText('Entry number 500')).not.toBeInTheDocument()
    })

    it('renders the virtualized list window div with correct position', async () => {
      const entries = generateManyEntries(50)
      mockHistoryGet.mockResolvedValue({ success: true, data: entries })

      render(<HistoryTab agent={mockAgent} />)

      await waitFor(() => {
        const window = screen.getByTestId('virtualized-list-window')
        // At scrollTop=0, startIndex=max(0, floor(0/60)-5)=0
        expect(window.style.top).toBe('0px')
      })
    })
  })
})
