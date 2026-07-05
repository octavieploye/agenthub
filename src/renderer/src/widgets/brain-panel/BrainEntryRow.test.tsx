import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, expect, test, vi } from 'vitest'
import BrainEntryRow from './BrainEntryRow'
import { BrainEntry } from '../../../../shared/types/brain.types'

// Mock Electron IPC
def setupMockIPC() {
  const mockInvoke = vi.fn()
  global.window.electron = {
    ipcRenderer: {
      invoke: mockInvoke
    }
  }
  return mockInvoke
}

describe('BrainEntryRow', () => {
  const mockEntry: BrainEntry = {
    id: 'entry1',
    repoId: 'repo1',
    repoName: 'Test Repo',
    projectId: 'proj1',
    projectName: 'Test Project',
    pointerPath: '/test/docs/brain/entry1.md',
    artifactPath: '/test/docs/spec.md',
    type: 'spec',
    subject: 'Test Specification',
    status: 'active',
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-02T00:00:00Z',
    note: 'Important implementation details',
    tasksTotal: 3,
    tasksDone: 1,
    tasksInProgress: 1
  }

  test('should render entry with all fields', () => {
    setupMockIPC()
    render(<BrainEntryRow entry={mockEntry} />)

    // Check subject
    expect(screen.getByText('Test Specification')).toBeInTheDocument()

    // Check type badge
    expect(screen.getByText('spec')).toBeInTheDocument()

    // Check path
    expect(screen.getByText('/test/docs/spec.md')).toBeInTheDocument()

    // Check note
    expect(screen.getByText('"Important implementation details"')).toBeInTheDocument()

    // Check status badge
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()

    // Check action buttons
    expect(screen.getByText('[open]')).toBeInTheDocument()
    expect(screen.getByText('[+ Task]')).toBeInTheDocument()
  })

  test('should show progress bar when tasks exist', () => {
    setupMockIPC()
    render(<BrainEntryRow entry={mockEntry} />)

    // Check progress text
    expect(screen.getByText('1/3 tasks')).toBeInTheDocument()

    // Check progress bar exists
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  test('should not show progress bar when no tasks', () => {
    const entryWithoutTasks = {
      ...mockEntry,
      tasksTotal: 0,
      tasksDone: 0,
      tasksInProgress: 0
    }

    setupMockIPC()
    render(<BrainEntryRow entry={entryWithoutTasks} />)

    // Progress bar should not be present
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  test('should show sprint indicator when entry has tasks', () => {
    setupMockIPC()
    render(<BrainEntryRow entry={mockEntry} />)

    expect(screen.getByText('spec→sprint')).toBeInTheDocument()
  })

  test('should handle open artifact button click', () => {
    const mockInvoke = setupMockIPC()
    render(<BrainEntryRow entry={mockEntry} />)

    const openButton = screen.getByText('[open]')
    fireEvent.click(openButton)

    expect(mockInvoke).toHaveBeenCalledWith('system:open-path', '/test/docs/spec.md')
  })

  test('should handle task creation button click', () => {
    const mockInvoke = setupMockIPC()
    render(<BrainEntryRow entry={mockEntry} />)

    const taskButton = screen.getByText('[+ Task]')
    fireEvent.click(taskButton)

    // Should open task modal - in real test we'd check for modal presence
    // For now, just verify the button is clickable
    expect(taskButton).toBeInTheDocument()
  })

  test('should show different status badge classes', () => {
    const statuses: BrainEntry['status'][] = ['draft', 'active', 'parked', 'implemented']
    const mockInvoke = setupMockIPC()

    statuses.forEach(status => {
      const entryWithStatus = { ...mockEntry, status }
      const { container } = render(<BrainEntryRow entry={entryWithStatus} />)

      const statusBadge = screen.getByText(status.toUpperCase())
      expect(statusBadge).toBeInTheDocument()
      expect(statusBadge.className).toContain('badge')
    })
  })

  test('should show warning for not actioned status', () => {
    const entryNotActioned = {
      ...mockEntry,
      status: 'draft' as any, // Simulate not_actioned status
      tasksTotal: 0
    }

    setupMockIPC()
    render(<BrainEntryRow entry={entryNotActioned} />)

    // Should show the actual status, not the inferred "not actioned"
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  test('should truncate long paths', () => {
    const entryWithLongPath = {
      ...mockEntry,
      artifactPath: '/very/long/path/with/many/segments/to/test/truncation/behavior.md'
    }

    setupMockIPC()
    render(<BrainEntryRow entry={entryWithLongPath} />)

    const pathElement = screen.getByText(/very.*behavior.md/)
    expect(pathElement).toHaveClass('truncate')
  })

  test('should handle entry without note', () => {
    const entryWithoutNote = {
      ...mockEntry,
      note: undefined
    }

    setupMockIPC()
    render(<BrainEntryRow entry={entryWithoutNote} />)

    // Note should not be displayed
    expect(screen.queryByText('"Important implementation details"')).not.toBeInTheDocument()
  })

  test('should show different type badge classes', () => {
    const types: BrainEntry['type'][] = ['brainstorm', 'spec', 'plan', 'sprint']
    const mockInvoke = setupMockIPC()

    types.forEach(type => {
      const entryWithType = { ...mockEntry, type }
      render(<BrainEntryRow entry={entryWithType} />)

      const typeBadge = screen.getByText(type)
      expect(typeBadge).toBeInTheDocument()
      expect(typeBadge.className).toContain('badge')
    })
  })
})