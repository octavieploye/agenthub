import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import BriefingView from './BriefingView'
import NeedsAttention, { buildAttentionItems } from './NeedsAttention'
import SubscriptionStatus from './SubscriptionStatus'
import YesterdaySummary, { formatSummaryLine } from './YesterdaySummary'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUsageStore } from '@renderer/stores/usage-store'
import type { AgentState } from '@shared/types/agent.types'
import type { TaskItem } from '@shared/types/task.types'

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'Test Agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    taskDescription: 'Test task',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/repo',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    progress: 50,
    color: '#3B82F6',
    ...overrides
  }
}

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

beforeEach(() => {
  useTaskStore.setState({ tasks: [], loading: false, error: null })
  useUsageStore.setState({
    plan: 'max5',
    totalMessages: 620,
    burnRate: 15.3,
    quotaPercent: 62
  })
  window.agentHub = {
    tasks: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] })
    }
  } as any
})

describe('BriefingView', () => {
  const defaultProps = {
    agents: [],
    onStartWorking: vi.fn(),
    onViewAgent: vi.fn(),
    onResumeAgent: vi.fn(),
    onKillAgent: vi.fn(),
    onSpawnTester: vi.fn()
  }

  it('renders greeting and date', () => {
    render(<BriefingView {...defaultProps} />)
    expect(screen.getByTestId('briefing-view')).toBeInTheDocument()
    // Greeting varies by time of day
    const greeting = screen.getByText(/Good (morning|afternoon|evening)/)
    expect(greeting).toBeInTheDocument()
  })

  it('renders Start Working button', () => {
    render(<BriefingView {...defaultProps} />)
    const btn = screen.getByTestId('start-working-btn')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(defaultProps.onStartWorking).toHaveBeenCalled()
  })

  it('shows loading skeletons when loading', () => {
    useTaskStore.setState({ loading: true })
    render(<BriefingView {...defaultProps} />)
    const pulses = document.querySelectorAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThan(0)
  })

  it('renders subscription status', () => {
    render(<BriefingView {...defaultProps} />)
    expect(screen.getByTestId('subscription-status')).toBeInTheDocument()
  })

  it('renders yesterday summary with defaults when not provided', () => {
    render(<BriefingView {...defaultProps} />)
    expect(screen.getByTestId('yesterday-summary')).toBeInTheDocument()
    expect(screen.getByText(/No activity/)).toBeInTheDocument()
  })

  it('renders yesterday summary with provided data', () => {
    render(
      <BriefingView
        {...defaultProps}
        yesterdaySummary={{ completed: 5, tested: 3, bugsResolved: 2 }}
      />
    )
    expect(screen.getByText(/5 completed, 3 tested, 2 bugs resolved/)).toBeInTheDocument()
  })
})

describe('NeedsAttention', () => {
  const defaultProps = {
    agents: [],
    tasks: [],
    onViewAgent: vi.fn(),
    onResumeAgent: vi.fn(),
    onKillAgent: vi.fn(),
    onSpawnTester: vi.fn()
  }

  it('shows empty state when no attention items', () => {
    render(<NeedsAttention {...defaultProps} />)
    expect(screen.getByText(/All clear/)).toBeInTheDocument()
  })

  it('shows locked agents as blocked items', () => {
    const agents = [makeAgent({ id: 'a1', name: 'Locked Agent', status: 'locked' })]
    render(<NeedsAttention {...defaultProps} agents={agents} />)
    expect(screen.getByText('Locked Agent')).toBeInTheDocument()
    expect(screen.getByText(/WAITING FOR INPUT/)).toBeInTheDocument()
    expect(screen.getByText('View')).toBeInTheDocument()
    expect(screen.getByText('Resume')).toBeInTheDocument()
    expect(screen.getByText('Kill')).toBeInTheDocument()
  })

  it('shows paused agents as blocked items', () => {
    const agents = [makeAgent({ id: 'a2', name: 'Paused Agent', status: 'paused' })]
    render(<NeedsAttention {...defaultProps} agents={agents} />)
    expect(screen.getByText('Paused Agent')).toBeInTheDocument()
    expect(screen.getByText(/PAUSED/)).toBeInTheDocument()
  })

  it('shows completed tasks as needs-test items', () => {
    const tasks = [makeTask({ id: 't1', title: 'Done Task', status: 'completed' })]
    render(<NeedsAttention {...defaultProps} tasks={tasks} />)
    expect(screen.getByText('Done Task')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('shows correct count in header', () => {
    const agents = [makeAgent({ id: 'a1', status: 'locked' })]
    const tasks = [makeTask({ id: 't1', status: 'completed' })]
    render(<NeedsAttention {...defaultProps} agents={agents} tasks={tasks} />)
    expect(screen.getByText(/Needs Your Attention \(2\)/)).toBeInTheDocument()
  })

  it('calls onViewAgent when View is clicked', () => {
    const agents = [makeAgent({ id: 'a1', status: 'locked' })]
    const onViewAgent = vi.fn()
    render(<NeedsAttention {...defaultProps} agents={agents} onViewAgent={onViewAgent} />)
    fireEvent.click(screen.getByText('View'))
    expect(onViewAgent).toHaveBeenCalledWith('a1')
  })

  it('calls onResumeAgent when Resume is clicked', () => {
    const agents = [makeAgent({ id: 'a1', status: 'locked' })]
    const onResumeAgent = vi.fn()
    render(<NeedsAttention {...defaultProps} agents={agents} onResumeAgent={onResumeAgent} />)
    fireEvent.click(screen.getByText('Resume'))
    expect(onResumeAgent).toHaveBeenCalledWith('a1')
  })

  it('calls onKillAgent when Kill is clicked', () => {
    const agents = [makeAgent({ id: 'a1', status: 'locked' })]
    const onKillAgent = vi.fn()
    render(<NeedsAttention {...defaultProps} agents={agents} onKillAgent={onKillAgent} />)
    fireEvent.click(screen.getByText('Kill'))
    expect(onKillAgent).toHaveBeenCalledWith('a1')
  })

  it('calls onSpawnTester when Test is clicked', () => {
    const tasks = [makeTask({ id: 't1', status: 'completed' })]
    const onSpawnTester = vi.fn()
    render(<NeedsAttention {...defaultProps} tasks={tasks} onSpawnTester={onSpawnTester} />)
    fireEvent.click(screen.getByText('Test'))
    expect(onSpawnTester).toHaveBeenCalledWith('t1')
  })
})

describe('buildAttentionItems', () => {
  it('returns empty array when no blocked agents or completed tasks', () => {
    const items = buildAttentionItems(
      [makeAgent({ status: 'busy' })],
      [makeTask({ status: 'backlog' })]
    )
    expect(items).toEqual([])
  })

  it('includes locked and paused agents', () => {
    const agents = [
      makeAgent({ id: 'a1', status: 'locked' }),
      makeAgent({ id: 'a2', status: 'paused' }),
      makeAgent({ id: 'a3', status: 'busy' })
    ]
    const items = buildAttentionItems(agents, [])
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('blocked')
    expect(items[1].type).toBe('blocked')
  })

  it('includes completed tasks as needs_test', () => {
    const tasks = [
      makeTask({ id: 't1', status: 'completed' }),
      makeTask({ id: 't2', status: 'backlog' })
    ]
    const items = buildAttentionItems([], tasks)
    expect(items).toHaveLength(1)
    expect(items[0].type).toBe('needs_test')
  })
})

describe('SubscriptionStatus', () => {
  it('renders plan label and quota bar', () => {
    render(<SubscriptionStatus />)
    const el = screen.getByTestId('subscription-status')
    expect(el).toBeInTheDocument()
    expect(screen.getByText('Claude Max 5x')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('renders messages count', () => {
    render(<SubscriptionStatus />)
    expect(screen.getByText('620/1000 msgs')).toBeInTheDocument()
  })

  it('renders burn rate', () => {
    render(<SubscriptionStatus />)
    expect(screen.getByText('15.3 msg/hr')).toBeInTheDocument()
  })

  it('shows correct bar width', () => {
    render(<SubscriptionStatus />)
    const fill = screen.getByTestId('quota-bar-fill')
    expect(fill.style.width).toBe('62%')
  })

  it('uses error color when quota above 80%', () => {
    useUsageStore.setState({ quotaPercent: 85 })
    render(<SubscriptionStatus />)
    const fill = screen.getByTestId('quota-bar-fill')
    expect(fill.className).toContain('bg-error')
  })

  it('uses warning color when quota 60-80%', () => {
    useUsageStore.setState({ quotaPercent: 70 })
    render(<SubscriptionStatus />)
    const fill = screen.getByTestId('quota-bar-fill')
    expect(fill.className).toContain('bg-warning')
  })

  it('uses primary color when quota below 60%', () => {
    useUsageStore.setState({ quotaPercent: 40 })
    render(<SubscriptionStatus />)
    const fill = screen.getByTestId('quota-bar-fill')
    expect(fill.className).toContain('bg-primary')
  })
})

describe('YesterdaySummary', () => {
  it('renders summary line', () => {
    render(<YesterdaySummary summary={{ completed: 5, tested: 3, bugsResolved: 2 }} />)
    expect(screen.getByText(/5 completed, 3 tested, 2 bugs resolved/)).toBeInTheDocument()
  })

  it('shows "No activity" when all zeros', () => {
    render(<YesterdaySummary summary={{ completed: 0, tested: 0, bugsResolved: 0 }} />)
    expect(screen.getByText(/No activity/)).toBeInTheDocument()
  })
})

describe('formatSummaryLine', () => {
  it('formats all fields', () => {
    expect(formatSummaryLine({ completed: 3, tested: 1, bugsResolved: 2 })).toBe(
      '3 completed, 1 tested, 2 bugs resolved'
    )
  })

  it('omits zero fields', () => {
    expect(formatSummaryLine({ completed: 3, tested: 0, bugsResolved: 0 })).toBe('3 completed')
  })

  it('returns No activity when all zero', () => {
    expect(formatSummaryLine({ completed: 0, tested: 0, bugsResolved: 0 })).toBe('No activity')
  })
})
