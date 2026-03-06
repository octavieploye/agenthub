import type { AgentState } from '@shared/types/agent.types'
import type { TaskItem } from '@shared/types/task.types'

interface NeedsAttentionProps {
  agents: AgentState[]
  tasks: TaskItem[]
  onViewAgent: (agentId: string) => void
  onResumeAgent: (agentId: string) => void
  onKillAgent: (agentId: string) => void
  onSpawnTester: (taskId: string) => void
}

interface AttentionItem {
  type: 'blocked' | 'needs_test' | 'completed'
  id: string
  title: string
  subtitle: string
  accentColor: string
  dotColor: string
  pulse: boolean
  agentId?: string
  taskId?: string
}

function buildAttentionItems(agents: AgentState[], tasks: TaskItem[]): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const agent of agents) {
    if (agent.status === 'locked' || agent.status === 'paused') {
      items.push({
        type: 'blocked',
        id: `agent-${agent.id}`,
        title: agent.name,
        subtitle: `${agent.cwd.split('/').pop()} — ${agent.status === 'locked' ? 'WAITING FOR INPUT' : 'PAUSED'}`,
        accentColor: agent.status === 'locked' ? 'var(--color-warning)' : 'var(--color-error)',
        dotColor: agent.status === 'locked' ? 'bg-warning' : 'bg-error',
        pulse: true,
        agentId: agent.id
      })
    }
  }

  for (const task of tasks) {
    if (task.status === 'completed') {
      items.push({
        type: 'needs_test',
        id: `task-${task.id}`,
        title: task.title,
        subtitle: `NEEDS TEST`,
        accentColor: 'var(--color-success)',
        dotColor: 'bg-success',
        pulse: false,
        taskId: task.id
      })
    }
  }

  return items
}

function NeedsAttention({
  agents,
  tasks,
  onViewAgent,
  onResumeAgent,
  onKillAgent,
  onSpawnTester
}: NeedsAttentionProps): React.JSX.Element {
  const items = buildAttentionItems(agents, tasks)

  if (items.length === 0) {
    return (
      <div data-testid="needs-attention" className="mb-6">
        <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-3">
          Needs Your Attention
        </h3>
        <div className="panel-glass p-6 text-center">
          <p className="text-sm text-base-content/50">All clear. No agents need your attention.</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="needs-attention" className="mb-6">
      <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-3">
        Needs Your Attention ({items.length})
      </h3>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            data-testid={`attention-item-${item.id}`}
            className={`panel-glass flex items-center gap-3 px-4 py-3 ${item.pulse ? 'panel-glass-alert' : ''}`}
            style={{ borderLeft: `3px solid ${item.accentColor}` }}
          >
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${item.dotColor} ${item.pulse ? 'animate-breathe' : ''}`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{item.title}</div>
              <div className="text-xs text-base-content/50 truncate">{item.subtitle}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              {item.type === 'blocked' && item.agentId && (
                <>
                  <button
                    onClick={() => onViewAgent(item.agentId!)}
                    className="btn-lcars text-[10px] px-2.5 py-1"
                  >
                    View
                  </button>
                  <button
                    onClick={() => onResumeAgent(item.agentId!)}
                    className="btn-lcars text-[10px] px-2.5 py-1"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => onKillAgent(item.agentId!)}
                    className="btn-lcars text-[10px] px-2.5 py-1 text-error"
                  >
                    Kill
                  </button>
                </>
              )}
              {item.type === 'needs_test' && item.taskId && (
                <>
                  <button
                    onClick={() => onSpawnTester(item.taskId!)}
                    className="btn-lcars text-[10px] px-2.5 py-1"
                  >
                    Test
                  </button>
                  <button className="btn-lcars text-[10px] px-2.5 py-1">Done</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NeedsAttention
export { buildAttentionItems }
