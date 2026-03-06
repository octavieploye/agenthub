import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useNotificationStore } from './notification-store'
import type { ToastNotification } from '@shared/types/notification.types'

function createToast(overrides: Partial<ToastNotification> = {}): ToastNotification {
  return {
    id: `toast-${Date.now()}-${Math.random()}`,
    severity: 'info',
    title: 'Test Toast',
    message: 'This is a test notification',
    createdAt: Date.now(),
    ...overrides
  }
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset store state between tests
    useNotificationStore.setState({ toasts: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── addToast ────────────────────────────────────────────────────────

  describe('addToast', () => {
    it('adds a toast to the store', () => {
      const toast = createToast({ id: 'toast-1', title: 'Hello' })
      useNotificationStore.getState().addToast(toast)

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].id).toBe('toast-1')
      expect(toasts[0].title).toBe('Hello')
    })

    it('adds multiple toasts to the store', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1' }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-2' }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-3' }))

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(3)
    })

    it('preserves all toast fields (severity, message, agentId, agentName, actions)', () => {
      const action = { label: 'View', onClick: vi.fn() }
      const toast = createToast({
        id: 'toast-full',
        severity: 'warning',
        title: 'Agent Warning',
        message: 'Something happened',
        agentId: 'agent-42',
        agentName: 'Builder',
        actions: [action]
      })
      useNotificationStore.getState().addToast(toast)

      const stored = useNotificationStore.getState().toasts[0]
      expect(stored.severity).toBe('warning')
      expect(stored.message).toBe('Something happened')
      expect(stored.agentId).toBe('agent-42')
      expect(stored.agentName).toBe('Builder')
      expect(stored.actions).toHaveLength(1)
      expect(stored.actions![0].label).toBe('View')
    })
  })

  // ── dismissToast ──────────────────────────────────────────────────

  describe('dismissToast', () => {
    it('removes a toast by id', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1' }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-2' }))

      useNotificationStore.getState().dismissToast('toast-1')

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(1)
      expect(toasts[0].id).toBe('toast-2')
    })

    it('does nothing when dismissing a non-existent id', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1' }))
      useNotificationStore.getState().dismissToast('non-existent')

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(1)
    })
  })

  // ── clearAll ──────────────────────────────────────────────────────

  describe('clearAll', () => {
    it('removes all toasts', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1' }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-2' }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-3' }))

      useNotificationStore.getState().clearAll()

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(0)
    })

    it('clearAll on empty store does not throw', () => {
      expect(() => useNotificationStore.getState().clearAll()).not.toThrow()
      expect(useNotificationStore.getState().toasts).toHaveLength(0)
    })
  })

  // ── max 3 visible ─────────────────────────────────────────────────

  describe('max 3 toasts', () => {
    it('enforces max 3 visible: adding a 4th removes the oldest', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1', createdAt: 1000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-2', createdAt: 2000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-3', createdAt: 3000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-4', createdAt: 4000 }))

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(3)
      // The oldest (toast-1) should be removed
      const ids = toasts.map((t) => t.id)
      expect(ids).not.toContain('toast-1')
      expect(ids).toContain('toast-2')
      expect(ids).toContain('toast-3')
      expect(ids).toContain('toast-4')
    })

    it('adding a 5th removes the second oldest (only 3 remain)', () => {
      useNotificationStore.getState().addToast(createToast({ id: 'toast-1', createdAt: 1000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-2', createdAt: 2000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-3', createdAt: 3000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-4', createdAt: 4000 }))
      useNotificationStore.getState().addToast(createToast({ id: 'toast-5', createdAt: 5000 }))

      const { toasts } = useNotificationStore.getState()
      expect(toasts).toHaveLength(3)
      const ids = toasts.map((t) => t.id)
      expect(ids).toContain('toast-3')
      expect(ids).toContain('toast-4')
      expect(ids).toContain('toast-5')
    })
  })

  // ── auto-dismiss timers ───────────────────────────────────────────

  describe('auto-dismiss timers', () => {
    it('info toasts auto-dismiss after 3000ms', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'info-toast', severity: 'info' })
      )
      expect(useNotificationStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(3000)

      expect(useNotificationStore.getState().toasts).toHaveLength(0)
    })

    it('info toasts are still present before 3000ms', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'info-toast', severity: 'info' })
      )

      vi.advanceTimersByTime(2999)

      expect(useNotificationStore.getState().toasts).toHaveLength(1)
    })

    it('warning toasts auto-dismiss after 5000ms', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'warn-toast', severity: 'warning' })
      )
      expect(useNotificationStore.getState().toasts).toHaveLength(1)

      vi.advanceTimersByTime(5000)

      expect(useNotificationStore.getState().toasts).toHaveLength(0)
    })

    it('warning toasts are still present before 5000ms', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'warn-toast', severity: 'warning' })
      )

      vi.advanceTimersByTime(4999)

      expect(useNotificationStore.getState().toasts).toHaveLength(1)
    })

    it('error toasts do NOT auto-dismiss', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'error-toast', severity: 'error' })
      )

      // Advance well beyond info and warning timeouts
      vi.advanceTimersByTime(60000)

      expect(useNotificationStore.getState().toasts).toHaveLength(1)
      expect(useNotificationStore.getState().toasts[0].id).toBe('error-toast')
    })

    it('dismissing a toast manually clears its auto-dismiss timer (no error after manual dismiss)', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'info-toast', severity: 'info' })
      )

      // Dismiss before timer fires
      useNotificationStore.getState().dismissToast('info-toast')
      expect(useNotificationStore.getState().toasts).toHaveLength(0)

      // Advance past auto-dismiss — should not throw or cause issues
      expect(() => vi.advanceTimersByTime(5000)).not.toThrow()
      expect(useNotificationStore.getState().toasts).toHaveLength(0)
    })

    it('each toast gets its own independent timer', () => {
      useNotificationStore.getState().addToast(
        createToast({ id: 'info-toast', severity: 'info' })
      )

      vi.advanceTimersByTime(1000)

      useNotificationStore.getState().addToast(
        createToast({ id: 'warn-toast', severity: 'warning' })
      )

      // At t=3000 the info toast should dismiss (3000ms after creation)
      vi.advanceTimersByTime(2000)
      const afterInfoDismiss = useNotificationStore.getState().toasts
      expect(afterInfoDismiss).toHaveLength(1)
      expect(afterInfoDismiss[0].id).toBe('warn-toast')

      // At t=6000 the warning toast should dismiss (5000ms after its creation at t=1000)
      vi.advanceTimersByTime(3000)
      expect(useNotificationStore.getState().toasts).toHaveLength(0)
    })
  })

  // ── desktopNotificationsEnabled (Story 5.2) ─────────────────────────

  describe('desktopNotificationsEnabled', () => {
    beforeEach(() => {
      useNotificationStore.setState({ desktopNotificationsEnabled: true })
    })

    it('defaults to true', () => {
      // Check initial store defaults via getInitialState
      const { desktopNotificationsEnabled } = useNotificationStore.getInitialState()
      expect(desktopNotificationsEnabled).toBe(true)
    })

    it('toggleDesktopNotifications toggles the value from true to false', () => {
      useNotificationStore.getState().toggleDesktopNotifications()

      const { desktopNotificationsEnabled } = useNotificationStore.getState()
      expect(desktopNotificationsEnabled).toBe(false)
    })

    it('toggling twice returns to original state', () => {
      useNotificationStore.getState().toggleDesktopNotifications()
      useNotificationStore.getState().toggleDesktopNotifications()

      const { desktopNotificationsEnabled } = useNotificationStore.getState()
      expect(desktopNotificationsEnabled).toBe(true)
    })
  })
})
