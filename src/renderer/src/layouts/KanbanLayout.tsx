import { KanbanBoard } from '../widgets/kanban/KanbanBoard'

export function KanbanLayout() {
  const params = new URLSearchParams(window.location.search)
  const agentFilter = params.get('agentId') ?? undefined

  return (
    <div className="h-screen bg-base-100 overflow-hidden">
      <KanbanBoard defaultAgentFilter={agentFilter} />
    </div>
  )
}
