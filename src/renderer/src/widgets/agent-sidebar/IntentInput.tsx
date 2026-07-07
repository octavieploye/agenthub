import { useRef, useEffect } from 'react'

interface IntentInputProps {
  value: string
  onChange: (text: string) => void
  onSubmit: (text: string) => void
  isLoading: boolean
  agentCount: number
}

function IntentInput({ value, onChange, onSubmit, isLoading, agentCount }: IntentInputProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const placeholder = agentCount === 0 ? 'What do you want to build?' : 'Start another task\u2026'

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      onChange('')
    }
    if (e.key === 'Enter' && value.trim()) {
      onSubmit(value)
    }
  }

  return (
    <div className="px-3 py-2 shrink-0">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="input input-sm w-full rounded-xl bg-base-200/50 border-base-content/10 focus:border-primary/30 focus:outline-none text-sm pr-8"
          disabled={isLoading}
        />
        {isLoading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <span className="loading loading-spinner loading-xs opacity-50" />
          </span>
        )}
      </div>
    </div>
  )
}

export default IntentInput
