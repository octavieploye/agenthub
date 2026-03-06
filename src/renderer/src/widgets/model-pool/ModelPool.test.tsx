import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelPool from './ModelPool'
import type { ModelInfo, ModelPoolProps } from './ModelPool'

function createModel(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    available: true,
    contextWindow: 200000,
    ...overrides
  }
}

describe('ModelPool', () => {
  const defaultProps: ModelPoolProps = {
    models: [
      createModel({ id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000 }),
      createModel({ id: 'claude-opus-4', name: 'Claude Opus 4', provider: 'anthropic', contextWindow: 200000 }),
      createModel({ id: 'llama3-local', name: 'Llama 3', provider: 'ollama-local', contextWindow: 8000 }),
      createModel({
        id: 'llama3-cloud',
        name: 'Llama 3 Cloud',
        provider: 'ollama-cloud',
        contextWindow: 8000,
        available: false,
        unavailableReason: 'Endpoint unreachable'
      })
    ],
    quotaPercent: 45,
    planLabel: 'Pro',
    onSelectModel: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── rendering ──────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders container with data-testid="model-pool" and panel-glass class', () => {
      render(<ModelPool {...defaultProps} />)
      const container = screen.getByTestId('model-pool')
      expect(container).toBeInTheDocument()
      expect(container.className).toMatch(/panel-glass/)
    })

    it('renders "Model Pool" header', () => {
      render(<ModelPool {...defaultProps} />)
      expect(screen.getByText(/Model Pool/)).toBeInTheDocument()
    })

    it('renders plan label and quota percent', () => {
      render(<ModelPool {...defaultProps} />)
      const container = screen.getByTestId('model-pool')
      expect(container).toHaveTextContent('Pro')
      expect(container).toHaveTextContent('45%')
    })

    it('renders each model name', () => {
      render(<ModelPool {...defaultProps} />)
      expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument()
      expect(screen.getByText('Claude Opus 4')).toBeInTheDocument()
      expect(screen.getByText('Llama 3')).toBeInTheDocument()
      expect(screen.getByText('Llama 3 Cloud')).toBeInTheDocument()
    })

    it('renders provider badge for each model', () => {
      render(<ModelPool {...defaultProps} />)
      const badges = screen.getAllByTestId('provider-badge')
      expect(badges).toHaveLength(4)
    })

    it('renders context window size formatted as "Xk"', () => {
      render(<ModelPool {...defaultProps} />)
      const container = screen.getByTestId('model-pool')
      expect(container).toHaveTextContent('200k')
      expect(container).toHaveTextContent('8k')
    })

    it('renders available models normally (not greyed)', () => {
      render(<ModelPool {...defaultProps} />)
      const availableRow = screen.getByTestId('model-row-claude-sonnet-4')
      expect(availableRow.className).not.toMatch(/opacity-/)
    })

    it('renders unavailable models with greyed styling (opacity class)', () => {
      render(<ModelPool {...defaultProps} />)
      const unavailableRow = screen.getByTestId('model-row-llama3-cloud')
      expect(unavailableRow.className).toMatch(/opacity-/)
    })

    it('renders unavailable reason text when model is unavailable', () => {
      render(<ModelPool {...defaultProps} />)
      expect(screen.getByText('Endpoint unreachable')).toBeInTheDocument()
    })

    it('renders empty state when no models', () => {
      render(<ModelPool {...defaultProps} models={[]} />)
      expect(screen.getByTestId('model-pool-empty')).toBeInTheDocument()
    })
  })

  // ─── interactions ───────────────────────────────────────────────────

  describe('interactions', () => {
    it('calls onSelectModel with model id when available model clicked', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-claude-sonnet-4')
      fireEvent.click(row)
      expect(defaultProps.onSelectModel).toHaveBeenCalledWith('claude-sonnet-4')
    })

    it('does NOT call onSelectModel when unavailable model clicked', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-llama3-cloud')
      fireEvent.click(row)
      expect(defaultProps.onSelectModel).not.toHaveBeenCalled()
    })

    it('available model row is clickable (cursor-pointer)', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-claude-sonnet-4')
      expect(row.className).toMatch(/cursor-pointer/)
    })

    it('unavailable model row has disabled appearance', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-llama3-cloud')
      expect(row.className).toMatch(/cursor-not-allowed|pointer-events-none/)
    })
  })

  // ─── model details ─────────────────────────────────────────────────

  describe('model details', () => {
    it('Claude models show "anthropic" provider badge', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-claude-sonnet-4')
      const badge = row.querySelector('[data-testid="provider-badge"]')
      expect(badge).toHaveTextContent('anthropic')
    })

    it('Ollama local models show "ollama-local" provider badge', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-llama3-local')
      const badge = row.querySelector('[data-testid="provider-badge"]')
      expect(badge).toHaveTextContent('ollama-local')
    })

    it('Ollama cloud models show "ollama-cloud" provider badge', () => {
      render(<ModelPool {...defaultProps} />)
      const row = screen.getByTestId('model-row-llama3-cloud')
      const badge = row.querySelector('[data-testid="provider-badge"]')
      expect(badge).toHaveTextContent('ollama-cloud')
    })

    it('context window formatted as "Xk" for thousands', () => {
      const models = [
        createModel({ id: 'model-128k', name: 'Model 128k', contextWindow: 128000 })
      ]
      render(<ModelPool {...defaultProps} models={models} />)
      expect(screen.getByTestId('model-pool')).toHaveTextContent('128k')
    })
  })
})
