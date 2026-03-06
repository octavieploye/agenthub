import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ShutdownDialog } from './ShutdownDialog'
import type { AgentState } from '@shared/types/agent.types'

function createAgent(id: string, overrides?: Partial<AgentState>): AgentState {
  return {
    id,
    repoId: 'payment-service',
    name: `Agent ${id}`,
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    taskDescription: 'Fix OAuth',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/test',
    progress: 50,
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

describe('ShutdownDialog', () => {
  const defaultProps = {
    onLetThemFinish: vi.fn(),
    onKillAllAndClose: vi.fn(),
    onCancel: vi.fn()
  }

  it('renders the dialog overlay', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('shutdown-overlay')).toBeInTheDocument()
  })

  it('shows agent count in title', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1'), createAgent('a2'), createAgent('a3')]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('shutdown-title')).toHaveTextContent('3 agents are still active')
  })

  it('shows singular form for one agent', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('shutdown-title')).toHaveTextContent('1 agent is still active')
  })

  it('renders each active agent', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1'), createAgent('a2')]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('shutdown-agent-a1')).toBeInTheDocument()
    expect(screen.getByTestId('shutdown-agent-a2')).toBeInTheDocument()
  })

  it('shows running time for busy agents', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByText(/Running 12 min/)).toBeInTheDocument()
  })

  it('shows waiting message for locked agents', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1', { status: 'locked' })]}
        {...defaultProps}
      />
    )
    expect(screen.getByText(/Waiting for your input/)).toBeInTheDocument()
  })

  it('shows locked warning when locked agents exist', () => {
    render(
      <ShutdownDialog
        activeAgents={[
          createAgent('a1'),
          createAgent('a2', { status: 'locked' })
        ]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('locked-warning')).toHaveTextContent(
      '1 agent is waiting for YOUR input'
    )
  })

  it('hides locked warning when no locked agents', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.queryByTestId('locked-warning')).toBeNull()
  })

  it('renders three action options', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByTestId('let-them-finish')).toBeInTheDocument()
    expect(screen.getByTestId('kill-all-close')).toBeInTheDocument()
    expect(screen.getByTestId('cancel-shutdown')).toBeInTheDocument()
  })

  it('calls onLetThemFinish when clicked', () => {
    const onLetThemFinish = vi.fn()
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
        onLetThemFinish={onLetThemFinish}
      />
    )
    fireEvent.click(screen.getByTestId('let-them-finish'))
    expect(onLetThemFinish).toHaveBeenCalledOnce()
  })

  it('calls onKillAllAndClose when clicked', () => {
    const onKillAllAndClose = vi.fn()
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
        onKillAllAndClose={onKillAllAndClose}
      />
    )
    fireEvent.click(screen.getByTestId('kill-all-close'))
    expect(onKillAllAndClose).toHaveBeenCalledOnce()
  })

  it('calls onCancel when clicked', () => {
    const onCancel = vi.fn()
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByTestId('cancel-shutdown'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows Let Them Finish description text', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByText(/App minimizes to system tray/)).toBeInTheDocument()
  })

  it('shows Kill All description text', () => {
    render(
      <ShutdownDialog
        activeAgents={[createAgent('a1')]}
        {...defaultProps}
      />
    )
    expect(screen.getByText(/All agents terminated/)).toBeInTheDocument()
  })
})
