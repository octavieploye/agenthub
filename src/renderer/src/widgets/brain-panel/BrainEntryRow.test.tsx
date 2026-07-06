import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrainEntryRow from './BrainEntryRow'
import type { BrainEntry } from '../../../../shared/types/brain.types'

// Mock window.agentHub
beforeAll(() => {
  Object.defineProperty(window, 'agentHub', {
    value: {
      system: {
        openPath: vi.fn()
      },
      brain: {
        query: vi.fn().mockResolvedValue([]),
        register: vi.fn(),
        updateStatus: vi.fn(),
        createTask: vi.fn(),
        timeline: vi.fn().mockResolvedValue([])
      }
    },
    writable: true
  })
})

// Mock useBrainStore so updateBrainEntryStatus is a no-op and never calls window.agentHub.brain
vi.mock('./brain-store', () => ({
  useBrainStore: () => ({
    updateBrainEntryStatus: vi.fn()
  })
}))

function createMockEntry(overrides: Partial<BrainEntry> = {}): BrainEntry {
  return {
    id: 'entry-1',
    repoId: 'repo-1',
    repoName: 'Test Repo',
    projectId: null,
    projectName: null,
    pointerPath: '/test/docs/brain/entry-1.md',
    artifactPath: '/test/docs/spec.md',
    type: 'spec',
    subject: 'Test Specification',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    note: null,
    tasksTotal: 0,
    tasksDone: 0,
    tasksInProgress: 0,
    computedStatus: 'remaining',
    checklistTotal: 0,
    checklistDone: 0,
    gitSignal: false,
    ...overrides
  }
}

describe('BrainEntryRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders computed status dot with correct class for remaining', () => {
    const entry = createMockEntry({ computedStatus: 'remaining' })
    const { container } = render(<BrainEntryRow entry={entry} />)
    const dot = container.querySelector('.bg-base-content\\/20')
    expect(dot).not.toBeNull()
  })

  it('renders computed status dot with correct class for done', () => {
    const entry = createMockEntry({ computedStatus: 'done' })
    const { container } = render(<BrainEntryRow entry={entry} />)
    const dot = container.querySelector('.bg-success')
    expect(dot).not.toBeNull()
  })

  it('renders checklist progress bar when checklistTotal > 0', () => {
    const entry = createMockEntry({ checklistTotal: 5, checklistDone: 2 })
    render(<BrainEntryRow entry={entry} />)
    expect(screen.getByText('2/5 checklist')).toBeInTheDocument()
  })

  it('does NOT render checklist progress bar when checklistTotal === 0', () => {
    const entry = createMockEntry({ checklistTotal: 0, checklistDone: 0 })
    render(<BrainEntryRow entry={entry} />)
    expect(screen.queryByText(/checklist/)).not.toBeInTheDocument()
  })

  it('renders the subject text', () => {
    const entry = createMockEntry({ subject: 'My Important Spec' })
    render(<BrainEntryRow entry={entry} />)
    expect(screen.getByText('My Important Spec')).toBeInTheDocument()
  })
})
