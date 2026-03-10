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
  onSpawnWithTask: (task: string) => void
  onBreakout?: (agentId: string) => void
  onAttachTerminal?: (agentId: string) => void
  onDetachTerminal?: (agentId: string) => void
  proxyActive?: boolean
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
  onSpawnWithTask,
  onBreakout,
  onAttachTerminal,
  onDetachTerminal,
  proxyActive
}: AgentDetailPanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)

  // Track which tabs have been visited — mount on first visit, keep mounted after
  const [mountedTabs, setMountedTabs] = useState<Set<DetailTab>>(() => new Set([initialTab, 'terminal']))

  // Sync tab when initialTab prop changes (e.g., switching to terminal view mode)
  useEffect(() => {
    setActiveTab(initialTab)
    setMountedTabs((prev) => prev.has(initialTab) ? prev : new Set([...prev, initialTab]))
  }, [initialTab])

  // Mount a tab the first time it becomes active
  const handleTabClick = (tabId: DetailTab): void => {
    setActiveTab(tabId)
    setMountedTabs((prev) => prev.has(tabId) ? prev : new Set([...prev, tabId]))
  }

  return (
    <div data-testid="agent-detail-panel" className="flex flex-col flex-1 min-h-0 w-full">
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
            onClick={() => handleTabClick(tab.id)}
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

      {/* Tab content — all data tabs stay mounted (absolute overlay) to avoid remount/IPC delays */}
      <div className="flex-1 min-h-0 overflow-hidden relative bg-base-100" role="tabpanel" aria-label={`${activeTab} tab content`}>
        {activeTab === 'general' && (
          <div className="absolute inset-0">
            <GeneralTab agent={agent} onPause={onPause} onResume={onResume} onKill={onKill} />
          </div>
        )}
        <div className="absolute inset-0" style={{ visibility: activeTab === 'terminal' ? 'visible' : 'hidden' }}>
          <TerminalTab
            key={agent.id}
            agent={agent}
            visible={activeTab === 'terminal'}
            onBreakout={onBreakout}
            onPause={onPause}
            onResume={onResume}
            onKill={onKill}
            onAttachTerminal={onAttachTerminal}
            onDetachTerminal={onDetachTerminal}
            proxyActive={proxyActive}
          />
        </div>
        {mountedTabs.has('notes') && (
          <div className="absolute inset-0" style={{ visibility: activeTab === 'notes' ? 'visible' : 'hidden' }}>
            <NotesTab agent={agent} />
          </div>
        )}
        {mountedTabs.has('history') && (
          <div className="absolute inset-0" style={{ visibility: activeTab === 'history' ? 'visible' : 'hidden' }}>
            <HistoryTab agent={agent} />
          </div>
        )}
        {mountedTabs.has('todo') && (
          <div className="absolute inset-0" style={{ visibility: activeTab === 'todo' ? 'visible' : 'hidden' }}>
            <TodoTab agent={agent} onSpawnWithTask={onSpawnWithTask} />
          </div>
        )}
        {mountedTabs.has('bugs') && (
          <div className="absolute inset-0" style={{ visibility: activeTab === 'bugs' ? 'visible' : 'hidden' }}>
            <BugsTab agent={agent} />
          </div>
        )}
        {mountedTabs.has('git') && (
          <div className="absolute inset-0" style={{ visibility: activeTab === 'git' ? 'visible' : 'hidden' }}>
            <GitTab agent={agent} />
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentDetailPanel
