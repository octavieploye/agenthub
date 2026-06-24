import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KanbanCardPopover } from './KanbanCardPopover'
import type { TaskItem } from '@shared/types/task.types'
import { useProjectStore } from '../../stores/project-store'
import type { AgentState } from '@shared/types/agent.types'
import type { Project } from '@shared/types/project.types'

const mockTask: TaskItem = {
  id: 'task-1',
  repoId: 'repo-1',
  title: 'Fix login bug',
  description: 'Users cannot log in after token refresh',
  priority: 2,
  status: 'backlog',
  category: 'backend',
  agentId: null,
  position: 0,
  sbarId: null,
  sprintName: 'Sprint 1',
  epicName: 'Auth Epic',
  projectId: null,
  sectionTargetDate: '2026-07-01',
  note: 'Check the JWT expiry logic',
  createdAt: '2026-06-21T00:00:00Z',
  updatedAt: '2026-06-21T00:00:00Z',
}

const defaultProps = {
  task: mockTask,
  position: { top: 100, left: 400 },
  onSave: vi.fn(),
  onClose: vi.fn(),
  onMouseEnter: vi.fn(),
  onMouseLeave: vi.fn(),
  agents: [] as AgentState[],
}

describe('KanbanCardPopover', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders all editable fields prefilled from task', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    expect(screen.getByDisplayValue('Fix login bug')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Users cannot log in after token refresh')).toBeInTheDocument()
    expect(screen.getByDisplayValue('backend')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Check the JWT expiry logic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Auth Epic')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Sprint 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-07-01')).toBeInTheDocument()
  })

  it('calls onClose when ✕ is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Close popover'))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls onSave with updated title and then onClose when Save is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.change(screen.getByDisplayValue('Fix login bug'), { target: { value: 'Fix login bug v2' } })
    fireEvent.click(screen.getByText('Save'))
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Fix login bug v2' })
    )
    expect(defaultProps.onClose).toHaveBeenCalledOnce()
  })

  it('Save button is disabled and onSave not called when title is empty', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    fireEvent.change(screen.getByDisplayValue('Fix login bug'), { target: { value: '' } })
    const saveBtn = screen.getByText('Save')
    expect(saveBtn).toBeDisabled()
    fireEvent.click(saveBtn)
    expect(defaultProps.onSave).not.toHaveBeenCalled()
  })

  it('calls onMouseEnter and onMouseLeave on panel mouse events', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    fireEvent.mouseEnter(panel)
    expect(defaultProps.onMouseEnter).toHaveBeenCalledOnce()
    fireEvent.mouseLeave(panel)
    expect(defaultProps.onMouseLeave).toHaveBeenCalledOnce()
  })

  it('renders created and updated dates from task metadata', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    expect(screen.getByText(/Created:/)).toBeInTheDocument()
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
  })

  it('applies fixed position style from position prop', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    expect(panel).toHaveStyle({ top: '100px', left: '400px' })
  })

  it('does not close popover on mouse leave when a field is focused', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    const titleInput = screen.getByDisplayValue('Fix login bug')
    fireEvent.focus(titleInput)
    fireEvent.mouseLeave(panel)
    expect(defaultProps.onMouseLeave).not.toHaveBeenCalled()
  })

  it('allows close on mouse leave after field is blurred', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const panel = screen.getByTestId('card-popover')
    const titleInput = screen.getByDisplayValue('Fix login bug')
    fireEvent.focus(titleInput)
    fireEvent.blur(titleInput)
    fireEvent.mouseLeave(panel)
    expect(defaultProps.onMouseLeave).toHaveBeenCalledOnce()
  })

  it('calls onSave with empty description when description is cleared', () => {
    render(<KanbanCardPopover {...defaultProps} />)
    const descriptionTextarea = screen.getByDisplayValue('Users cannot log in after token refresh')
    fireEvent.change(descriptionTextarea, { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ description: '' })
    )
  })
})

const mockAgent: AgentState = {
  id: 'agent-1', name: 'Alpha', status: 'idle', confidence: 'confirmed', color: '#3B82F6',
  repoId: 'repo-1', model: 'claude-sonnet-4-6', provider: 'anthropic', effortLevel: 'medium',
  taskDescription: '', pid: null, ptyFd: null, cwd: '/tmp/alpha',
  createdAt: '2026-06-21T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z',
  progress: 0, executionMode: 'native', voiceMode: 'off'
}

const mockProject: Project = {
  id: 'proj-1', name: 'AgentHub v2',
  description: null, createdAt: '2026-06-21T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z'
}

describe('KanbanCardPopover — agent + project selectors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({ projects: [mockProject], selectedProjectId: null })
  })

  it('renders agent selector with agents from prop', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[mockAgent]} />)
    const agentSelect = screen.getByLabelText('Agent')
    expect(agentSelect).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('renders project selector with projects from store', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[]} />)
    const projectSelect = screen.getByLabelText('Project')
    expect(projectSelect).toBeInTheDocument()
    expect(screen.getByText('AgentHub v2')).toBeInTheDocument()
  })

  it('pre-selects defaultProjectId when provided', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[]} defaultProjectId="proj-1" />)
    const projectSelect = screen.getByLabelText('Project') as HTMLSelectElement
    expect(projectSelect.value).toBe('proj-1')
  })

  it('includes agentId and projectId in onSave when Save is clicked', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[mockAgent]} defaultProjectId="proj-1" />)
    const agentSelect = screen.getByLabelText('Agent') as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: 'agent-1' } })
    fireEvent.click(screen.getByText('Save'))
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'agent-1', projectId: 'proj-1' })
    )
  })

  it('sends null agentId when Unassigned is selected', () => {
    const task = { ...mockTask, agentId: 'agent-1' }
    render(<KanbanCardPopover {...defaultProps} task={task} agents={[mockAgent]} />)
    const agentSelect = screen.getByLabelText('Agent') as HTMLSelectElement
    fireEvent.change(agentSelect, { target: { value: '' } })
    fireEvent.click(screen.getByText('Save'))
    expect(defaultProps.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: null })
    )
  })
})

describe('KanbanCardPopover — inline project create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProjectStore.setState({ projects: [mockProject], selectedProjectId: null })
  })

  it('shows inline create form when "+ New project…" is selected', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[]} />)
    const projectSelect = screen.getByLabelText('Project') as HTMLSelectElement
    fireEvent.change(projectSelect, { target: { value: '__create__' } })
    expect(screen.getByPlaceholderText('Project name…')).toBeInTheDocument()
    expect(screen.getByText('Create & assign')).toBeInTheDocument()
  })

  it('hides inline form and resets to No Project when cancelled', () => {
    render(<KanbanCardPopover {...defaultProps} agents={[]} />)
    fireEvent.change(screen.getByLabelText('Project'), { target: { value: '__create__' } })
    fireEvent.click(screen.getByText('Cancel create'))
    expect(screen.queryByPlaceholderText('Project name…')).not.toBeInTheDocument()
  })
})
