import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendDesktopNotification,
  type DesktopNotificationDeps
} from './desktop-notification'
import type { DesktopNotificationPayload } from '@shared/types/notification.types'

function createMockNotification(): {
  on: ReturnType<typeof vi.fn>
  show: ReturnType<typeof vi.fn>
} {
  return {
    on: vi.fn(),
    show: vi.fn()
  }
}

function createDeps(
  overrides: Partial<DesktopNotificationDeps> = {}
): DesktopNotificationDeps {
  const mockNotification = createMockNotification()
  return {
    createNotification: vi.fn().mockReturnValue(mockNotification),
    isSupported: vi.fn().mockReturnValue(true),
    focusWindow: vi.fn(),
    focusAgent: vi.fn(),
    ...overrides
  }
}

function createLockedPayload(
  overrides: Partial<DesktopNotificationPayload> = {}
): DesktopNotificationPayload {
  return {
    agentId: 'agent-1',
    agentName: 'Builder',
    repoName: 'my-project',
    taskDescription: 'Implement feature X',
    status: 'locked',
    question: 'Which database should I use?',
    ...overrides
  }
}

function createCompletedPayload(
  overrides: Partial<DesktopNotificationPayload> = {}
): DesktopNotificationPayload {
  return {
    agentId: 'agent-2',
    agentName: 'Tester',
    repoName: 'my-project',
    taskDescription: 'Run integration tests',
    status: 'completed',
    ...overrides
  }
}

describe('Desktop Notification Service', () => {
  let deps: DesktopNotificationDeps

  beforeEach(() => {
    deps = createDeps()
  })

  // ── Title formatting ─────────────────────────────────────────────────

  describe('notification title', () => {
    it('creates notification with title "Agent Needs Input" for LOCKED agent', () => {
      const payload = createLockedPayload()
      sendDesktopNotification(payload, deps)

      expect(deps.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Agent Needs Input' })
      )
    })

    it('creates notification with title "Agent Completed" for COMPLETED agent', () => {
      const payload = createCompletedPayload()
      sendDesktopNotification(payload, deps)

      expect(deps.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Agent Completed' })
      )
    })
  })

  // ── Body formatting ──────────────────────────────────────────────────

  describe('notification body', () => {
    it('body for LOCKED agent includes agentName, repoName, and question', () => {
      const payload = createLockedPayload({
        agentName: 'Builder',
        repoName: 'my-project',
        question: 'Which database should I use?'
      })
      sendDesktopNotification(payload, deps)

      expect(deps.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Builder (my-project): Which database should I use?'
        })
      )
    })

    it('body for COMPLETED agent includes agentName, repoName, and taskDescription', () => {
      const payload = createCompletedPayload({
        agentName: 'Tester',
        repoName: 'my-project',
        taskDescription: 'Run integration tests'
      })
      sendDesktopNotification(payload, deps)

      expect(deps.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Tester (my-project): Run integration tests'
        })
      )
    })
  })

  // ── show() ───────────────────────────────────────────────────────────

  describe('show behavior', () => {
    it('calls show() on the created notification', () => {
      const mockNotification = createMockNotification()
      deps = createDeps({
        createNotification: vi.fn().mockReturnValue(mockNotification)
      })
      const payload = createLockedPayload()

      sendDesktopNotification(payload, deps)

      expect(mockNotification.show).toHaveBeenCalledOnce()
    })
  })

  // ── isSupported check ────────────────────────────────────────────────

  describe('isSupported guard', () => {
    it('does NOT send notification if isSupported() returns false', () => {
      deps = createDeps({
        isSupported: vi.fn().mockReturnValue(false)
      })
      const payload = createLockedPayload()

      sendDesktopNotification(payload, deps)

      expect(deps.createNotification).not.toHaveBeenCalled()
    })

    it('returns false when notifications are not supported', () => {
      deps = createDeps({
        isSupported: vi.fn().mockReturnValue(false)
      })
      const payload = createLockedPayload()

      const result = sendDesktopNotification(payload, deps)

      expect(result).toBe(false)
    })

    it('returns true on successful notification send', () => {
      const payload = createLockedPayload()

      const result = sendDesktopNotification(payload, deps)

      expect(result).toBe(true)
    })
  })

  // ── click handling ───────────────────────────────────────────────────

  describe('notification click', () => {
    it('registers a click handler on the notification', () => {
      const mockNotification = createMockNotification()
      deps = createDeps({
        createNotification: vi.fn().mockReturnValue(mockNotification)
      })
      const payload = createLockedPayload()

      sendDesktopNotification(payload, deps)

      expect(mockNotification.on).toHaveBeenCalledWith('click', expect.any(Function))
    })

    it('on click: calls focusWindow() and focusAgent(agentId)', () => {
      const mockNotification = createMockNotification()
      // Capture the click callback
      let clickCallback: (() => void) | undefined
      mockNotification.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'click') {
          clickCallback = cb
        }
      })

      deps = createDeps({
        createNotification: vi.fn().mockReturnValue(mockNotification)
      })
      const payload = createLockedPayload({ agentId: 'agent-42' })

      sendDesktopNotification(payload, deps)

      // Simulate the click
      expect(clickCallback).toBeDefined()
      clickCallback!()

      expect(deps.focusWindow).toHaveBeenCalledOnce()
      expect(deps.focusAgent).toHaveBeenCalledWith('agent-42')
    })

    it('on click: calls focusAgent with the correct agentId for completed agent', () => {
      const mockNotification = createMockNotification()
      let clickCallback: (() => void) | undefined
      mockNotification.on.mockImplementation((event: string, cb: () => void) => {
        if (event === 'click') {
          clickCallback = cb
        }
      })

      deps = createDeps({
        createNotification: vi.fn().mockReturnValue(mockNotification)
      })
      const payload = createCompletedPayload({ agentId: 'agent-99' })

      sendDesktopNotification(payload, deps)

      clickCallback!()

      expect(deps.focusWindow).toHaveBeenCalledOnce()
      expect(deps.focusAgent).toHaveBeenCalledWith('agent-99')
    })
  })
})
