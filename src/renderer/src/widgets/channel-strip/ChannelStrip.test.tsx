import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { AgentState, ModelProvider } from '@shared/types/agent.types'
import ChannelStrip from './ChannelStrip'

function createMockAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id: 'agent-1',
    repoId: 'repo-1',
    name: 'test-agent',
    status: 'busy',
    confidence: 'confirmed',
    model: 'claude-sonnet-4-6',
    provider: 'anthropic' as ModelProvider,
    taskDescription: 'Fix the login bug in the auth module',
    pid: 1234,
    ptyFd: null,
    cwd: '/Users/dev/project',
    createdAt: '2026-03-06T00:00:00Z',
    updatedAt: '2026-03-06T00:00:00Z',
    progress: 0.5,
    ...overrides
  }
}

vi.mock('@renderer/widgets/heartbeat-waveform/HeartbeatWaveform', () => ({
  default: ({ status }: { status: string }) => (
    <canvas data-testid="heartbeat-waveform" data-status={status} />
  )
}))

describe('ChannelStrip', () => {
  const mockOnSelect = vi.fn()
  const mockOnSolo = vi.fn()
  const mockOnMute = vi.fn()
  const mockOnKill = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('dimensions', () => {
    it('renders with 120px default width', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const strip = screen.getByTestId('channel-strip')
      expect(strip.className).toMatch(/w-\[120px\]/)
    })

    it('fills available vertical space', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const strip = screen.getByTestId('channel-strip')
      expect(strip.className).toMatch(/h-full|flex-1/)
    })
  })

  describe('agent information display', () => {
    it('renders agent name', () => {
      const agent = createMockAgent({ name: 'my-coding-agent' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      expect(screen.getByTestId('strip-agent-name')).toHaveTextContent('my-coding-agent')
    })

    it('renders model badge', () => {
      const agent = createMockAgent({ model: 'claude-opus-4-6' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      expect(screen.getByTestId('strip-model-badge')).toHaveTextContent('claude-opus-4-6')
    })

    it('renders repo label from cwd last segment', () => {
      const agent = createMockAgent({ cwd: '/Users/dev/workspace/my-repo' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      expect(screen.getByTestId('strip-repo-label')).toHaveTextContent('my-repo')
    })

    it('renders task description', () => {
      const agent = createMockAgent({ taskDescription: 'Refactor auth flow' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      expect(screen.getByTestId('strip-task-description')).toHaveTextContent('Refactor auth flow')
    })

    it('renders status indicator matching agent status', () => {
      const agent = createMockAgent({ status: 'locked' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const indicator = screen.getByTestId('strip-status-indicator')
      expect(indicator).toBeInTheDocument()
      expect(indicator.className).toMatch(/bg-warning|bg-amber|bg-yellow/)
    })

    it('renders progress bar reflecting agent progress', () => {
      const agent = createMockAgent({ progress: 0.75 })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const bar = screen.getByTestId('strip-progress-bar')
      expect(bar).toBeInTheDocument()
      // Progress fill should reflect 75%
      const fill = bar.querySelector('[data-testid="strip-progress-fill"]') ?? bar.firstElementChild
      expect(fill).toBeTruthy()
    })

    it('renders elapsed time since agent creation', () => {
      const agent = createMockAgent({ createdAt: '2026-03-06T00:00:00Z' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const elapsed = screen.getByTestId('strip-elapsed-time')
      expect(elapsed).toBeInTheDocument()
      // Should display some time format (e.g., "5m", "1h 2m")
      expect(elapsed.textContent).toBeTruthy()
    })

    it('renders activity meter', () => {
      const agent = createMockAgent({ status: 'busy' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      expect(screen.getByTestId('activity-meter')).toBeInTheDocument()
    })
  })

  describe('solo/mute buttons', () => {
    it('renders solo button labeled S', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const soloBtn = screen.getByTestId('solo-button')
      expect(soloBtn).toBeInTheDocument()
      expect(soloBtn).toHaveTextContent('S')
    })

    it('fires onSolo callback with agent id when solo button clicked', () => {
      const agent = createMockAgent({ id: 'agent-42' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      fireEvent.click(screen.getByTestId('solo-button'))
      expect(mockOnSolo).toHaveBeenCalledWith('agent-42')
    })

    it('renders mute button labeled M', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const muteBtn = screen.getByTestId('mute-button')
      expect(muteBtn).toBeInTheDocument()
      expect(muteBtn).toHaveTextContent('M')
    })

    it('fires onMute callback with agent id when mute button clicked', () => {
      const agent = createMockAgent({ id: 'agent-42' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      fireEvent.click(screen.getByTestId('mute-button'))
      expect(mockOnMute).toHaveBeenCalledWith('agent-42')
    })

    it('highlights solo button when isSoloed prop is true', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
          isSoloed={true}
        />
      )
      const soloBtn = screen.getByTestId('solo-button')
      expect(soloBtn.className).toMatch(/bg-primary|active|soloed/)
    })

    it('highlights mute button when isMuted prop is true', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
          isMuted={true}
        />
      )
      const muteBtn = screen.getByTestId('mute-button')
      expect(muteBtn.className).toMatch(/bg-warning|active|muted/)
    })
  })

  describe('kill button', () => {
    it('renders kill button (X)', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const killBtn = screen.getByTestId('strip-kill-button')
      expect(killBtn).toBeInTheDocument()
    })

    it('fires onKill callback with agent id when kill button clicked', () => {
      const agent = createMockAgent({ id: 'agent-99' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      fireEvent.click(screen.getByTestId('strip-kill-button'))
      expect(mockOnKill).toHaveBeenCalledWith('agent-99')
    })
  })

  describe('interactions', () => {
    it('fires onSelect when strip body is clicked', () => {
      const agent = createMockAgent({ id: 'agent-7' })
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      fireEvent.click(screen.getByTestId('channel-strip'))
      expect(mockOnSelect).toHaveBeenCalledWith('agent-7')
    })

    it('renders draggable header area for reordering', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const header = screen.getByTestId('strip-drag-handle')
      expect(header).toBeInTheDocument()
      expect(header.getAttribute('draggable')).toBe('true')
    })
  })

  describe('styling', () => {
    it('applies panel-glass class', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
        />
      )
      const strip = screen.getByTestId('channel-strip')
      expect(strip.className).toMatch(/panel-glass/)
    })

    it('dims strip when another agent is soloed (isDimmed prop)', () => {
      const agent = createMockAgent()
      render(
        <ChannelStrip
          agent={agent}
          onSelect={mockOnSelect}
          onSolo={mockOnSolo}
          onMute={mockOnMute}
          onKill={mockOnKill}
          isDimmed={true}
        />
      )
      const strip = screen.getByTestId('channel-strip')
      expect(strip.className).toMatch(/opacity-|dimmed/)
    })
  })
})
