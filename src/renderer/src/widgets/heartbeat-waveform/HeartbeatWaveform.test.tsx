import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeartbeatWaveform from './HeartbeatWaveform'

describe('HeartbeatWaveform', () => {
  describe('rendering', () => {
    it('renders a canvas element', () => {
      render(<HeartbeatWaveform status="busy" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas.tagName.toLowerCase()).toBe('canvas')
    })

    it('canvas has correct height of 24 for raid density', () => {
      render(<HeartbeatWaveform status="busy" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('height', '24')
    })

    it('canvas has correct height of 60 for channel density', () => {
      render(<HeartbeatWaveform status="idle" height={60} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('height', '60')
    })

    it('sets data-status attribute for testing', () => {
      render(<HeartbeatWaveform status="locked" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-status', 'locked')
    })
  })

  describe('animation state', () => {
    it('does not animate when status is completed', () => {
      render(<HeartbeatWaveform status="completed" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-animating', 'false')
    })

    it('does not animate when status is paused', () => {
      render(<HeartbeatWaveform status="paused" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-animating', 'false')
    })

    it('animates when status is busy', () => {
      render(<HeartbeatWaveform status="busy" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-animating', 'true')
    })

    it('animates when status is locked', () => {
      render(<HeartbeatWaveform status="locked" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-animating', 'true')
    })

    it('animates when status is spawning', () => {
      render(<HeartbeatWaveform status="spawning" height={24} />)
      const canvas = screen.getByTestId('heartbeat-canvas')
      expect(canvas).toHaveAttribute('data-animating', 'true')
    })
  })
})
