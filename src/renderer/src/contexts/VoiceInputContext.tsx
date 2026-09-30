import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useViewStore } from '../stores/view-store'

interface VoiceRegistration {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  toggleFn: () => void
  /** Agent this input belongs to, when it is an agent-scoped field. */
  ownerId?: string
}

interface VoiceInputContextValue {
  register: (id: string, inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, toggleFn: () => void, ownerId?: string) => void
  unregister: (id: string) => void
}

const VoiceInputContext = createContext<VoiceInputContextValue | null>(null)

export function VoiceInputProvider({ children }: { children: ReactNode }) {
  const registrations = useRef(new Map<string, VoiceRegistration>())
  const keyDownTimeRef = useRef<number>(0)
  const startedThisPress = useRef(false)
  const activeToggleFn = useRef<(() => void) | null>(null)

  const register = useCallback((id: string, inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>, toggleFn: () => void, ownerId?: string) => {
    registrations.current.set(id, { inputRef, toggleFn, ownerId })
  }, [])

  const unregister = useCallback((id: string) => {
    registrations.current.delete(id)
  }, [])

  useEffect(() => {
    const HOLD_THRESHOLD_MS = 300

    // A transcript must never land in a field the user is not looking at, so
    // every candidate has to be both writable and unambiguously the target.
    const isWritable = (reg: VoiceRegistration): boolean => {
      const el = reg.inputRef.current
      return !!el && !el.disabled
    }

    const findTarget = (): VoiceRegistration | undefined => {
      const active = document.activeElement
      // First: the focused field wins — the user pointed at it.
      for (const reg of registrations.current.values()) {
        if (reg.inputRef.current === active && isWritable(reg)) return reg
      }
      // Second: the field belonging to the focused agent pane. Once that pane
      // owns a field, it is the only candidate — if its input is disabled the
      // transcript has nowhere to go, and falling through would type into a
      // different agent's prompt.
      const focusedAgentId = useViewStore.getState().focusedAgentId
      if (focusedAgentId) {
        const owned = [...registrations.current.values()].filter(
          (reg) => reg.ownerId === focusedAgentId
        )
        if (owned.length > 0) return owned.find(isWritable)
      }
      // Third: a single writable field is unambiguous. More than one and we
      // stop — picking "most recently mounted" used to type into another
      // agent's prompt.
      const writable = [...registrations.current.values()].filter(isWritable)
      return writable.length === 1 ? writable[0] : undefined
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
