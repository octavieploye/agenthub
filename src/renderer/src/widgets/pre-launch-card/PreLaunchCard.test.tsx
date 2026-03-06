import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PreLaunchCard from './PreLaunchCard'

describe('PreLaunchCard', () => {
  const defaultProps = {
    repoId: 'repo-1',
    repoName: 'my-project',
    initialTask: 'Refactor authentication module',
    recommendedModel: 'claude-sonnet-4-20250514',
    modelRationale: 'Complex refactor, needs 64k+ context',
    quotaUsed: 147,
    quotaLimit: 250,
    quotaPercent: 59,
    burnRate: 12,
    estimatedImpact: 35,
    guardrails: {
      maxDuration: 60,
      maxFiles: 20,
      protectedPaths: ['src/core/', 'package.json']
    },
    onLaunch: vi.fn(),
    onChangeModel: vi.fn(),
    onCancel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders the panel with panel-glass class', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const panel = screen.getByTestId('pre-launch-card')
      expect(panel.className).toMatch(/panel-glass/)
    })

    it('renders with role="dialog" and correct aria-label', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const panel = screen.getByRole('dialog')
      expect(panel).toBeInTheDocument()
      expect(panel).toHaveAttribute(
        'aria-label',
        'Pre-launch configuration for new agent'
      )
    })

    it('renders repo name', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent('my-project')
    })

    it('renders PRE-LAUNCH header', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByText(/PRE-LAUNCH/)).toBeInTheDocument()
      expect(screen.getByText(/New Agent/i)).toBeInTheDocument()
    })

    it('renders editable task input pre-filled with initialTask', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const input = screen.getByTestId('pre-launch-task-input') as HTMLInputElement | HTMLTextAreaElement
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('Refactor authentication module')
    })

    it('renders empty task input when no initialTask provided', () => {
      const { initialTask: _, ...propsWithoutTask } = defaultProps
      render(<PreLaunchCard {...propsWithoutTask} />)
      const input = screen.getByTestId('pre-launch-task-input') as HTMLInputElement | HTMLTextAreaElement
      expect(input.value).toBe('')
    })

    it('renders recommended model name', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent('claude-sonnet-4-20250514')
    })

    it('renders model rationale text', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent(
        'Complex refactor, needs 64k+ context'
      )
    })

    it('renders quota in "used/limit messages (percent%)" format', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent('147/250 messages (59%)')
    })

    it('renders burn rate', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent(/12.*msg.*hr|12.*messages.*hour/i)
    })

    it('renders estimated impact', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-card')).toHaveTextContent(/35/)
    })

    it('renders guardrails section when guardrails provided', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-guardrails')).toBeInTheDocument()
    })

    it('does NOT render guardrails section when guardrails is undefined', () => {
      const { guardrails: _, ...propsWithoutGuardrails } = defaultProps
      render(<PreLaunchCard {...propsWithoutGuardrails} />)
      expect(screen.queryByTestId('pre-launch-guardrails')).not.toBeInTheDocument()
    })

    it('renders protected paths in guardrails', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const guardrails = screen.getByTestId('pre-launch-guardrails')
      expect(guardrails).toHaveTextContent('src/core/')
      expect(guardrails).toHaveTextContent('package.json')
    })

    it('renders all three action buttons (Launch, Change Model, Cancel)', () => {
      render(<PreLaunchCard {...defaultProps} />)
      expect(screen.getByTestId('pre-launch-btn-launch')).toBeInTheDocument()
      expect(screen.getByTestId('pre-launch-btn-change-model')).toBeInTheDocument()
      expect(screen.getByTestId('pre-launch-btn-cancel')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('calls onLaunch with current task text when Launch button clicked', () => {
      render(<PreLaunchCard {...defaultProps} />)
      fireEvent.click(screen.getByTestId('pre-launch-btn-launch'))
      expect(defaultProps.onLaunch).toHaveBeenCalledWith('Refactor authentication module')
    })

    it('calls onCancel when Cancel button clicked', () => {
      render(<PreLaunchCard {...defaultProps} />)
      fireEvent.click(screen.getByTestId('pre-launch-btn-cancel'))
      expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    })

    it('calls onChangeModel when Change Model button clicked', () => {
      render(<PreLaunchCard {...defaultProps} />)
      fireEvent.click(screen.getByTestId('pre-launch-btn-change-model'))
      expect(defaultProps.onChangeModel).toHaveBeenCalledOnce()
    })

    it('allows editing the task description', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const input = screen.getByTestId('pre-launch-task-input') as HTMLInputElement | HTMLTextAreaElement
      fireEvent.change(input, { target: { value: 'New task description' } })
      expect(input.value).toBe('New task description')
    })

    it('calls onLaunch with edited task when Launch clicked after edit', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const input = screen.getByTestId('pre-launch-task-input')
      fireEvent.change(input, { target: { value: 'Updated task' } })
      fireEvent.click(screen.getByTestId('pre-launch-btn-launch'))
      expect(defaultProps.onLaunch).toHaveBeenCalledWith('Updated task')
    })

    it('Escape key calls onCancel', () => {
      render(<PreLaunchCard {...defaultProps} />)
      fireEvent.keyDown(screen.getByTestId('pre-launch-card'), {
        key: 'Escape',
        code: 'Escape'
      })
      expect(defaultProps.onCancel).toHaveBeenCalledOnce()
    })

    it('Enter key calls onLaunch with current task', () => {
      render(<PreLaunchCard {...defaultProps} />)
      fireEvent.keyDown(screen.getByTestId('pre-launch-card'), {
        key: 'Enter',
        code: 'Enter'
      })
      expect(defaultProps.onLaunch).toHaveBeenCalledWith('Refactor authentication module')
    })

    it('Launch button is disabled when task input is empty', () => {
      const { initialTask: _, ...propsWithoutTask } = defaultProps
      render(<PreLaunchCard {...propsWithoutTask} />)
      const launchBtn = screen.getByTestId('pre-launch-btn-launch')
      expect(launchBtn).toBeDisabled()
    })

    it('Launch button enabled when task has text', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const launchBtn = screen.getByTestId('pre-launch-btn-launch')
      expect(launchBtn).toBeEnabled()
    })
  })

  describe('styling', () => {
    it('Launch button has btn-lcars btn-primary classes', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const btn = screen.getByTestId('pre-launch-btn-launch')
      expect(btn.className).toMatch(/btn-lcars/)
      expect(btn.className).toMatch(/btn-primary/)
    })

    it('Change Model button has outlined/secondary style', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const btn = screen.getByTestId('pre-launch-btn-change-model')
      expect(btn.className).toMatch(/btn-secondary|btn-outline/)
    })

    it('Cancel button has tertiary text style', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const btn = screen.getByTestId('pre-launch-btn-cancel')
      expect(btn.className).toMatch(/btn-ghost|btn-link|text-base-content/)
    })

    it('card has animate-slide-down class', () => {
      render(<PreLaunchCard {...defaultProps} />)
      const card = screen.getByTestId('pre-launch-card')
      expect(card.className).toMatch(/animate-slide-down/)
    })
  })
})
