import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BacklogByRepo from './BacklogByRepo'
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
    status: 'backlog',
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
})

describe('BacklogByRepo', () => {
  const defaultProps = {
    repos,
    onAddRepo: vi.fn(),
    onDragStart: vi.fn(),
    onCreateTask: vi.fn()
  }

  it('renders empty state when no backlog tasks', () => {
    render(<BacklogByRepo {...defaultProps} />)
    expect(screen.getByTestId('backlog-by-repo')).toBeInTheDocument()
    expect(screen.getByText(/No backlog tasks/)).toBeInTheDocument()
  })

  it('renders Add Repo button', () => {
    render(<BacklogByRepo {...defaultProps} />)
    const btn = screen.getByTestId('add-repo-btn')
    fireEvent.click(btn)
    expect(defaultProps.onAddRepo).toHaveBeenCalled()
  })

  it('renders repo groups with priority counts', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', repoId: 'repo-1', priority: 1, status: 'backlog' }),
        makeTask({ id: 't2', repoId: 'repo-1', priority: 2, status: 'backlog' }),
        makeTask({ id: 't3', repoId: 'repo-2', priority: 3, status: 'backlog' })
      ]
    })
    render(<BacklogByRepo {...defaultProps} />)
    expect(screen.getByText('Frontend')).toBeInTheDocument()
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('P1:1')).toBeInTheDocument()
    expect(screen.getByText('P2:1')).toBeInTheDocument()
  })

  it('excludes non-backlog tasks from groups', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', repoId: 'repo-1', status: 'today' }),
        makeTask({ id: 't2', repoId: 'repo-1', status: 'completed' })
      ]
    })
    render(<BacklogByRepo {...defaultProps} />)
    expect(screen.getByText(/No backlog tasks/)).toBeInTheDocument()
  })

  it('expands repo group on click to show tasks', () => {
    useTaskStore.setState({
      tasks: [makeTask({ id: 't1', repoId: 'repo-1', title: 'Fix bug', status: 'backlog' })]
    })
    render(<BacklogByRepo {...defaultProps} />)

    // Tasks not visible initially
    expect(screen.queryByText('Fix bug')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))
    expect(screen.getByText('Fix bug')).toBeInTheDocument()
  })

  it('collapses repo group on second click', () => {
    useTaskStore.setState({
      tasks: [makeTask({ id: 't1', repoId: 'repo-1', title: 'Fix bug', status: 'backlog' })]
    })
    render(<BacklogByRepo {...defaultProps} />)

    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))
    expect(screen.getByText('Fix bug')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))
    expect(screen.queryByText('Fix bug')).not.toBeInTheDocument()
  })

  it('shows priority badges on expanded tasks', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', repoId: 'repo-1', priority: 1, title: 'Urgent', status: 'backlog' }),
        makeTask({ id: 't2', repoId: 'repo-1', priority: 3, title: 'Low prio', status: 'backlog' })
      ]
    })
    render(<BacklogByRepo {...defaultProps} />)
    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))

    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Low prio')).toBeInTheDocument()
  })

  it('makes tasks draggable', () => {
    useTaskStore.setState({
      tasks: [makeTask({ id: 't1', repoId: 'repo-1', title: 'Draggable', status: 'backlog' })]
    })
    render(<BacklogByRepo {...defaultProps} />)
    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))

    const taskEl = screen.getByTestId('backlog-task-t1')
    expect(taskEl).toHaveAttribute('draggable', 'true')
  })

  it('sets drag data on dragStart', () => {
    const task = makeTask({ id: 't1', repoId: 'repo-1', title: 'Draggable', status: 'backlog' })
    useTaskStore.setState({ tasks: [task] })
    render(<BacklogByRepo {...defaultProps} />)
    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))

    const taskEl = screen.getByTestId('backlog-task-t1')
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' }
    fireEvent.dragStart(taskEl, { dataTransfer })
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      'application/agenthub-task',
      JSON.stringify(task)
    )
  })

  it('shows + New Task button when onCreateTask provided', () => {
    useTaskStore.setState({
      tasks: [makeTask({ id: 't1', repoId: 'repo-1', status: 'backlog' })]
    })
    render(<BacklogByRepo {...defaultProps} />)
    fireEvent.click(screen.getByTestId('backlog-toggle-repo-1'))

    const addBtn = screen.getByTestId('add-task-btn-repo-1')
    fireEvent.click(addBtn)
    expect(defaultProps.onCreateTask).toHaveBeenCalledWith('repo-1')
  })

  it('renders multiple repo groups', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', repoId: 'repo-1', status: 'backlog' }),
        makeTask({ id: 't2', repoId: 'repo-2', status: 'backlog' })
      ]
    })
    render(<BacklogByRepo {...defaultProps} />)
    expect(screen.getByTestId('backlog-group-repo-1')).toBeInTheDocument()
    expect(screen.getByTestId('backlog-group-repo-2')).toBeInTheDocument()
  })
})
