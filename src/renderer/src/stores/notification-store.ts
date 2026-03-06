import { create } from 'zustand'
import type { ToastNotification, ToastSeverity } from '@shared/types/notification.types'

const MAX_VISIBLE_TOASTS = 3

const AUTO_DISMISS_MS: Record<ToastSeverity, number | null> = {
  info: 3000,
  warning: 5000,
  error: null
}

interface NotificationStore {
  toasts: ToastNotification[]
  desktopNotificationsEnabled: boolean
  addToast: (toast: ToastNotification) => void
  dismissToast: (id: string) => void
  clearAll: () => void
  toggleDesktopNotifications: () => void
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  toasts: [],
  desktopNotificationsEnabled: true,

  addToast: (toast) => {
    set((state) => {
      const updated = [...state.toasts, toast]
      if (updated.length > MAX_VISIBLE_TOASTS) {
        const removed = updated.shift()
        if (removed) {
          const timer = timers.get(removed.id)
          if (timer) {
            clearTimeout(timer)
            timers.delete(removed.id)
          }
        }
      }
      return { toasts: updated }
    })

    const dismissDelay = AUTO_DISMISS_MS[toast.severity]
    if (dismissDelay !== null) {
      const timer = setTimeout(() => {
        timers.delete(toast.id)
        get().dismissToast(toast.id)
      }, dismissDelay)
      timers.set(toast.id, timer)
    }
  },

  dismissToast: (id) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },

  clearAll: () => {
    for (const [id, timer] of timers) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set({ toasts: [] })
  },

  toggleDesktopNotifications: () =>
    set((state) => ({ desktopNotificationsEnabled: !state.desktopNotificationsEnabled }))
}))
