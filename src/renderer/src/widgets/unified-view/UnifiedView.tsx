import { useState, useEffect, useRef } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import { useViewStore } from '@renderer/stores/view-store'
import RaidFrameGrid from '@renderer/widgets/raid-frame/RaidFrameGrid'
import FullTerminal from '@renderer/widgets/full-terminal/FullTerminal'

interface UnifiedViewProps {
  agents: AgentState[]
  onSelectAgent?: (agentId: string) => void
  onContextMenu?: (agentId: string, position: { x: number; y: number }) => void
  onSoloAgent?: (agentId: string) => void
  onMuteAgent?: (agentId: string) => void
  onKillAgent?: (agentId: string) => void
  soloedAgentId?: string | null
}

function useReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
  return mql.matches
}

function UnifiedView({ agents, onSelectAgent, onContextMenu, onSoloAgent, onMuteAgent, onKillAgent, soloedAgentId }: UnifiedViewProps): React.JSX.Element {
  const viewMode = useViewStore((s) => s.viewMode)
  const focusedAgentId = useViewStore((s) => s.focusedAgentId)
  const reducedMotion = useReducedMotion()

  const [visible, setVisible] = useState(true)
  const prevViewMode = useRef(viewMode)

  useEffect(() => {
    if (viewMode !== prevViewMode.current) {
      if (reducedMotion) {
        prevViewMode.current = viewMode
        return
      }
      setVisible(false)
      const timer = setTimeout(() => {
        setVisible(true)
        prevViewMode.current = viewMode
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [viewMode, reducedMotion])

  return (
    <div
      data-testid="unified-view"
      className="flex-1 min-h-0"
    >
      <div
        className={`flex-1 h-full transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
      {viewMode === 'raid' && (
        <RaidFrameGrid
          agents={agents}
          onSelectAgent={onSelectAgent}
          onContextMenu={onContextMenu}
        />
      )}

{viewMode === 'terminal' && focusedAgentId && (
        <FullTerminal agentId={focusedAgentId} visible={true} />
      )}

      {viewMode === 'terminal' && !focusedAgentId && (
        <div className="flex items-center justify-center h-full">
          <span className="text-sm text-base-content/40">Select an agent from the sidebar.</span>
        </div>
      )}
      </div>
    </div>
  )
}

export default UnifiedView
