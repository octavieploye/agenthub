import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GuardrailsPanel from './GuardrailsPanel'
import { DEFAULT_GUARDRAILS, type GuardrailConfig } from '@shared/types/config.types'

describe('GuardrailsPanel', () => {
  const defaultConfig: GuardrailConfig = {
    maxDurationMinutes: 45,
    maxFilesChanged: 15,
    maxConsecutiveErrors: 3,
    maxTokensPerSession: 50000,
    protectedPaths: ['node_modules', '.env']
  }

  const defaultProps = {
    repoId: 'repo-1',
    repoName: 'my-project',
    repoPath: '/repos/my-project',
    config: defaultConfig,
    onUpdate: vi.fn(),
    onReset: vi.fn(),
    onClose: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── rendering ───────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders panel title with repo name', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      expect(screen.getByText(/my-project/)).toBeInTheDocument()
      expect(screen.getByText(/guardrails/i)).toBeInTheDocument()
    })

    it('renders slider for maxDurationMinutes with correct value', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const slider = screen.getByTestId('guardrail-slider-maxDurationMinutes') as HTMLInputElement
      expect(slider).toBeInTheDocument()
      expect(slider.type).toBe('range')
      expect(Number(slider.value)).toBe(45)
    })

    it('renders slider for maxFilesChanged with correct value', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const slider = screen.getByTestId('guardrail-slider-maxFilesChanged') as HTMLInputElement
      expect(slider).toBeInTheDocument()
      expect(slider.type).toBe('range')
      expect(Number(slider.value)).toBe(15)
    })

    it('renders slider for maxConsecutiveErrors with correct value', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const slider = screen.getByTestId('guardrail-slider-maxConsecutiveErrors') as HTMLInputElement
      expect(slider).toBeInTheDocument()
      expect(slider.type).toBe('range')
      expect(Number(slider.value)).toBe(3)
    })

    it('renders slider for maxTokensPerSession with correct value', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const slider = screen.getByTestId('guardrail-slider-maxTokensPerSession') as HTMLInputElement
      expect(slider).toBeInTheDocument()
      expect(slider.type).toBe('range')
      expect(Number(slider.value)).toBe(50000)
    })

    it('renders protectedPaths list', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      expect(screen.getByText('node_modules')).toBeInTheDocument()
      expect(screen.getByText('.env')).toBeInTheDocument()
    })

    it('displays "Default" badge when config matches defaults', () => {
      const propsWithDefaults = {
        ...defaultProps,
        config: { ...DEFAULT_GUARDRAILS }
      }
      render(<GuardrailsPanel {...propsWithDefaults} />)
      expect(screen.getByText(/default/i)).toBeInTheDocument()
    })

    it('renders with aria-label for accessibility', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('aria-label', expect.stringContaining('Guardrails'))
    })

    it('shows protected path entries with remove buttons', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      // 2 protected paths = 2 remove buttons
      const removeButtons = screen.getAllByTestId(/guardrail-remove-path-/)
      expect(removeButtons).toHaveLength(2)
    })

    it('has an add protected path input', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const addInput = screen.getByTestId('guardrail-add-path-input')
      expect(addInput).toBeInTheDocument()
    })

    it('reset button has confirmation attribute', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const resetBtn = screen.getByTestId('guardrail-btn-reset')
      expect(resetBtn).toHaveAttribute('data-confirm', 'true')
    })
  })

  // ─── interactions ────────────────────────────────────────────────

  describe('interactions', () => {
    it('calls onUpdate when slider value changes', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      const slider = screen.getByTestId('guardrail-slider-maxDurationMinutes')
      fireEvent.change(slider, { target: { value: '60' } })
      expect(defaultProps.onUpdate).toHaveBeenCalledWith('maxDurationMinutes', 60)
    })

    it('calls onReset when reset button is clicked', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('guardrail-btn-reset'))
      expect(defaultProps.onReset).toHaveBeenCalledOnce()
    })

    it('calls onClose when close button is clicked', () => {
      render(<GuardrailsPanel {...defaultProps} />)
      fireEvent.click(screen.getByTestId('guardrail-btn-close'))
      expect(defaultProps.onClose).toHaveBeenCalledOnce()
    })
  })
})
