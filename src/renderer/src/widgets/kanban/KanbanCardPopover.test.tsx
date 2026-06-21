import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KanbanCardPopover } from './KanbanCardPopover'
import type { TaskItem } from '@shared/types/task.types'

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
})
