import { describe, it, expect } from 'vitest'
import { routeNotification, DEFAULT_CONFIG } from './notification-router'
import type { NotificationRouterConfig, RoutingResult } from '@shared/types/notification.types'
import type { TriageEvent } from '@shared/types/triage.types'

// ─── Helper ─────────────────────────────────────────────────────────────────

function makeTriageEvent(overrides: Partial<TriageEvent> = {}): TriageEvent {
  return {
    agentId: 'agent-001',
    agentName: 'TestAgent',
    repoName: 'test-repo',
    taskDescription: 'Fix the login bug',
    previousStatus: 'idle',
    currentStatus: 'busy',
    triageLevel: 'low',
    timestamp: Date.now(),
    reason: 'Agent working',
    requiresUserAction: false,
    requiresSoundAlert: false,
    isTaskCompleted: false,
    ...overrides
  }
}

function allEnabled(): NotificationRouterConfig {
  return {
    desktopEnabled: true,
    soundEnabled: true,
    voiceEnabled: true,
    telegramEnabled: true
  }
}

function allDisabled(): NotificationRouterConfig {
  return {
    desktopEnabled: false,
    soundEnabled: false,
    voiceEnabled: false,
    telegramEnabled: false
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Notification Router', () => {
  // ─── Layer 1 (toast) — always fires ───────────────────────────────────────

  describe('Layer 1 (toast) — always fires', () => {
    it('includes toast for low triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toContain('toast')
    })

    it('includes toast for medium triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toContain('toast')
    })

    it('includes toast for high triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toContain('toast')
    })

    it('includes toast for critical triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toContain('toast')
    })

    it('includes toast even when all other layers are disabled', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const result: RoutingResult = routeNotification(event, allDisabled())
      expect(result.layers).toContain('toast')
    })
  })

  // ─── Layer 2 (desktop) — medium+ when enabled ────────────────────────────

  describe('Layer 2 (desktop) — medium+ when enabled', () => {
    it('does NOT include desktop for low triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('desktop')
    })

    it('includes desktop for medium triage level when enabled', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const config: NotificationRouterConfig = { ...allDisabled(), desktopEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('desktop')
    })

    it('includes desktop for high triage level when enabled', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const config: NotificationRouterConfig = { ...allDisabled(), desktopEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('desktop')
    })

    it('includes desktop for critical triage level when enabled', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allDisabled(), desktopEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('desktop')
    })

    it('does NOT include desktop for medium when desktopEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const config: NotificationRouterConfig = { ...allEnabled(), desktopEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('desktop')
    })

    it('does NOT include desktop for high when desktopEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const config: NotificationRouterConfig = { ...allEnabled(), desktopEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('desktop')
    })

    it('does NOT include desktop for critical when desktopEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allEnabled(), desktopEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('desktop')
    })
  })

  // ─── Layer 3 (sound) — high+ when enabled ────────────────────────────────

  describe('Layer 3 (sound) — high+ when enabled', () => {
    it('does NOT include sound for low triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('sound')
    })

    it('does NOT include sound for medium triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('sound')
    })

    it('includes sound for high triage level when enabled and requiresSoundAlert', () => {
      const event = makeTriageEvent({ triageLevel: 'high', requiresSoundAlert: true })
      const config: NotificationRouterConfig = { ...allDisabled(), soundEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('sound')
    })

    it('includes sound for critical triage level when enabled and requiresSoundAlert', () => {
      const event = makeTriageEvent({ triageLevel: 'critical', requiresSoundAlert: true })
      const config: NotificationRouterConfig = { ...allDisabled(), soundEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('sound')
    })

    it('does NOT include sound for high when requiresSoundAlert is false', () => {
      const event = makeTriageEvent({ triageLevel: 'high', requiresSoundAlert: false })
      const config: NotificationRouterConfig = { ...allDisabled(), soundEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('sound')
    })

    it('does NOT include sound for high when soundEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const config: NotificationRouterConfig = { ...allEnabled(), soundEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('sound')
    })

    it('does NOT include sound for critical when soundEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allEnabled(), soundEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('sound')
    })
  })

  // ─── Layer 4 (voice) — critical only when enabled ────────────────────────

  describe('Layer 4 (voice) — critical only when enabled', () => {
    it('does NOT include voice for low triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('voice')
    })

    it('does NOT include voice for medium triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('voice')
    })

    it('does NOT include voice for high triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('voice')
    })

    it('includes voice for critical triage level when enabled', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allDisabled(), voiceEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('voice')
    })

    it('does NOT include voice for critical when voiceEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allEnabled(), voiceEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('voice')
    })
  })

  // ─── Layer 5 (telegram) — critical only when enabled ─────────────────────

  describe('Layer 5 (telegram) — critical only when enabled', () => {
    it('does NOT include telegram for low triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('telegram')
    })

    it('does NOT include telegram for medium triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('telegram')
    })

    it('does NOT include telegram for high triage level', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).not.toContain('telegram')
    })

    it('includes telegram for critical triage level when enabled', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allDisabled(), telegramEnabled: true }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).toContain('telegram')
    })

    it('does NOT include telegram for critical when telegramEnabled is false', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const config: NotificationRouterConfig = { ...allEnabled(), telegramEnabled: false }
      const result: RoutingResult = routeNotification(event, config)
      expect(result.layers).not.toContain('telegram')
    })
  })

  // ─── DEFAULT_CONFIG ───────────────────────────────────────────────────────

  describe('DEFAULT_CONFIG', () => {
    it('has desktopEnabled true by default', () => {
      expect(DEFAULT_CONFIG.desktopEnabled).toBe(true)
    })

    it('has soundEnabled true by default', () => {
      expect(DEFAULT_CONFIG.soundEnabled).toBe(true)
    })

    it('has voiceEnabled false by default', () => {
      expect(DEFAULT_CONFIG.voiceEnabled).toBe(false)
    })

    it('has telegramEnabled false by default', () => {
      expect(DEFAULT_CONFIG.telegramEnabled).toBe(false)
    })
  })

  // ─── RoutingResult structure ──────────────────────────────────────────────

  describe('RoutingResult structure', () => {
    it('includes the original triageEvent in the result', () => {
      const event = makeTriageEvent({
        agentId: 'agent-xyz',
        agentName: 'BuildBot',
        triageLevel: 'high'
      })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.triageEvent).toBe(event)
    })

    it('layers is an array', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(Array.isArray(result.layers)).toBe(true)
    })

    it('layers contains no duplicates', () => {
      const event = makeTriageEvent({ triageLevel: 'critical' })
      const result: RoutingResult = routeNotification(event, allEnabled())
      const uniqueLayers = new Set(result.layers)
      expect(uniqueLayers.size).toBe(result.layers.length)
    })
  })

  // ─── Full routing with DEFAULT_CONFIG ─────────────────────────────────────

  describe('full routing with DEFAULT_CONFIG', () => {
    it('low event -> toast only', () => {
      const event = makeTriageEvent({ triageLevel: 'low' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toEqual(['toast'])
    })

    it('medium event -> toast + desktop', () => {
      const event = makeTriageEvent({ triageLevel: 'medium' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toEqual(['toast', 'desktop'])
    })

    it('high event with sound alert -> toast + desktop + sound', () => {
      const event = makeTriageEvent({ triageLevel: 'high', requiresSoundAlert: true })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toEqual(['toast', 'desktop', 'sound'])
    })

    it('high event without sound alert -> toast + desktop (no sound)', () => {
      const event = makeTriageEvent({ triageLevel: 'high' })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toEqual(['toast', 'desktop'])
    })

    it('critical event with sound alert -> toast + desktop + sound (voice off by default)', () => {
      const event = makeTriageEvent({ triageLevel: 'critical', requiresSoundAlert: true })
      const result: RoutingResult = routeNotification(event, DEFAULT_CONFIG)
      expect(result.layers).toEqual(['toast', 'desktop', 'sound'])
    })
  })

  // ─── Full routing with all layers enabled ─────────────────────────────────

  describe('full routing with all layers enabled', () => {
    it('critical event with sound alert -> toast + desktop + sound + voice + telegram', () => {
      const event = makeTriageEvent({ triageLevel: 'critical', requiresSoundAlert: true })
      const result: RoutingResult = routeNotification(event, allEnabled())
      expect(result.layers).toEqual(['toast', 'desktop', 'sound', 'voice', 'telegram'])
    })
  })
})
