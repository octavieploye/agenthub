import type { AgentState, VoiceMode } from '@shared/types/agent.types'
import { useViewStore } from '@renderer/stores/view-store'
import RaidFrame from './RaidFrame'

interface RaidFrameGridProps {
  agents: AgentState[]
  onSelectAgent?: (agentId: string) => void
  onContextMenu?: (agentId: string, position: { x: number; y: number }) => void
  onToggleVoiceMode?: (agentId: string, mode: VoiceMode) => void
}

function RaidFrameGrid({ agents, onSelectAgent, onContextMenu, onToggleVoiceMode }: RaidFrameGridProps): React.JSX.Element {
  const statusFilter = useViewStore((s) => s.statusFilter)

  const filtered = statusFilter
    ? agents.filter((a) => a.status === statusFilter)
    : agents

  if (filtered.length === 0) {
    return (
      <div data-testid="raid-frame-grid-empty" className="flex items-center justify-center h-full">
        <span className="text-sm text-base-content/40">
          {statusFilter ? `No ${statusFilter} agents` : 'No agents running'}
        </span>
      </div>
    )
  }

  return (
    <div
      data-testid="raid-frame-grid"
      className="grid gap-2 p-3"
      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
    >
      {filtered.map((agent) => (
        <RaidFrame
          key={agent.id}
          agent={agent}
          onSelect={onSelectAgent ?? (() => {})}
          onContextMenu={onContextMenu ?? (() => {})}
          onToggleVoiceMode={onToggleVoiceMode}
        />
      ))}
    </div>
  )
}

export default RaidFrameGrid
