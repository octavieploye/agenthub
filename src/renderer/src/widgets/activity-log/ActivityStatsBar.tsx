import type { ActivityStats } from '@shared/types/activity.types'

interface Props {
  stats: ActivityStats
}

export default function ActivityStatsBar({ stats }: Props): React.JSX.Element {
  const cards = [
    { label: 'Agents Spawned', value: stats.agentsSpawned, color: 'text-info' },
    { label: 'Completed', value: stats.agentsCompleted, color: 'text-success' },
    { label: 'Errors', value: stats.agentsErrored, color: 'text-error' },
    { label: 'Tasks Done', value: stats.tasksCompleted, color: 'text-primary' },
    { label: 'Bugs Filed', value: stats.bugsCreated, color: 'text-warning' },
    { label: 'Bugs Fixed', value: stats.bugsResolved, color: 'text-success' }
  ]

  return (
    <div className="flex gap-2 flex-wrap">
      {cards.map((card) => (
        <div key={card.label} className="panel-glass px-3 py-2 rounded-lg min-w-[100px]">
          <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
          <div className="text-[10px] text-base-content/50 uppercase tracking-wider">{card.label}</div>
        </div>
      ))}
    </div>
  )
}
