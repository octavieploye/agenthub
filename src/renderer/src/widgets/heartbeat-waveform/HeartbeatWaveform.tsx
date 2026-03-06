import { useRef, useEffect, useCallback } from 'react'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'

interface HeartbeatWaveformProps {
  status: AgentLifecycleStatus
  height: number
}

const ACTIVE_STATUSES: Set<AgentLifecycleStatus> = new Set([
  'spawning', 'busy', 'idle', 'locked', 'looping'
])

function HeartbeatWaveform({ status, height }: HeartbeatWaveformProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const shouldAnimate = ACTIVE_STATUSES.has(status)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const now = performance.now() / 1000

    ctx.clearRect(0, 0, w, h)
    ctx.strokeStyle = 'rgba(124, 147, 238, 0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()

    const midY = h / 2

    if (status === 'busy') {
      for (let x = 0; x < w; x++) {
        const amplitude = h * 0.35
        const y = midY + Math.sin((x / w) * Math.PI * 4 + now * 3) * amplitude
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    } else if (status === 'locked') {
      for (let x = 0; x < w; x++) {
        const spike = Math.abs(((x + now * 60) % 40) - 20) < 2 ? h * 0.4 : 0
        const y = midY - spike
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    } else if (status === 'idle') {
      for (let x = 0; x < w; x++) {
        const micro = Math.sin((x / w) * Math.PI * 2 + now) * h * 0.05
        const y = midY + micro
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    } else {
      ctx.moveTo(0, midY)
      ctx.lineTo(w, midY)
    }

    ctx.stroke()

    if (shouldAnimate) {
      animationRef.current = requestAnimationFrame(draw)
    }
  }, [status, height, shouldAnimate])

  useEffect(() => {
    if (shouldAnimate) {
      animationRef.current = requestAnimationFrame(draw)
    } else {
      draw()
    }
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw, shouldAnimate])

  return (
    <canvas
      ref={canvasRef}
      data-testid="heartbeat-canvas"
      data-status={status}
      data-animating={String(shouldAnimate)}
      width={160}
      height={height}
      className="w-full"
    />
  )
}

export default HeartbeatWaveform
