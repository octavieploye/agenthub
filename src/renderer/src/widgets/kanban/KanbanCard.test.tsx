import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { KanbanCard } from './KanbanCard'
import type { TaskItem } from '@shared/types/task.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

const mockTask: TaskItem = {
  id: 'task-1',
  repoId: 'repo-1',
  title: 'Fix login bug',
  description: '',
  priority: 2,
  status: 'backlog',
  category: null,
  agentId: null,
  position: 0,
  sbarId: null,
  sprintName: null,
  epicName: null,
  projectId: null,
  sectionTargetDate: null,
  note: null,
  blockedBy: [],
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
}

describe('KanbanCard hover popover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 100, left: 50, right: 250, bottom: 150,
      width: 200, height: 50, x: 50, y: 100,
      toJSON: () => ({})
    } as DOMRect)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('shows popover after 900ms hover on card body', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    fireEvent.mouseEnter(cardBody)
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(900) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
  })

  it('does not show popover if mouse leaves card body before 900ms', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    fireEvent.mouseEnter(cardBody)
    await act(async () => { vi.advanceTimersByTime(400) })
    fireEvent.mouseLeave(cardBody)
    await act(async () => { vi.advanceTimersByTime(600) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('closes popover 150ms after mouse leaves both card body and popover', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    fireEvent.mouseEnter(cardBody)
    await act(async () => { vi.advanceTimersByTime(900) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    fireEvent.mouseLeave(cardBody)
    await act(async () => { vi.advanceTimersByTime(149) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('keeps popover open when mouse moves from card body into popover', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    fireEvent.mouseEnter(cardBody)
    await act(async () => { vi.advanceTimersByTime(900) })
    const popover = screen.getByTestId('card-popover')
    fireEvent.mouseLeave(cardBody)
    fireEvent.mouseEnter(popover)
    await act(async () => { vi.advanceTimersByTime(300) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
  })

  it('does not open popover when card is in inline edit mode', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByTitle('Edit task'))
    expect(screen.queryByTitle('Edit task')).not.toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(950) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('closes popover when inline edit is activated while popover is open', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    fireEvent.mouseEnter(cardBody)
    await act(async () => { vi.advanceTimersByTime(900) })
    expect(screen.getByTestId('card-popover')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Edit task'))
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('renders a drag handle strip with data-testid="drag-handle"', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} />)
    expect(screen.getByTestId('drag-handle')).toBeInTheDocument()
  })

  it('drag handle has draggable attribute', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} />)
    const handle = screen.getByTestId('drag-handle')
    expect(handle).toHaveAttribute('draggable', 'true')
  })

  it('card body does not have draggable attribute', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    expect(cardBody).not.toHaveAttribute('draggable')
  })

  it('hovering drag handle for 950ms does not open popover', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const handle = screen.getByTestId('drag-handle')
    fireEvent.mouseEnter(handle)
    await act(async () => { vi.advanceTimersByTime(950) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })

  it('drag start on handle cancels pending hover timer', async () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const cardBody = screen.getByTestId('card-body')
    const handle = screen.getByTestId('drag-handle')
    fireEvent.mouseEnter(cardBody)
    await act(async () => { vi.advanceTimersByTime(500) })
    fireEvent.dragStart(handle)
    await act(async () => { vi.advanceTimersByTime(500) })
    expect(screen.queryByTestId('card-popover')).not.toBeInTheDocument()
  })
})

describe('KanbanCard — agent status badge', () => {
  it('does not render status badge when agentId is null', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} />)
    expect(screen.queryByTestId('agent-status-badge')).not.toBeInTheDocument()
  })

  it('renders pulsing badge for busy agent', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(<KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="busy" onEdit={vi.fn()} />)
    const badge = screen.getByTestId('agent-status-badge')
    expect(badge).toBeInTheDocument()
    expect(badge.textContent).toContain('In Progress')
  })

  it('renders idle badge for idle agent', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(<KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="idle" onEdit={vi.fn()} />)
    const badge = screen.getByTestId('agent-status-badge')
    expect(badge.textContent).toContain('Idle')
  })

  it('renders stopped badge for interrupted agent', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(<KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="interrupted" onEdit={vi.fn()} />)
    const badge = screen.getByTestId('agent-status-badge')
    expect(badge.textContent).toContain('Stopped')
  })

  it('renders done badge for completed agent', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(<KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="completed" onEdit={vi.fn()} />)
    const badge = screen.getByTestId('agent-status-badge')
    expect(badge.textContent).toContain('Done')
  })
})

describe('KanbanCard — badge click navigation', () => {
  it('calls onBadgeClick when agent status badge is clicked', () => {
    const onBadgeClick = vi.fn()
    const task = { ...mockTask, agentId: 'agent-1' }
    render(
      <KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="busy" onEdit={vi.fn()} onBadgeClick={onBadgeClick} />
    )
    fireEvent.click(screen.getByTestId('agent-status-badge'))
    expect(onBadgeClick).toHaveBeenCalledOnce()
  })

  it('does not error when badge is clicked without onBadgeClick', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(
      <KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="busy" onEdit={vi.fn()} />
    )
    expect(() => fireEvent.click(screen.getByTestId('agent-status-badge'))).not.toThrow()
  })

  it('renders badge with cursor-pointer when onBadgeClick is provided', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(
      <KanbanCard task={task} agentColor="#3B82F6" agentName="Alpha" agentStatus="busy" onEdit={vi.fn()} onBadgeClick={vi.fn()} />
    )
    const badge = screen.getByTestId('agent-status-badge')
    expect(badge.className).toContain('cursor-pointer')
  })
})

describe('KanbanCard — dispatch icon', () => {
  it('renders dispatch icon on hover when onDispatch is provided, regardless of agentId', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} onDispatch={vi.fn()} />)
    expect(screen.getByTitle('Dispatch to agent')).toBeInTheDocument()
  })

  it('does not render dispatch icon when onDispatch is not provided', () => {
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByTitle('Dispatch to agent')).not.toBeInTheDocument()
  })

  it('calls onDispatch when dispatch icon is clicked', () => {
    const onDispatch = vi.fn()
    render(<KanbanCard task={mockTask} onEdit={vi.fn()} onDelete={vi.fn()} onDispatch={onDispatch} />)
    fireEvent.click(screen.getByTitle('Dispatch to agent'))
    expect(onDispatch).toHaveBeenCalledOnce()
  })
})

describe('KanbanCard pin action', () => {
  const mockPin = vi.fn()

  beforeEach(() => {
    mockPin.mockReset()
    Object.defineProperty(window, 'agentHub', {
      value: { workspaceMemory: { pin: mockPin } },
      writable: true
    })
  })

  it('shows pin button on completed cards with defaultProjectId', () => {
    const completedTask: TaskItem = { ...mockTask, status: 'completed' }
    render(<KanbanCard task={completedTask} defaultProjectId="proj-1" onEdit={vi.fn()} />)
    expect(screen.getByTestId('pin-button')).toBeInTheDocument()
  })

  it('does not show pin button on non-completed cards', () => {
    render(<KanbanCard task={mockTask} defaultProjectId="proj-1" onEdit={vi.fn()} />)
    expect(screen.queryByTestId('pin-button')).not.toBeInTheDocument()
  })

  it('does not show pin button when no defaultProjectId', () => {
    const completedTask: TaskItem = { ...mockTask, status: 'completed' }
    render(<KanbanCard task={completedTask} onEdit={vi.fn()} />)
    expect(screen.queryByTestId('pin-button')).not.toBeInTheDocument()
  })

  it('calls workspaceMemory.pin with title when task has no note', async () => {
    mockPin.mockResolvedValue({ success: true, data: {} })
    const completedTask: TaskItem = { ...mockTask, status: 'completed', note: null }
    render(<KanbanCard task={completedTask} defaultProjectId="proj-1" onEdit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('pin-button'))
    await vi.waitFor(() => expect(mockPin).toHaveBeenCalledWith('proj-1', 'Fix login bug'))
  })

  it('calls workspaceMemory.pin with title+note when task has a note', async () => {
    mockPin.mockResolvedValue({ success: true, data: {} })
    const completedTask: TaskItem = { ...mockTask, status: 'completed', note: 'Important detail' }
    render(<KanbanCard task={completedTask} defaultProjectId="proj-1" onEdit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('pin-button'))
    await vi.waitFor(() =>
      expect(mockPin).toHaveBeenCalledWith('proj-1', 'Fix login bug\nImportant detail')
    )
  })
})
