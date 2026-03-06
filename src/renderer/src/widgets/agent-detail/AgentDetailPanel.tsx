import { useState, useEffect } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import GeneralTab from './GeneralTab'
import TerminalTab from './TerminalTab'
import NotesTab from './NotesTab'
import HistoryTab from './HistoryTab'
import TodoTab from './TodoTab'
import BugsTab from './BugsTab'

type DetailTab = 'general' | 'terminal' | 'notes' | 'history' | 'todo' | 'bugs'

interface AgentDetailPanelProps {
  agent: AgentState
  initialTab?: DetailTab
  onPause: (agentId: string) => void
  onResume: (agentId: string) => void
  onKill: (agentId: string) => void
  onSendInput: (agentId: string, data: string) => void
  onSpawnWithTask: (task: string) => void
}

const tabs: { id: DetailTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
  { id: 'todo', label: 'Todo' },
  { id: 'bugs', label: 'Bugs' }
]

function AgentDetailPanel({
  agent,
  initialTab = 'general',
  onPause,
  onResume,
  onKill,
  onSendInput,
  onSpawnWithTask
}: AgentDetailPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)

  // Sync tab when initialTab prop changes (e.g., switching to terminal view mode)
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  return (
    <div data-testid="agent-detail-panel" className="flex flex-col h-full w-full">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 py-1.5 border-b border-base-content/10 shrink-0 bg-base-200/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/20 text-primary'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'general' && (
          <GeneralTab agent={agent} onPause={onPause} onResume={onResume} onKill={onKill} />
        )}
        {activeTab === 'terminal' && (
          <TerminalTab agent={agent} onSendInput={onSendInput} />
        )}
        {activeTab === 'notes' && <NotesTab agent={agent} />}
        {activeTab === 'history' && <HistoryTab agent={agent} />}
        {activeTab === 'todo' && <TodoTab agent={agent} onSpawnWithTask={onSpawnWithTask} />}
        {activeTab === 'bugs' && <BugsTab agent={agent} />}
      </div>
    </div>
  )
}

export default AgentDetailPanel
