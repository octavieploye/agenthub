import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TodaysPlan from './TodaysPlan'
import { useTaskStore } from '@renderer/stores/task-store'
import type { TaskItem } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'

function makeTask(overrides: Partial<TaskItem> = {}): TaskItem {
  return {
    id: 'task-1',
    repoId: 'repo-1',
    title: 'Test task',
    description: '',
    priority: 3,
    status: 'today',
    agentId: null,
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    ...overrides
  }
}

const repos: RepoConfig[] = [
  { id: 'repo-1', name: 'Frontend', path: '/tmp/frontend', createdAt: '' },
  { id: 'repo-2', name: 'Backend', path: '/tmp/backend', createdAt: '' }
]

beforeEach(() => {
  useTaskStore.setState({ tasks: [], loading: false, error: null })
  window.agentHub = {
    tasks: {
      update: vi.fn().mockResolvedValue({ success: true, data: undefined }),
      create: vi.fn().mockResolvedValue({
        success: true,
        data: makeTask({ id: 'new-1', title: 'New task' })
      })
    }
  } as any
})

describe('TodaysPlan', () => {
  const defaultProps = {
    repos,
    onLaunchTask: vi.fn()
  }

  it('renders component', () => {
    render(<TodaysPlan {...defaultProps} />)
    expect(screen.getByTestId('todays-plan')).toBeInTheDocument()
  })

  it('shows empty state when no today tasks', () => {
    render(<TodaysPlan {...defaultProps} />)
    expect(screen.getByText(/Drag tasks from Backlog/)).toBeInTheDocument()
  })

  it('renders today tasks with priority badges', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', title: 'Fix auth', priority: 1, status: 'today' }),
        makeTask({ id: 't2', title: 'Add docs', priority: 3, status: 'today' })
      ]
    })
    render(<TodaysPlan {...defaultProps} />)
    expect(screen.getByText('Fix auth')).toBeInTheDocument()
    expect(screen.getByText('Add docs')).toBeInTheDocument()
  })

  it('only shows tasks with status=today', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', title: 'Today task', status: 'today' }),
        makeTask({ id: 't2', title: 'Backlog task', status: 'backlog' })
      ]
    })
    render(<TodaysPlan {...defaultProps} />)
    expect(screen.getByText('Today task')).toBeInTheDocument()
    expect(screen.queryByText('Backlog task')).not.toBeInTheDocument()
  })

  it('shows Launch button when onLaunchTask provided', () => {
    useTaskStore.setState({
      tasks: [makeTask({ id: 't1', status: 'today' })]
    })
    render(<TodaysPlan {...defaultProps} />)
    const btn = screen.getByTestId('launch-task-t1')
    expect(btn).toBeInTheDocument()
  })

  it('calls onLaunchTask when Launch clicked', () => {
    const task = makeTask({ id: 't1', status: 'today' })
    useTaskStore.setState({ tasks: [task] })
    const onLaunchTask = vi.fn()
    render(<TodaysPlan repos={repos} onLaunchTask={onLaunchTask} />)
    fireEvent.click(screen.getByTestId('launch-task-t1'))
    expect(onLaunchTask).toHaveBeenCalledWith(task)
  })

  describe('drop zone', () => {
    it('highlights on drag over', () => {
      render(<TodaysPlan {...defaultProps} />)
      const zone = screen.getByTestId('todays-plan-dropzone')
      fireEvent.dragOver(zone, { dataTransfer: { dropEffect: '' } })
      expect(zone.className).toContain('ring-2')
    })

    it('removes highlight on drag leave', () => {
      render(<TodaysPlan {...defaultProps} />)
      const zone = screen.getByTestId('todays-plan-dropzone')
      fireEvent.dragOver(zone, { dataTransfer: { dropEffect: '' } })
      fireEvent.dragLeave(zone)
      expect(zone.className).not.toContain('ring-2')
    })

    it('updates task status on drop', async () => {
      const task = makeTask({ id: 't1', status: 'backlog' })
      useTaskStore.setState({ tasks: [task] })
      render(<TodaysPlan {...defaultProps} />)
      const zone = screen.getByTestId('todays-plan-dropzone')

      fireEvent.drop(zone, {
        dataTransfer: {
          getData: () => JSON.stringify(task)
        }
      })

      expect(window.agentHub.tasks.update).toHaveBeenCalledWith('t1', { status: 'today' })
    })

    it('handles invalid drop data gracefully', () => {
      render(<TodaysPlan {...defaultProps} />)
      const zone = screen.getByTestId('todays-plan-dropzone')
      fireEvent.drop(zone, {
        dataTransfer: { getData: () => '' }
      })
      // Should not throw
    })
  })

  describe('new task form', () => {
    it('shows form when + New Task clicked', () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))
      expect(screen.getByTestId('new-task-form')).toBeInTheDocument()
    })

    it('creates task on submit', async () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))

      const input = screen.getByTestId('new-task-input')
      fireEvent.change(input, { target: { value: 'New task' } })
      fireEvent.click(screen.getByTestId('new-task-submit'))

      expect(window.agentHub.tasks.create).toHaveBeenCalledWith({
        repoId: 'repo-1',
        title: 'New task',
        status: 'today'
      })
    })

    it('creates task on Enter key', async () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))

      const input = screen.getByTestId('new-task-input')
      fireEvent.change(input, { target: { value: 'Enter task' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(window.agentHub.tasks.create).toHaveBeenCalled()
    })

    it('hides form on Cancel', () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))
      expect(screen.getByTestId('new-task-form')).toBeInTheDocument()
      fireEvent.click(screen.getByTestId('new-task-cancel'))
      expect(screen.queryByTestId('new-task-form')).not.toBeInTheDocument()
    })

    it('hides form on Escape key', () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))
      const input = screen.getByTestId('new-task-input')
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.queryByTestId('new-task-form')).not.toBeInTheDocument()
    })

    it('does not create task with empty title', () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))
      fireEvent.click(screen.getByTestId('new-task-submit'))
      expect(window.agentHub.tasks.create).not.toHaveBeenCalled()
    })

    it('allows selecting repo for new task', () => {
      render(<TodaysPlan {...defaultProps} />)
      fireEvent.click(screen.getByTestId('new-task-btn'))
      const select = screen.getByTestId('new-task-repo-select')
      fireEvent.change(select, { target: { value: 'repo-2' } })

      const input = screen.getByTestId('new-task-input')
      fireEvent.change(input, { target: { value: 'Backend task' } })
      fireEvent.click(screen.getByTestId('new-task-submit'))

      expect(window.agentHub.tasks.create).toHaveBeenCalledWith({
        repoId: 'repo-2',
        title: 'Backend task',
        status: 'today'
      })
    })
  })
})
