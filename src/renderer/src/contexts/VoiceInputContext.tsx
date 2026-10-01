import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode
} from 'react'
import { useViewStore } from '../stores/view-store'

interface VoiceRegistration {
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  toggleFn: () => void
  /** Agent this input belongs to, when it is an agent-scoped field. */
  ownerId?: string
  /** Voice capability is explicit; prompt writability is a separate concern. */
  canDictate: boolean
}

interface VoiceInputContextValue {
  register: (id: string, registration: VoiceRegistration) => void
  unregister: (id: string) => void
}

const VoiceInputContext = createContext<VoiceInputContextValue | null>(null)

export function VoiceInputProvider({ children }: { children: ReactNode }): ReactElement {
  const registrations = useRef(new Map<string, VoiceRegistration>())
  const keyDownTimeRef = useRef<number>(0)
  const startedThisPress = useRef(false)
  const activeToggleFn = useRef<(() => void) | null>(null)

  const register = useCallback((id: string, registration: VoiceRegistration) => {
    registrations.current.set(id, registration)
  }, [])

  const unregister = useCallback((id: string) => {
    registrations.current.delete(id)
  }, [])

  useEffect(() => {
    const HOLD_THRESHOLD_MS = 300

    // Prompt writability and dictation are deliberately separate. A busy
    // agent may reject typed input while still accepting a voice draft.
    const canTarget = (reg: VoiceRegistration): boolean => !!reg.inputRef.current && reg.canDictate

    const findTarget = (): VoiceRegistration | undefined => {
      const active = document.activeElement
      // First: the focused field wins — the user pointed at it.
      for (const reg of registrations.current.values()) {
        if (reg.inputRef.current === active && canTarget(reg)) return reg
      }
      // Second: the field belonging to the focused agent pane. Once that pane
      // owns a voice destination, it is the only candidate. If dictation is
      // explicitly unavailable, falling through would target another agent.
      const focusedAgentId = useViewStore.getState().focusedAgentId
      if (focusedAgentId) {
        const owned = [...registrations.current.values()].filter(
          (reg) => reg.ownerId === focusedAgentId
        )
        if (owned.length > 0) {
          const eligibleOwned = owned.filter(canTarget)
          return eligibleOwned.length === 1 ? eligibleOwned[0] : undefined
        }
      }
      // Third: a single dictatable field is unambiguous. More than one and we
      // stop — picking "most recently mounted" used to type into another
      // agent's prompt.
      const eligible = [...registrations.current.values()].filter(canTarget)
      return eligible.length === 1 ? eligible[0] : undefined
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
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

    const handleKeyUp = (e: KeyboardEvent): void => {
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
