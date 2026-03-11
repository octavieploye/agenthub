import { useNotificationStore } from '@renderer/stores/notification-store'
import type { ToastSeverity } from '@shared/types/notification.types'

const ACCENT_COLORS: Record<ToastSeverity, string> = {
  info: 'bg-info',
  warning: 'bg-warning',
  error: 'bg-error'
}

export default function ToastManager() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismissToast = useNotificationStore((s) => s.dismissToast)

  const sortedToasts = [...toasts].sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div
      data-testid="toast-manager"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80"
    >
      {sortedToasts.map((toast) => (
        <div
          key={toast.id}
          data-testid={`toast-item-${toast.id}`}
          role="alert"
          className="panel-glass animate-slide-in-right flex overflow-hidden rounded-lg"
        >
          <div
            data-testid="toast-accent-bar"
            className={`w-1 shrink-0 ${ACCENT_COLORS[toast.severity]}`}
          />
          <div className="flex-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-base-content">{toast.title}</p>
                <p className="text-xs text-base-content/70 mt-0.5">{toast.message}</p>
                {toast.agentName && (
                  <p
                    data-testid="toast-agent-name"
                    className="text-xs text-primary mt-1"
                  >
                    {toast.agentName}
                  </p>
                )}
              </div>
              <button
                data-testid={`toast-dismiss-${toast.id}`}
                onClick={() => dismissToast(toast.id)}
                className="text-base-content/50 hover:text-base-content text-sm leading-none"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
            {toast.actions && toast.actions.length > 0 && (
              <div data-testid="toast-actions" className="flex gap-2 mt-2">
                {toast.actions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="btn btn-xs btn-ghost text-primary"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
