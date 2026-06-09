import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react'

interface VoiceRegistration {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  toggleFn: () => void
}

interface VoiceInputContextValue {
  register: (id: string, inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, toggleFn: () => void) => void
  unregister: (id: string) => void
}

const VoiceInputContext = createContext<VoiceInputContextValue | null>(null)

export function VoiceInputProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, VoiceRegistration>())
  const keyDownTimeRef = useRef<number>(0)
  const startedThisPress = useRef(false)
  const activeToggleFn = useRef<(() => void) | null>(null)

  const register = useCallback((id: string, inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, toggleFn: () => void) => {
    registrations.current.set(id, { inputRef, toggleFn })
  }, [])

  const unregister = useCallback((id: string) => {
    registrations.current.delete(id)
  }, [])

  useEffect(() => {
    const HOLD_THRESHOLD_MS = 300

    const findTarget = (): VoiceRegistration | undefined => {
      const active = document.activeElement
      // First: find registration whose inputRef matches the focused element
      for (const reg of registrations.current.values()) {
        if (reg.inputRef.current === active) return reg
      }
      // Fallback: last registered (most recently mounted)
      let last: VoiceRegistration | undefined
      for (const reg of registrations.current.values()) {
        last = reg
      }
      return last
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey && e.key === 'e' && !e.repeat) {
        e.preventDefault()
        keyDownTimeRef.current = Date.now()
        const target = findTarget()
        if (!target) return
        activeToggleFn.current = target.toggleFn
        // We always call toggle on keydown - it will start if not listening, or we handle stop on keyup
        // For now, just start recording
        target.toggleFn()
        startedThisPress.current = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && keyDownTimeRef.current > 0) {
        const held = Date.now() - keyDownTimeRef.current
        keyDownTimeRef.current = 0
        if (held >= HOLD_THRESHOLD_MS && startedThisPress.current && activeToggleFn.current) {
          // Push-to-talk: release stops recording
          activeToggleFn.current()
        }
        startedThisPress.current = false
        activeToggleFn.current = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  return (
    <VoiceInputContext.Provider value={{ register, unregister }}>
      {children}
    </VoiceInputContext.Provider>
  )
}

const noopContext: VoiceInputContextValue = {
  register: () => {},
  unregister: () => {}
}

export function useVoiceInputContext(): VoiceInputContextValue {
  return useContext(VoiceInputContext) ?? noopContext
}
