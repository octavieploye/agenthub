import { useEffect, useCallback } from 'react'
import type { AgentState } from '@shared/types/agent.types'
import type { TaskItem, YesterdaySummary as YesterdaySummaryType } from '@shared/types/task.types'
import type { RepoConfig } from '@shared/types/config.types'
import { useTaskStore } from '@renderer/stores/task-store'
import { useClipStore } from '@renderer/stores/clip-store'
import { useBugStore } from '@renderer/stores/bug-store'
import NeedsAttention from './NeedsAttention'
import SubscriptionStatus from './SubscriptionStatus'
import YesterdaySummaryComponent from './YesterdaySummary'
import TodaysPlan from './TodaysPlan'
import BacklogByRepo from './BacklogByRepo'
import ClipLauncher from '@renderer/widgets/clip-launcher/ClipLauncher'
import BugRadar from '@renderer/widgets/bug-radar/BugRadar'

interface BriefingViewProps {
  agents: AgentState[]
  repos?: RepoConfig[]
  yesterdaySummary?: YesterdaySummaryType
  onStartWorking: () => void
  onViewAgent: (agentId: string) => void
  onResumeAgent: (agentId: string) => void
  onKillAgent: (agentId: string) => void
  onSpawnTester: (taskId: string) => void
  onLaunchTask?: (task: TaskItem) => void
  onAddRepo?: () => void
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

function BriefingView({
  agents,
  repos = [],
  yesterdaySummary,
  onStartWorking,
  onViewAgent,
  onResumeAgent,
  onKillAgent,
  onSpawnTester,
  onLaunchTask,
  onAddRepo
}: BriefingViewProps): React.JSX.Element {
  const tasks = useTaskStore((s) => s.tasks)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const loading = useTaskStore((s) => s.loading)

  const clips = useClipStore((s) => s.clips)
  const fetchClips = useClipStore((s) => s.fetchClips)
  const createClip = useClipStore((s) => s.createClip)
  const deleteClip = useClipStore((s) => s.deleteClip)
  const launchClip = useClipStore((s) => s.launchClip)

  const bugs = useBugStore((s) => s.bugs)
  const fetchBugs = useBugStore((s) => s.fetchBugs)
  const resolveBug = useBugStore((s) => s.resolveBug)

  useEffect(() => {
    fetchTasks()
    fetchClips()
    fetchBugs()
  }, [fetchTasks, fetchClips, fetchBugs])

  const handleLaunchClip = useCallback(
    (clipId: string) => {
      const clip = clips.find((c) => c.id === clipId)
      if (clip && onLaunchTask) {
        launchClip(clipId)
        onLaunchTask({
          id: '',
          repoId: clip.defaultRepoId ?? '',
          title: clip.title,
          description: clip.prompt,
          priority: 2,
          status: 'today',
          agentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      } else {
        launchClip(clipId)
      }
    },
    [clips, launchClip, onLaunchTask]
  )

  const defaultSummary: YesterdaySummaryType = yesterdaySummary ?? {
    completed: 0,
    tested: 0,
    bugsResolved: 0
  }

  return (
    <div data-testid="briefing-view" className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-6 py-8">
        <SubscriptionStatus />

        <h1 className="text-2xl font-semibold mb-1">{getGreeting()}</h1>
        <p className="text-sm text-base-content/50 mb-6">{formatDate()}</p>

        {loading ? (
          <div className="space-y-3">
            <div className="panel-glass h-16 animate-pulse" />
            <div className="panel-glass h-16 animate-pulse" />
            <div className="panel-glass h-12 animate-pulse" />
          </div>
        ) : (
          <>
            <NeedsAttention
              agents={agents}
              tasks={tasks}
              onViewAgent={onViewAgent}
              onResumeAgent={onResumeAgent}
              onKillAgent={onKillAgent}
              onSpawnTester={onSpawnTester}
            />
            <TodaysPlan repos={repos} onLaunchTask={onLaunchTask} />
            <BacklogByRepo repos={repos} onAddRepo={onAddRepo ?? (() => {})} />

            <div className="mt-4">
              <ClipLauncher
                clips={clips}
                onCreateClip={(input) => createClip(input)}
                onLaunchClip={handleLaunchClip}
                onDeleteClip={deleteClip}
              />
            </div>

            {bugs.filter((b) => !b.resolvedAt).length > 0 && (
              <div className="mt-4">
                <BugRadar
                  bugs={bugs.filter((b) => !b.resolvedAt)}
                  repos={repos.map((r) => ({ id: r.id, name: r.name }))}
                  onNavigateToAgent={onViewAgent}
                  onResolveBug={resolveBug}
                />
              </div>
            )}
          </>
        )}

        <div className="flex items-center gap-4 pt-4 border-t border-base-content/10 mt-6">
          <YesterdaySummaryComponent summary={defaultSummary} />
          <div className="flex-1" />
          <button
            data-testid="start-working-btn"
            onClick={onStartWorking}
            className="btn-lcars btn-primary px-8 py-2.5 text-sm font-semibold shadow-lg shadow-primary/20"
          >
            Start Working
          </button>
        </div>
      </div>
    </div>
  )
}

export default BriefingView
