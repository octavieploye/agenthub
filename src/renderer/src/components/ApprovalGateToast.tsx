import { ShieldCheck } from 'lucide-react'
import { useOrchestratorStore } from '../stores/orchestrator-store'

interface ApprovalGateToastProps {
  showRecovery: boolean
}

export function ApprovalGateToast({ showRecovery }: ApprovalGateToastProps) {
  const { pendingApproval, approveTask, denyTask } = useOrchestratorStore()

  if (showRecovery) return null
  if (!pendingApproval) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4" data-testid="approval-gate-toast">
      <div className="alert alert-info shadow-lg">
        <div className="flex items-start gap-3 w-full">
          <ShieldCheck size={18} className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <span className="font-semibold text-sm">Task requires approval</span>
            <span className="text-xs opacity-80 truncate">{pendingApproval.title}</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              className="btn btn-xs btn-success"
              onClick={approveTask}
              aria-label="Approve task dispatch"
            >
              Approve
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={denyTask}
              aria-label="Deny task dispatch"
            >
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
