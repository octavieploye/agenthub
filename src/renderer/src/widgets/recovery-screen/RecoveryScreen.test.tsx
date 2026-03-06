import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecoveryScreen } from './RecoveryScreen'
import type { RecoveryInfo, SBARHandoff } from '@shared/types/recovery.types'
import type { AgentState } from '@shared/types/agent.types'

function createAgent(id: string, overrides?: Partial<AgentState>): AgentState {
  return {
    id,
    repoId: 'repo-1',
    name: `Agent ${id}`,
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    taskDescription: 'Fix OAuth refresh',
    pid: 1234,
    ptyFd: null,
    cwd: '/tmp/test',
    progress: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }
}

function createHandoff(agentId: string): SBARHandoff {
  return {
    id: 'sbar-1',
    agentId,
    agentName: `Agent ${agentId}`,
    repoId: 'repo-1',
    situation: 'Working on OAuth fix',
    background: 'payment-service repo, 4 files',
    assessment: '70% complete',
    recommendation: 'Resume to finish',
    createdAt: new Date().toISOString()
  }
}

function createRecoveryInfo(overrides?: Partial<RecoveryInfo>): RecoveryInfo {
  return {
    hadInterruption: true,
    lastSnapshot: null,
    recoveredAgents: [],
    interruptedAgents: [],
    ...overrides
  }
}

describe('RecoveryScreen', () => {
  it('renders the recovery title', () => {
    render(
      <RecoveryScreen
        recoveryInfo={createRecoveryInfo()}
        onContinue={vi.fn()}
      />
    )
    expect(screen.getByTestId('recovery-title')).toHaveTextContent('Session Recovery')
  })

  it('renders continue button', () => {
    const onContinue = vi.fn()
    render(
      <RecoveryScreen
        recoveryInfo={createRecoveryInfo()}
        onContinue={onContinue}
      />
    )
    const btn = screen.getByTestId('continue-button')
    expect(btn).toHaveTextContent('Continue to Dashboard')
    fireEvent.click(btn)
    expect(onContinue).toHaveBeenCalledOnce()
  })

  describe('recovered agents', () => {
    it('shows recovered agents section', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            recoveredAgents: [createAgent('a1')]
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByTestId('recovered-heading')).toHaveTextContent('Recovered (still running)')
      expect(screen.getByTestId('recovered-agent-a1')).toBeInTheDocument()
    })

    it('hides recovered section when empty', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({ recoveredAgents: [] })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.queryByTestId('recovered-heading')).toBeNull()
    })

    it('shows agent name and reconnected status', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            recoveredAgents: [createAgent('a1')]
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByText('Agent a1')).toBeInTheDocument()
      expect(screen.getByText(/RECONNECTED/)).toBeInTheDocument()
    })
  })

  describe('interrupted agents', () => {
    it('shows interrupted agents section', () => {
      const interrupted = {
        ...createAgent('a2', { status: 'interrupted' }),
        handoff: undefined
      }
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByTestId('interrupted-heading')).toHaveTextContent('Interrupted (process ended)')
      expect(screen.getByTestId('interrupted-agent-a2')).toBeInTheDocument()
    })

    it('hides interrupted section when empty', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({ interruptedAgents: [] })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.queryByTestId('interrupted-heading')).toBeNull()
    })

    it('renders action buttons for interrupted agents', () => {
      const onResume = vi.fn()
      const onViewOutput = vi.fn()
      const onDrop = vi.fn()

      const interrupted = {
        ...createAgent('a2', { status: 'interrupted' }),
        handoff: undefined
      }

      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
          onResumeAgent={onResume}
          onViewOutput={onViewOutput}
          onDropAgent={onDrop}
        />
      )

      fireEvent.click(screen.getByTestId('resume-a2'))
      expect(onResume).toHaveBeenCalledWith('a2')

      fireEvent.click(screen.getByTestId('view-output-a2'))
      expect(onViewOutput).toHaveBeenCalledWith('a2')

      fireEvent.click(screen.getByTestId('drop-a2'))
      expect(onDrop).toHaveBeenCalledWith('a2')
    })

    it('shows SBAR handoff toggle for interrupted agents with handoff', () => {
      const interrupted = {
        ...createAgent('a2', { status: 'interrupted' }),
        handoff: createHandoff('a2')
      }

      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
        />
      )

      const toggle = screen.getByText('View handoff summary')
      expect(toggle).toBeInTheDocument()

      fireEvent.click(toggle)
      expect(screen.getByText(/Working on OAuth fix/)).toBeInTheDocument()
      expect(screen.getByText(/payment-service repo/)).toBeInTheDocument()
      expect(screen.getByText(/70% complete/)).toBeInTheDocument()
      expect(screen.getByText(/Resume to finish/)).toBeInTheDocument()
    })

    it('collapses SBAR detail on second click', () => {
      const interrupted = {
        ...createAgent('a2', { status: 'interrupted' }),
        handoff: createHandoff('a2')
      }

      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
        />
      )

      fireEvent.click(screen.getByText('View handoff summary'))
      expect(screen.getByText(/Working on OAuth fix/)).toBeInTheDocument()

      fireEvent.click(screen.getByText('Hide handoff summary'))
      expect(screen.queryByText(/Working on OAuth fix/)).toBeNull()
    })
  })

  describe('subtitle text', () => {
    it('shows recovery-only subtitle', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            recoveredAgents: [createAgent('a1')],
            interruptedAgents: []
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByTestId('recovery-subtitle')).toHaveTextContent(
        'We recovered 1 agent that is still running.'
      )
    })

    it('shows interrupted-only subtitle', () => {
      const interrupted = {
        ...createAgent('a1', { status: 'interrupted' }),
        handoff: undefined
      }
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            recoveredAgents: [],
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByTestId('recovery-subtitle')).toHaveTextContent(
        '1 agent was interrupted while working.'
      )
    })

    it('shows mixed subtitle', () => {
      const interrupted = {
        ...createAgent('a2', { status: 'interrupted' }),
        handoff: undefined
      }
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            recoveredAgents: [createAgent('a1')],
            interruptedAgents: [interrupted]
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByTestId('recovery-subtitle')).toHaveTextContent(
        'We recovered 1 agent and 1 was interrupted.'
      )
    })
  })

  describe('last snapshot info', () => {
    it('shows layout restored message when snapshot exists', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({
            lastSnapshot: {
              id: 1,
              stateJson: {
                agents: [],
                activeAgentId: null,
                viewMode: 'raid',
                soundEnabled: true,
                focusedAgentId: null,
                statusFilter: null,
                appVersion: '1.0.0',
                timestamp: new Date().toISOString()
              },
              trigger: 'app_close',
              createdAt: new Date().toISOString()
            }
          })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.getByText(/Dashboard layout restored/)).toBeInTheDocument()
    })

    it('hides layout message when no snapshot', () => {
      render(
        <RecoveryScreen
          recoveryInfo={createRecoveryInfo({ lastSnapshot: null })}
          onContinue={vi.fn()}
        />
      )
      expect(screen.queryByText(/Dashboard layout restored/)).toBeNull()
    })
  })
})
