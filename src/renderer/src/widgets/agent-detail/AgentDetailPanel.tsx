import { useState, useEffect } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import GeneralTab from './GeneralTab'
import TerminalTab from './TerminalTab'
import NotesTab from './NotesTab'
import HistoryTab from './HistoryTab'
import TodoTab from './TodoTab'
import BugsTab from './BugsTab'
import GitTab from './GitTab'

type DetailTab = 'general' | 'terminal' | 'notes' | 'history' | 'todo' | 'bugs' | 'git'

interface AgentDetailPanelProps {
  agent: AgentState
  initialTab?: DetailTab
  onPause: (agentId: string) => void
  onResume: (agentId: string) => void
  onKill: (agentId: string) => void
  onSendInput: (agentId: string, data: string) => void
  onSpawnWithTask: (task: string) => void
  onBreakout?: (agentId: string) => void
}

const tabs: { id: DetailTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'notes', label: 'Notes' },
  { id: 'history', label: 'History' },
  { id: 'todo', label: 'Todo' },
  { id: 'bugs', label: 'Bugs' },
  { id: 'git', label: 'Git' }
]

function AgentDetailPanel({
  agent,
  initialTab = 'general',
  onPause,
  onResume,
  onKill,
  onSendInput,
  onSpawnWithTask,
  onBreakout
}: AgentDetailPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)

  // Sync tab when initialTab prop changes (e.g., switching to terminal view mode)
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  return (
    <div data-testid="agent-detail-panel" className="flex flex-col h-full w-full">
      {/* Tab bar — colored with agent color */}
      <div
        className="flex gap-1 px-3 py-1.5 border-b shrink-0"
        role="tablist"
        aria-label="Agent detail tabs"
        style={{ borderBottomColor: `${agent.color}40`, backgroundColor: `${agent.color}08` }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-content/5'
            }`}
            style={activeTab === tab.id ? { backgroundColor: agent.color } : undefined}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden" role="tabpanel" aria-label={`${activeTab} tab content`}>
        {activeTab === 'general' && (
          <GeneralTab agent={agent} onPause={onPause} onResume={onResume} onKill={onKill} />
        )}
        {activeTab === 'terminal' && (
          <TerminalTab
            agent={agent}
            onSendInput={onSendInput}
            onBreakout={onBreakout}
            onPause={onPause}
            onResume={onResume}
            onKill={onKill}
          />
        )}
        {activeTab === 'notes' && <NotesTab agent={agent} />}
        {activeTab === 'history' && <HistoryTab agent={agent} />}
        {activeTab === 'todo' && <TodoTab agent={agent} onSpawnWithTask={onSpawnWithTask} />}
        {activeTab === 'bugs' && <BugsTab agent={agent} />}
        {activeTab === 'git' && <GitTab agent={agent} />}
      </div>
    </div>
  )
}

export default AgentDetailPanel
