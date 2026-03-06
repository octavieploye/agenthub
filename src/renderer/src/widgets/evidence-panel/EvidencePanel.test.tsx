import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EvidencePanel from './EvidencePanel'
import type { HealthAnomaly } from '@shared/types/health.types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAnomaly(overrides: Partial<HealthAnomaly> = {}): HealthAnomaly {
  return {
    id: 'anomaly-1',
    agentId: 'agent-1',
    type: 'loop',
    tier: 'yellow',
    message: 'File /src/index.ts modified 3 times',
    details: { filePath: '/src/index.ts', modificationCount: 3 },
    detectedAt: Date.now(),
    ...overrides
  }
}

function defaultProps() {
  return {
    agentId: 'agent-1',
    agentName: 'BuildBot',
    anomalies: [makeAnomaly()],
    pausedAt: Date.now() - 60_000, // paused 1 minute ago
    onResume: vi.fn(),
    onKill: vi.fn(),
    onRestart: vi.fn(),
    onDismiss: vi.fn()
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EvidencePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── rendering ──────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders agent name in header', () => {
      render(<EvidencePanel {...defaultProps()} />)
      expect(screen.getByText(/BuildBot/)).toBeInTheDocument()
    })

    it('renders each anomaly as an evidence entry', () => {
      const anomalies = [
        makeAnomaly({ id: 'a1', type: 'loop' }),
        makeAnomaly({ id: 'a2', type: 'overtime' }),
        makeAnomaly({ id: 'a3', type: 'error_spiral' })
      ]
      render(<EvidencePanel {...defaultProps()} anomalies={anomalies} />)

      const entries = screen.getAllByTestId(/^evidence-entry-/)
      expect(entries).toHaveLength(3)
    })

    it('shows anomaly type for each entry', () => {
      const anomalies = [
        makeAnomaly({ id: 'a1', type: 'loop' }),
        makeAnomaly({ id: 'a2', type: 'overtime' })
      ]
      render(<EvidencePanel {...defaultProps()} anomalies={anomalies} />)

      expect(screen.getByText(/loop/i)).toBeInTheDocument()
      expect(screen.getByText(/overtime/i)).toBeInTheDocument()
    })

    it('shows anomaly tier badge (yellow, orange, red)', () => {
      const anomalies = [
        makeAnomaly({ id: 'a1', tier: 'yellow' }),
        makeAnomaly({ id: 'a2', tier: 'orange' }),
        makeAnomaly({ id: 'a3', tier: 'red' })
      ]
      render(<EvidencePanel {...defaultProps()} anomalies={anomalies} />)

      expect(screen.getByTestId('tier-badge-a1')).toHaveTextContent(/yellow/i)
      expect(screen.getByTestId('tier-badge-a2')).toHaveTextContent(/orange/i)
      expect(screen.getByTestId('tier-badge-a3')).toHaveTextContent(/red/i)
    })

    it('shows anomaly message', () => {
      render(
        <EvidencePanel
          {...defaultProps()}
          anomalies={[makeAnomaly({ message: 'File /src/index.ts modified 3 times' })]}
        />
      )
      expect(screen.getByText('File /src/index.ts modified 3 times')).toBeInTheDocument()
    })

    it('shows anomaly details (filePath, modificationCount)', () => {
      render(
        <EvidencePanel
          {...defaultProps()}
          anomalies={[
            makeAnomaly({
              details: { filePath: '/src/app.ts', modificationCount: 5 }
            })
          ]}
        />
      )
      expect(screen.getByText(/\/src\/app\.ts/)).toBeInTheDocument()
      expect(screen.getByText(/5/)).toBeInTheDocument()
    })

    it('shows elapsed time since paused', () => {
      // Paused 1 minute ago
      const pausedAt = Date.now() - 60_000
      render(<EvidencePanel {...defaultProps()} pausedAt={pausedAt} />)

      // Should show some indication of elapsed time (e.g., "1m", "1 min", "60s")
      const panel = screen.getByRole('region')
      expect(panel).toHaveTextContent(/1\s*m/i)
    })

    it('renders with role="region" and aria-label containing "Evidence"', () => {
      render(<EvidencePanel {...defaultProps()} />)
      const region = screen.getByRole('region')
      expect(region).toHaveAttribute('aria-label', expect.stringContaining('Evidence'))
    })
  })

  // ─── actions ────────────────────────────────────────────────────────

  describe('actions', () => {
    it('calls onResume when Resume button clicked', () => {
      const props = defaultProps()
      render(<EvidencePanel {...props} />)

      fireEvent.click(screen.getByTestId('evidence-btn-resume'))
      expect(props.onResume).toHaveBeenCalledOnce()
    })

    it('calls onKill when Kill button clicked', () => {
      const props = defaultProps()
      render(<EvidencePanel {...props} />)

      fireEvent.click(screen.getByTestId('evidence-btn-kill'))
      expect(props.onKill).toHaveBeenCalledOnce()
    })

    it('has a restart text input for modified prompt', () => {
      render(<EvidencePanel {...defaultProps()} />)
      const input = screen.getByTestId('evidence-restart-input')
      expect(input).toBeInTheDocument()
      expect(input.tagName.toLowerCase()).toMatch(/input|textarea/)
    })

    it('calls onRestart with modified prompt when Restart clicked', () => {
      const props = defaultProps()
      render(<EvidencePanel {...props} />)

      const input = screen.getByTestId('evidence-restart-input')
      fireEvent.change(input, { target: { value: 'Fix only the login page' } })
      fireEvent.click(screen.getByTestId('evidence-btn-restart'))

      expect(props.onRestart).toHaveBeenCalledWith('Fix only the login page')
    })

    it('calls onDismiss with anomaly ID when dismiss button clicked on an entry', () => {
      const props = defaultProps()
      const anomalies = [
        makeAnomaly({ id: 'anomaly-42' }),
        makeAnomaly({ id: 'anomaly-99', type: 'overtime' })
      ]
      render(<EvidencePanel {...props} anomalies={anomalies} />)

      fireEvent.click(screen.getByTestId('evidence-dismiss-anomaly-42'))
      expect(props.onDismiss).toHaveBeenCalledWith('anomaly-42')
    })
  })

  // ─── state ──────────────────────────────────────────────────────────

  describe('state', () => {
    it('disables Resume button when there are red-tier anomalies', () => {
      const props = defaultProps()
      const anomalies = [makeAnomaly({ id: 'a1', tier: 'red' })]
      render(<EvidencePanel {...props} anomalies={anomalies} />)

      const resumeBtn = screen.getByTestId('evidence-btn-resume')
      expect(resumeBtn).toBeDisabled()
    })
  })
})
