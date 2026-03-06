import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ToastManager from './ToastManager'
import { useNotificationStore } from '@renderer/stores/notification-store'
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

describe('ToastManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store to empty state
    useNotificationStore.setState({ toasts: [] })
  })

  // ── empty state ───────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders container with data-testid="toast-manager"', () => {
      render(<ToastManager />)
      expect(screen.getByTestId('toast-manager')).toBeInTheDocument()
    })

    it('renders no toast items when store is empty', () => {
      render(<ToastManager />)
      expect(screen.queryByTestId(/^toast-item-/)).not.toBeInTheDocument()
    })
  })

  // ── rendering toasts ──────────────────────────────────────────────

  describe('rendering toasts', () => {
    it('renders a toast with title and message', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', title: 'Agent Done', message: 'Task completed' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast).toBeInTheDocument()
      expect(toast).toHaveTextContent('Agent Done')
      expect(toast).toHaveTextContent('Task completed')
    })

    it('renders agent name when provided', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', agentName: 'Builder' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast).toHaveTextContent('Builder')
    })

    it('does not render agent name section when agentName is undefined', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', agentName: undefined })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast.querySelector('[data-testid="toast-agent-name"]')).not.toBeInTheDocument()
    })

    it('renders multiple toasts', () => {
      useNotificationStore.setState({
        toasts: [
          createToast({ id: 'toast-1', title: 'First' }),
          createToast({ id: 'toast-2', title: 'Second' }),
          createToast({ id: 'toast-3', title: 'Third' })
        ]
      })
      render(<ToastManager />)

      expect(screen.getByTestId('toast-item-toast-1')).toBeInTheDocument()
      expect(screen.getByTestId('toast-item-toast-2')).toBeInTheDocument()
      expect(screen.getByTestId('toast-item-toast-3')).toBeInTheDocument()
    })
  })

  // ── styling ───────────────────────────────────────────────────────

  describe('styling', () => {
    it('applies panel-glass class to each toast', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast.className).toMatch(/panel-glass/)
    })

    it('applies info severity accent bar (blue/info color)', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-info', severity: 'info' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-info')
      const accentBar = toast.querySelector('[data-testid="toast-accent-bar"]')
      expect(accentBar).toBeInTheDocument()
      expect(accentBar!.className).toMatch(/bg-info|border-info|bg-blue/)
    })

    it('applies warning severity accent bar (amber/warning color)', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-warn', severity: 'warning' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-warn')
      const accentBar = toast.querySelector('[data-testid="toast-accent-bar"]')
      expect(accentBar).toBeInTheDocument()
      expect(accentBar!.className).toMatch(/bg-warning|border-warning|bg-amber/)
    })

    it('applies error severity accent bar (red/error color)', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-err', severity: 'error' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-err')
      const accentBar = toast.querySelector('[data-testid="toast-accent-bar"]')
      expect(accentBar).toBeInTheDocument()
      expect(accentBar!.className).toMatch(/bg-error|border-error|bg-red/)
    })

    it('container is positioned bottom-right (fixed positioning classes)', () => {
      render(<ToastManager />)
      const container = screen.getByTestId('toast-manager')
      expect(container.className).toMatch(/fixed/)
      expect(container.className).toMatch(/bottom-/)
      expect(container.className).toMatch(/right-/)
    })

    it('toasts have slide-in animation class', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1' })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast.className).toMatch(/animate-slide-in|slide-in-right|toast-enter/)
    })
  })

  // ── ordering ──────────────────────────────────────────────────────

  describe('ordering', () => {
    it('toasts are ordered newest on top (first in DOM is newest)', () => {
      useNotificationStore.setState({
        toasts: [
          createToast({ id: 'toast-old', title: 'Old', createdAt: 1000 }),
          createToast({ id: 'toast-mid', title: 'Mid', createdAt: 2000 }),
          createToast({ id: 'toast-new', title: 'New', createdAt: 3000 })
        ]
      })
      render(<ToastManager />)

      const container = screen.getByTestId('toast-manager')
      const toastItems = within(container).getAllByRole('alert')
      // Newest should come first in the rendered list
      expect(toastItems[0]).toHaveTextContent('New')
      expect(toastItems[1]).toHaveTextContent('Mid')
      expect(toastItems[2]).toHaveTextContent('Old')
    })
  })

  // ── actions ───────────────────────────────────────────────────────

  describe('action buttons', () => {
    it('renders action buttons when actions are provided', () => {
      const viewAction = { label: 'View Agent', onClick: vi.fn() }
      const dismissAction = { label: 'Dismiss', onClick: vi.fn() }
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', actions: [viewAction, dismissAction] })]
      })
      render(<ToastManager />)

      expect(screen.getByText('View Agent')).toBeInTheDocument()
      expect(screen.getByText('Dismiss')).toBeInTheDocument()
    })

    it('clicking action button fires the action callback', () => {
      const viewAction = { label: 'View Agent', onClick: vi.fn() }
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', actions: [viewAction] })]
      })
      render(<ToastManager />)

      fireEvent.click(screen.getByText('View Agent'))
      expect(viewAction.onClick).toHaveBeenCalledOnce()
    })

    it('does not render action buttons when no actions provided', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1', actions: undefined })]
      })
      render(<ToastManager />)

      const toast = screen.getByTestId('toast-item-toast-1')
      expect(toast.querySelector('[data-testid="toast-actions"]')).not.toBeInTheDocument()
    })
  })

  // ── dismiss button ────────────────────────────────────────────────

  describe('dismiss button', () => {
    it('renders a dismiss (X) button on each toast', () => {
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-1' })]
      })
      render(<ToastManager />)

      const dismissBtn = screen.getByTestId('toast-dismiss-toast-1')
      expect(dismissBtn).toBeInTheDocument()
    })

    it('clicking dismiss button calls dismissToast with the toast id', () => {
      const dismissSpy = vi.fn()
      useNotificationStore.setState({
        toasts: [createToast({ id: 'toast-42' })],
        dismissToast: dismissSpy
      })
      render(<ToastManager />)

      fireEvent.click(screen.getByTestId('toast-dismiss-toast-42'))
      expect(dismissSpy).toHaveBeenCalledWith('toast-42')
    })
  })

  // ── accessibility ─────────────────────────────────────────────────

  describe('accessibility', () => {
    it('container has aria-live="assertive"', () => {
      render(<ToastManager />)
      const container = screen.getByTestId('toast-manager')
      expect(container).toHaveAttribute('aria-live', 'assertive')
    })

    it('each toast has role="alert"', () => {
      useNotificationStore.setState({
        toasts: [
          createToast({ id: 'toast-1' }),
          createToast({ id: 'toast-2' })
        ]
      })
      render(<ToastManager />)

      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(2)
    })
  })
})
