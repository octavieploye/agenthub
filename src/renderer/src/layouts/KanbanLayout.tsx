import { KanbanBoard } from '../widgets/kanban/KanbanBoard'
import { useKanbanHydration } from './useKanbanHydration'

export function KanbanLayout() {
  useKanbanHydration()

  const params = new URLSearchParams(window.location.search)
  const agentFilter = params.get('agentId') ?? undefined

  return (
    <div className="h-screen bg-base-100 overflow-hidden">
      <KanbanBoard defaultAgentFilter={agentFilter} />
    </div>
  )
}
