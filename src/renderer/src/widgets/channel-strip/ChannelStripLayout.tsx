import type { AgentState } from '@shared/types/agent.types'
import ChannelStrip from './ChannelStrip'

interface ChannelStripLayoutProps {
  agents: AgentState[]
  soloedAgentId?: string | null
  mutedAgentIds?: Set<string>
  onSelectAgent: (agentId: string) => void
  onSoloAgent: (agentId: string) => void
  onMuteAgent: (agentId: string) => void
  onKillAgent: (agentId: string) => void
}

function ChannelStripLayout({
  agents,
  soloedAgentId = null,
  mutedAgentIds,
  onSelectAgent,
  onSoloAgent,
  onMuteAgent,
  onKillAgent
}: ChannelStripLayoutProps): React.JSX.Element {
  return (
    <div
      data-testid="channel-strip-layout"
      className="flex gap-2 p-3 h-full overflow-x-auto"
    >
      {agents.map((agent) => (
        <ChannelStrip
          key={agent.id}
          agent={agent}
          onSelect={onSelectAgent}
          onSolo={onSoloAgent}
          onMute={onMuteAgent}
          onKill={onKillAgent}
          isSoloed={soloedAgentId === agent.id}
          isMuted={mutedAgentIds?.has(agent.id) ?? false}
          isDimmed={soloedAgentId !== null && soloedAgentId !== agent.id}
        />
      ))}
    </div>
  )
}

export default ChannelStripLayout
