import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProjectMemoryPanel } from './ProjectMemoryPanel'
import type { WorkspaceMemoryEntry } from '@shared/types/workspace-memory.types'

const mockList = vi.fn()
const mockPin = vi.fn()
const mockUnpin = vi.fn()

beforeAll(() => {
  Object.defineProperty(window, 'agentHub', {
    value: {
      workspaceMemory: { list: mockList, pin: mockPin, unpin: mockUnpin }
    },
    writable: true
  })
})

beforeEach(() => {
  mockList.mockClear()
  mockPin.mockClear()
  mockUnpin.mockClear()
})

describe('ProjectMemoryPanel', () => {
  it('renders Layer 1 info bar and "No pinned learnings" when list returns empty', async () => {
    mockList.mockResolvedValue({ success: true, data: [] })

    render(<ProjectMemoryPanel projectId="p1" />)

    // Wait for the async list call
    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith('p1')
    })

    // Assert Layer 1 info is visible
    expect(screen.getByText(/Layer 1 session SBARs are auto-included at every agent spawn/i)).toBeInTheDocument()

    // Assert "No pinned learnings yet" is visible
    expect(screen.getByText(/No pinned learnings yet/i)).toBeInTheDocument()
  })

  it('lists existing entries with unpin button', async () => {
    const entry: WorkspaceMemoryEntry = {
      id: 'e1',
      projectId: 'p1',
      content: 'Learn X',
      createdAt: '2026-01-01T00:00:00Z',
      pinnedAt: '2026-01-01T00:00:00Z',
      sourceId: null,
      anamnesisId: null,
      syncedToAnamnesis: 0
    }

    mockList.mockResolvedValue({ success: true, data: [entry] })

    render(<ProjectMemoryPanel projectId="p1" />)

    // Wait for the async list call
    await waitFor(() => {
      expect(screen.getByText(/Learn X/)).toBeInTheDocument()
    })

    // Assert entry content is visible
    expect(screen.getByText(/Learn X/)).toBeInTheDocument()

    // Assert unpin button is present
    const unpinButton = screen.getByLabelText('Unpin')
    expect(unpinButton).toBeInTheDocument()
  })

  it('pin flow — calls pin, re-fetches list', async () => {
    const newEntry: WorkspaceMemoryEntry = {
      id: 'e2',
      projectId: 'p1',
      content: 'New learning',
      createdAt: '2026-01-01T00:00:00Z',
      pinnedAt: '2026-01-01T00:00:00Z',
      sourceId: null,
      anamnesisId: null,
      syncedToAnamnesis: 0
    }

    mockList
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({ success: true, data: [newEntry] })

    mockPin.mockResolvedValue({ success: true, data: newEntry })

    render(<ProjectMemoryPanel projectId="p1" />)

    // Wait for initial list call
    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith('p1')
    })

    // Type "New learning" into the textarea
    const textarea = screen.getByPlaceholderText(/Add a learning to pin/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'New learning' } })

    // Click "Pin" button
    const pinButton = screen.getByRole('button', { name: /Pin/i })
    fireEvent.click(pinButton)

    // Assert mockPin was called with correct args
    await waitFor(() => {
      expect(mockPin).toHaveBeenCalledWith('p1', 'New learning')
    })

    // Assert mockList was called a second time (re-fetch after pin)
    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2)
    })
  })

  it('unpin flow — calls unpin, re-fetches list', async () => {
    const entry: WorkspaceMemoryEntry = {
      id: 'e1',
      projectId: 'p1',
      content: 'Old note',
      createdAt: '2026-01-01T00:00:00Z',
      pinnedAt: '2026-01-01T00:00:00Z',
      sourceId: null,
      anamnesisId: null,
      syncedToAnamnesis: 0
    }

    mockList
      .mockResolvedValueOnce({ success: true, data: [entry] })
      .mockResolvedValueOnce({ success: true, data: [] })

    mockUnpin.mockResolvedValue({ success: true })

    render(<ProjectMemoryPanel projectId="p1" />)

    // Wait for initial list call
    await waitFor(() => {
      expect(screen.getByText(/Old note/)).toBeInTheDocument()
    })

    // Click the Unpin button
    const unpinButton = screen.getByLabelText('Unpin')
    fireEvent.click(unpinButton)

    // Assert mockUnpin was called with correct id
    await waitFor(() => {
      expect(mockUnpin).toHaveBeenCalledWith('e1')
    })

    // Assert mockList was called a second time
    await waitFor(() => {
      expect(mockList).toHaveBeenCalledTimes(2)
    })
  })
})
