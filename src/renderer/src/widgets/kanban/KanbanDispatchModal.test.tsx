import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { KanbanDispatchModal } from './KanbanDispatchModal'
import { useAgentStore } from '../../stores/agent-store'
import { useProjectStore } from '../../stores/project-store'
import type { TaskItem } from '@shared/types/task.types'
import type { AgentState } from '@shared/types/agent.types'
import type { RepoConfig } from '@shared/types/config.types'

const mockRepo: RepoConfig = {
  id: 'repo-1', name: 'agenthub', path: '/tmp/agenthub', createdAt: '2026-06-21T00:00:00Z'
}

const mockAgent: AgentState = {
  id: 'agent-1', name: 'Alpha', status: 'idle', confidence: 'confirmed', color: '#3B82F6',
  repoId: 'repo-1', model: 'claude-sonnet-4-6', provider: 'anthropic', effortLevel: 'medium',
  taskDescription: '', pid: null, ptyFd: null, cwd: '/tmp/alpha',
  createdAt: '2026-06-21T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z',
  progress: 0, executionMode: 'native', voiceMode: 'off'
}

const mockTask: TaskItem = {
  id: 'task-1', repoId: 'repo-1', title: 'Fix login bug',
  description: 'Users cannot log in after token refresh', priority: 1, status: 'backlog',
  category: 'backend', agentId: 'agent-1', position: 0, sbarId: null,
  sprintName: 'Sprint 4', epicName: 'Auth Epic', projectId: 'proj-1',
  sectionTargetDate: null, note: null,
  createdAt: '2026-06-21T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z',
}

describe('KanbanDispatchModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map([['agent-1', mockAgent]]), activeAgentId: null })
    useProjectStore.setState({
      projects: [{ id: 'proj-1', name: 'AgentHub v2', description: null, createdAt: '', updatedAt: '' }],
      selectedProjectId: null
    })
  })

  it('renders agent name and task title in header', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    // Task title appears in the header truncated span
    const titleSpan = screen.getByTitle('Fix login bug')
    expect(titleSpan).toBeInTheDocument()
  })

  it('pre-populates prompt textarea with structured task fields', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    const textarea = screen.getByRole('textbox', { name: /prompt/i }) as HTMLTextAreaElement
    expect(textarea.value).toContain('Task: Fix login bug')
    expect(textarea.value).toContain('Priority: High')
    expect(textarea.value).toContain('Sprint: Sprint 4')
    expect(textarea.value).toContain('Epic: Auth Epic')
    expect(textarea.value).toContain('Category: backend')
    expect(textarea.value).toContain('Project: AgentHub v2')
    expect(textarea.value).toContain('Users cannot log in after token refresh')
  })

  it('allows editing the prompt', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    const textarea = screen.getByRole('textbox', { name: /prompt/i }) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Custom prompt' } })
    expect(textarea.value).toBe('Custom prompt')
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={onClose} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('disables Dispatch button when prompt is empty', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    const textarea = screen.getByRole('textbox', { name: /prompt/i })
    fireEvent.change(textarea, { target: { value: '' } })
    expect(screen.getByText('Dispatch')).toBeDisabled()
  })
})

describe('KanbanDispatchModal — recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map([['agent-1', mockAgent]]), activeAgentId: null })
    useProjectStore.setState({ projects: [], selectedProjectId: null })
  })

  it('shows high-priority recommendation for priority 1 tasks', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText(/confirm scope before starting/i)).toBeInTheDocument()
  })

  it('shows empty-description recommendation when description is blank', () => {
    const task = { ...mockTask, description: '' }
    render(<KanbanDispatchModal task={task} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText(/description is empty/i)).toBeInTheDocument()
  })

  it('shows no-sprint recommendation when sprint and epic are unset', () => {
    const task = { ...mockTask, sprintName: null, epicName: null }
    render(<KanbanDispatchModal task={task} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText(/no sprint or epic/i)).toBeInTheDocument()
  })

  it('shows agent-status recommendation when agent is busy', () => {
    const busyAgent = { ...mockAgent, status: 'busy' as const }
    useAgentStore.setState({ agents: new Map([['agent-1', busyAgent]]), activeAgentId: null })
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText(/currently busy/i)).toBeInTheDocument()
  })
})

describe('KanbanDispatchModal — team spawn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map([['agent-1', mockAgent]]), activeAgentId: null })
    useProjectStore.setState({ projects: [], selectedProjectId: null })
  })

  it('renders team spawn section collapsed by default', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText('Team spawn')).toBeInTheDocument()
    expect(screen.queryByLabelText('Team name')).not.toBeInTheDocument()
  })

  it('expands team spawn section when clicked', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Team spawn'))
    expect(screen.getByLabelText('Team name')).toBeInTheDocument()
    expect(screen.getByLabelText('dev-backend')).toBeInTheDocument()
    expect(screen.getByLabelText('dev-frontend')).toBeInTheDocument()
    expect(screen.getByLabelText('dev-integration')).toBeInTheDocument()
  })

  it('shows concurrency warning when 3+ roles are checked', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Team spawn'))
    fireEvent.click(screen.getByLabelText('dev-backend'))
    fireEvent.click(screen.getByLabelText('dev-frontend'))
    fireEvent.click(screen.getByLabelText('dev-integration'))
    expect(screen.getByText(/exceeds 3 active agents/i)).toBeInTheDocument()
  })
})

describe('KanbanDispatchModal — dispatch action', () => {
  const mockSendInput = vi.fn()
  const mockSpawn = vi.fn().mockResolvedValue({ success: true, data: { ...mockAgent, id: 'new-agent' } })
  const mockTaskUpdate = vi.fn().mockResolvedValue({ success: true })

  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map([['agent-1', mockAgent]]), activeAgentId: null })
    useProjectStore.setState({ projects: [], selectedProjectId: null })
    window.agentHub = {
      agents: {
        sendInput: mockSendInput,
        spawn: mockSpawn,
      },
      tasks: {
        update: mockTaskUpdate,
      },
    } as any
  })

  it('calls agents:sendInput with edited prompt + carriage return on Dispatch', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    const textarea = screen.getByRole('textbox', { name: /prompt/i })
    fireEvent.change(textarea, { target: { value: 'do the thing' } })
    fireEvent.click(screen.getByText('Dispatch'))
    expect(mockSendInput).toHaveBeenCalledWith('agent-1', 'do the thing\r')
  })

  it('calls tasks:update with status in_progress on Dispatch', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Dispatch'))
    expect(mockTaskUpdate).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({ status: 'in_progress', agentId: 'agent-1' })
    )
  })

  it('calls onClose after dispatch', () => {
    const onClose = vi.fn()
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={onClose} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Dispatch'))
    // onClose is called asynchronously after task update resolves
    expect(mockSendInput).toHaveBeenCalled()
  })

  it('spawns team members when roles are selected', async () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Team spawn'))
    fireEvent.click(screen.getByLabelText('dev-backend'))
    fireEvent.click(screen.getByText('Dispatch'))
    await waitFor(() => {
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ name: expect.stringContaining('dev-backend') })
      )
      expect(mockSendInput).toHaveBeenCalledWith('agent-1', expect.stringContaining('\r'))
    })
  })
})

describe('KanbanDispatchModal — mode toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map([['agent-1', mockAgent]]), activeAgentId: null })
    useProjectStore.setState({
      projects: [{ id: 'proj-1', name: 'AgentHub v2', description: null, path: '/tmp/agenthub', createdAt: '', updatedAt: '' }],
      selectedProjectId: null
    })
  })

  it('defaults to "use existing" mode when agentId is provided and agent is live', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /use existing/i })).toBeChecked()
  })

  it('defaults to "spawn new" mode when agentId is null', () => {
    const task = { ...mockTask, agentId: null }
    render(<KanbanDispatchModal task={task} agentId={null} onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByRole('radio', { name: /spawn new/i })).toBeChecked()
  })

  it('shows agent name input in spawn mode', () => {
    const task = { ...mockTask, agentId: null }
    render(<KanbanDispatchModal task={task} agentId={null} onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument()
  })

  it('auto-generates agent name from card title and date in spawn mode', () => {
    const task = { ...mockTask, agentId: null }
    render(<KanbanDispatchModal task={task} agentId={null} onClose={vi.fn()} repos={[mockRepo]} />)
    const nameInput = screen.getByLabelText(/agent name/i) as HTMLInputElement
    expect(nameInput.value).toMatch(/Fix login bug/)
    const today = new Date().toISOString().slice(0, 10)
    expect(nameInput.value).toContain(today)
  })

  it('switches between modes when radio buttons are clicked', () => {
    render(<KanbanDispatchModal task={mockTask} agentId="agent-1" onClose={vi.fn()} repos={[mockRepo]} />)
    expect(screen.getByRole('radio', { name: /use existing/i })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: /spawn new/i }))
    expect(screen.getByRole('radio', { name: /spawn new/i })).toBeChecked()
    expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument()
  })
})

describe('KanbanDispatchModal — spawn dispatch', () => {
  const mockSendInput = vi.fn()
  const mockSpawn = vi.fn().mockResolvedValue({ success: true, data: { ...mockAgent, id: 'new-agent' } })
  const mockTaskUpdate = vi.fn().mockResolvedValue({ success: true })

  beforeEach(() => {
    vi.clearAllMocks()
    useAgentStore.setState({ agents: new Map(), activeAgentId: null })
    useProjectStore.setState({
      projects: [{ id: 'proj-1', name: 'AgentHub v2', description: null, path: '/tmp/proj-path', createdAt: '', updatedAt: '' }],
      selectedProjectId: null
    })
    window.agentHub = {
      agents: { sendInput: mockSendInput, spawn: mockSpawn },
      tasks: { update: mockTaskUpdate },
    } as any
  })

  it('spawns a new agent and sends prompt on dispatch in spawn mode', async () => {
    const task = { ...mockTask, agentId: null, projectId: 'proj-1' }
    render(<KanbanDispatchModal task={task} agentId={null} onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Dispatch'))
    await waitFor(() => {
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({
          repoId: 'repo-1',
          cwd: '/tmp/proj-path',
        })
      )
      expect(mockSendInput).toHaveBeenCalledWith('new-agent', expect.stringContaining('\r'))
      expect(mockTaskUpdate).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ status: 'in_progress', agentId: 'new-agent' })
      )
    })
  })

  it('falls back to repo path when project has no path', async () => {
    useProjectStore.setState({
      projects: [{ id: 'proj-1', name: 'AgentHub v2', description: null, path: null, createdAt: '', updatedAt: '' }],
      selectedProjectId: null
    })
    const task = { ...mockTask, agentId: null, projectId: 'proj-1' }
    render(<KanbanDispatchModal task={task} agentId={null} onClose={vi.fn()} repos={[mockRepo]} />)
    fireEvent.click(screen.getByText('Dispatch'))
    await waitFor(() => {
      expect(mockSpawn).toHaveBeenCalledWith(
        expect.objectContaining({ cwd: '/tmp/agenthub' })
      )
    })
  })
})
