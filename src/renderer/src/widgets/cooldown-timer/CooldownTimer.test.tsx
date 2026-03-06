import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CooldownTimer from './CooldownTimer'

describe('CooldownTimer', () => {
  // ─── rendering ──────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders an SVG element', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      const svg = container.querySelector('svg')
      expect(svg).toBeInTheDocument()
    })

    it('renders with role="timer"', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="md" />)
      const timer = screen.getByRole('timer')
      expect(timer).toBeInTheDocument()
    })

    it('renders with custom aria-label when label prop provided', () => {
      render(
        <CooldownTimer
          remainingMs={60000}
          totalMs={120000}
          size="md"
          label="Duration cooldown"
        />
      )
      const timer = screen.getByRole('timer')
      expect(timer).toHaveAttribute('aria-label', 'Duration cooldown')
    })

    it('renders with default aria-label "Cooldown timer" when no label prop', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="md" />)
      const timer = screen.getByRole('timer')
      expect(timer).toHaveAttribute('aria-label', 'Cooldown timer')
    })

    it('renders an aria-live="polite" region', () => {
      render(<CooldownTimer remainingMs={30000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      const liveRegion = container.querySelector('[aria-live="polite"]')
      expect(liveRegion).toBeInTheDocument()
    })
  })

  // ─── size variants ────────────────────────────────────────────────

  describe('size variants', () => {
    it('sm size renders 32px wide and tall', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="sm" />)
      const container = screen.getByTestId('cooldown-timer')
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '32')
      expect(svg).toHaveAttribute('height', '32')
    })

    it('md size renders 48px wide and tall', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '48')
      expect(svg).toHaveAttribute('height', '48')
    })

    it('lg size renders 64px wide and tall', () => {
      render(<CooldownTimer remainingMs={60000} totalMs={120000} size="lg" />)
      const container = screen.getByTestId('cooldown-timer')
      const svg = container.querySelector('svg')
      expect(svg).toHaveAttribute('width', '64')
      expect(svg).toHaveAttribute('height', '64')
    })
  })

  // ─── color zones ──────────────────────────────────────────────────

  describe('color zones', () => {
    it('green zone when >50% remaining', () => {
      // 80% remaining: 96000 / 120000
      render(<CooldownTimer remainingMs={96000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveAttribute('data-zone', 'green')
    })

    it('amber zone when 25-50% remaining', () => {
      // 30% remaining: 36000 / 120000
      render(<CooldownTimer remainingMs={36000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveAttribute('data-zone', 'amber')
    })

    it('red zone when <25% remaining', () => {
      // 10% remaining: 12000 / 120000
      render(<CooldownTimer remainingMs={12000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveAttribute('data-zone', 'red')
    })

    it('expired zone when 0ms remaining', () => {
      render(<CooldownTimer remainingMs={0} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveAttribute('data-zone', 'expired')
    })
  })

  // ─── display text ─────────────────────────────────────────────────

  describe('display text', () => {
    it('shows remaining time as center text for sm size (e.g., "5:00")', () => {
      // 5 minutes = 300000ms
      render(<CooldownTimer remainingMs={300000} totalMs={600000} size="sm" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveTextContent('5:00')
    })

    it('shows remaining time as center text for md size', () => {
      // 5 minutes = 300000ms
      render(<CooldownTimer remainingMs={300000} totalMs={600000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveTextContent('5:00')
    })

    it('shows "TRIPPED" when expired (remainingMs <= 0)', () => {
      render(<CooldownTimer remainingMs={0} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveTextContent('TRIPPED')
    })

    it('shows seconds correctly (e.g., 90s shows "1:30")', () => {
      // 90 seconds = 90000ms
      render(<CooldownTimer remainingMs={90000} totalMs={300000} size="lg" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveTextContent('1:30')
    })
  })

  // ─── expired state ────────────────────────────────────────────────

  describe('expired state', () => {
    it('expired timer has data-expired="true" attribute', () => {
      render(<CooldownTimer remainingMs={0} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container).toHaveAttribute('data-expired', 'true')
    })

    it('expired timer does NOT apply pulse animation class', () => {
      render(<CooldownTimer remainingMs={0} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container.className).not.toMatch(/animate-pulse/)
    })
  })

  // ─── pulse animation ─────────────────────────────────────────────

  describe('pulse animation', () => {
    it('red zone (not expired) has animate-pulse class', () => {
      // 10% remaining: 12000 / 120000
      render(<CooldownTimer remainingMs={12000} totalMs={120000} size="md" />)
      const container = screen.getByTestId('cooldown-timer')
      expect(container.className).toMatch(/animate-pulse/)
    })
  })
})
