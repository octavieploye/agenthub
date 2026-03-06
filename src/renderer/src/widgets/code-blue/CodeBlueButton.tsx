import { useRef, useCallback } from 'react'

interface CodeBlueButtonProps {
  onActivate: () => void
}

function CodeBlueButton({ onActivate }: CodeBlueButtonProps): React.JSX.Element {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseDown = useCallback(() => {
    timerRef.current = setTimeout(() => {
      onActivate()
      timerRef.current = null
    }, 2000)
  }, [onActivate])

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  return (
    <button
      data-testid="code-blue-button"
      className="btn btn-xs btn-error border-error text-error-content font-bold"
      onMouseDown={handleMouseDown}
      onMouseUp={cancelTimer}
      onMouseLeave={cancelTimer}
    >
      CODE BLUE
    </button>
  )
}

export default CodeBlueButton
