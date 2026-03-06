interface KillConfirmToastProps {
  agentName: string
  onConfirm: () => void
  onCancel: () => void
}

function KillConfirmToast({ agentName, onConfirm, onCancel }: KillConfirmToastProps): React.JSX.Element {
  return (
    <div
      data-testid="kill-confirm-toast"
      className="panel-glass rounded-lg shadow-lg p-3 flex items-center gap-3"
    >
      <span className="text-xs text-base-content/70">
        Kill <strong>{agentName}</strong>?
      </span>
      <button
        data-testid="kill-confirm-button"
        className="btn btn-xs btn-error"
        onClick={onConfirm}
      >
        Confirm
      </button>
      <button
        data-testid="kill-cancel-button"
        className="btn btn-xs btn-ghost"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}

export default KillConfirmToast
