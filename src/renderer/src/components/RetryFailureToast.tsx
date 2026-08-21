import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useOrchestratorStore } from '../stores/orchestrator-store'

interface RetryFailureToastProps {
  showRecovery: boolean
}

export function RetryFailureToast({ showRecovery }: RetryFailureToastProps) {
  const { retryFailures, fetchRetryFailures, acknowledgeRetryFailures } = useOrchestratorStore()

  useEffect(() => {
    if (!showRecovery) {
      fetchRetryFailures()
    }
  }, [showRecovery, fetchRetryFailures])

  if (showRecovery) return null
  if (retryFailures.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm" data-testid="retry-failure-toast">
      <div className="alert alert-warning shadow-lg">
        <div className="flex items-start gap-3 w-full">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="font-semibold text-sm">
              {retryFailures.length} task{retryFailures.length > 1 ? 's' : ''} failed overnight
            </span>
            <span className="text-xs opacity-80">
              Ollama Cloud was unreachable. Tasks moved to Interrupted.
            </span>
          </div>
          <button
            className="btn btn-xs btn-ghost shrink-0"
            onClick={acknowledgeRetryFailures}
            aria-label="Dismiss retry failures"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
