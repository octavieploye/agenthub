import { useEffect, useState, useCallback, useRef } from 'react'
import { useAgentStore } from './stores/agent-store'
import { useViewStore } from './stores/view-store'
import { useThemeStore } from './stores/theme-store'
import { useUsageStore } from './stores/usage-store'
import AgentSidebar from './widgets/agent-sidebar/AgentSidebar'
import SABar from './widgets/sa-bar/SABar'
import SpawnDialog from './widgets/spawn-dialog/SpawnDialog'
import UnifiedView from './widgets/unified-view/UnifiedView'
import BriefingView from './widgets/briefing-view/BriefingView'
import CommandPalette from './widgets/command-palette/CommandPalette'
import EvidencePanel from './widgets/evidence-panel/EvidencePanel'
import CodeBluePanel from './widgets/code-blue/CodeBluePanel'
import KillConfirmToast from './widgets/kill-confirm/KillConfirmToast'
import { RecoveryScreen } from './widgets/recovery-screen/RecoveryScreen'
import { ShutdownDialog } from './widgets/shutdown-dialog/ShutdownDialog'
import GuardrailsPanel from './widgets/guardrails-panel/GuardrailsPanel'
import AgentContextMenu from './widgets/context-menu/AgentContextMenu'
import AgentDetailPanel from './widgets/agent-detail/AgentDetailPanel'
import InlineTaskInput from './widgets/inline-task-input/InlineTaskInput'
import BreakoutLayout from './widgets/breakout-terminal/BreakoutLayout'
import SettingsPanel from './widgets/settings-panel/SettingsPanel'
import StandaloneGitPanel from './widgets/git-panel/StandaloneGitPanel'
import type { SearchResult } from '@shared/types/search.types'
import type { HealthAnomaly } from '@shared/types/health.types'
import type { RecoveryInfo } from '@shared/types/recovery.types'
import type { GuardrailConfig } from '@shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import { playAgentSound, createSoundAlertDeps } from './services/sound-alert'

function App(): React.JSX.Element {
  // Detect breakout mode from URL search params
  const urlParams = new URLSearchParams(window.location.search)
  const isBreakout = urlParams.get('breakout') === 'true'
  const breakoutAgentId = urlParams.get('agentId')

  if (isBreakout && breakoutAgentId) {
    return <BreakoutLayout agentId={breakoutAgentId} />
  }

  return <AppMain />
}

function AppMain(): React.JSX.Element {
  const { agents, activeAgentId, setActiveAgent, addAgent, updateStatus, updateColor, removeAgent } =
    useAgentStore()
  const viewMode = useViewStore((s) => s.viewMode)
  const theme = useThemeStore((s) => s.theme)
  const setFocusedAgent = useViewStore((s) => s.setFocusedAgent)
  const fetchUsage = useUsageStore((s) => s.fetchUsage)
  const [spawnDialogOpen, setSpawnDialogOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [pausedAgentAnomalies, setPausedAgentAnomalies] = useState<HealthAnomaly[]>([])
  const [pausedAt, setPausedAt] = useState<number>(0)

  // Code Blue emergency stop
  const [codeBlueActive, setCodeBlueActive] = useState(false)

  // Kill confirmation
  const [killTarget, setKillTarget] = useState<{ id: string; name: string } | null>(null)

  // Recovery screen
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null)
  const [showRecovery, setShowRecovery] = useState(false)

  // Shutdown dialog
  const [showShutdown, setShowShutdown] = useState(false)

  // Guardrails panel
  const [guardrailsTarget, setGuardrailsTarget] = useState<{
    agentId: string
    repoId: string
    repoName: string
    repoPath: string
  } | null>(null)
  const [guardrailsConfig, setGuardrailsConfig] = useState<GuardrailConfig>({ ...DEFAULT_GUARDRAILS })

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ agentId: string; position: { x: number; y: number } } | null>(null)

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Git panel
  const [gitPanelOpen, setGitPanelOpen] = useState(false)

  // Sound alert deps (Howler.js backed, reads soundEnabled from view-store)
  const soundDeps = useRef(
    createSoundAlertDeps(() => useViewStore.getState().soundEnabled)
  )

  // Map agent lifecycle status to sound event
  const statusToSoundEvent = useCallback(
    (status: AgentLifecycleStatus): Parameters<typeof playAgentSound>[0] | null => {
      switch (status) {
        case 'completed':
          return 'agent_completed'
        case 'locked':
          return 'agent_locked'
        case 'looping':
          return 'agent_looping'
        default:
          return null
      }
    },
    []
  )

  // Subscribe to IPC events
  useEffect(() => {
    const unsubStatus = window.agentHub.on.agentStatusChange((agentId, status, confidence) => {
      updateStatus(
        agentId,
        status as Parameters<typeof updateStatus>[1],
        confidence as Parameters<typeof updateStatus>[2]
      )

      // Play sound for status change
      const soundEvent = statusToSoundEvent(status as AgentLifecycleStatus)
      if (soundEvent) {
        playAgentSound(soundEvent, soundDeps.current)
      }
    })

    const unsubExit = window.agentHub.on.agentExit((agentId) => {
      updateStatus(agentId, 'completed', 'confirmed')
      playAgentSound('agent_completed', soundDeps.current)
    })

    return () => {
      unsubStatus()
      unsubExit()
    }
  }, [updateStatus, statusToSoundEvent])

  // Fetch usage on mount and periodically (30s)
  useEffect(() => {
    fetchUsage()
    const interval = setInterval(fetchUsage, 30_000)
    return () => clearInterval(interval)
  }, [fetchUsage])

  // Check for recovery on startup
  useEffect(() => {
    window.agentHub.recovery
      .getInfo()
      .then((res) => {
        if (res.success && res.data) {
          const info = res.data as RecoveryInfo
          if (info.hadInterruption || info.recoveredAgents.length > 0) {
            setRecoveryInfo(info)
            setShowRecovery(true)
          }
        }
      })
      .catch(() => {})
  }, [])

  // Fetch health snapshot for paused active agent
  useEffect(() => {
    if (!activeAgentId) {
      setPausedAgentAnomalies([])
      return
    }
    const agent = agents.get(activeAgentId)
    if (!agent || agent.status !== 'paused') {
      setPausedAgentAnomalies([])
      return
    }
    setPausedAt(Date.now())
    window.agentHub.health
      .getSnapshot(activeAgentId)
      .then((res) => {
        if (res.success && res.data) {
          const snap = res.data as { anomalies?: HealthAnomaly[] }
          setPausedAgentAnomalies(snap.anomalies ?? [])
        }
      })
      .catch(() => {})
  }, [activeAgentId, agents])

  // Sync theme to document root on mount and change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Track previous view mode for Cmd+B toggle
  const [previousViewMode, setPreviousViewMode] = useState<'raid' | 'channel' | 'terminal'>('raid')

  // Shutdown handler (must be before keyboard shortcuts)
  const handleShutdownRequest = useCallback(() => {
    const activeAgents = Array.from(agents.values()).filter(
      (a) => a.status === 'busy' || a.status === 'locked' || a.status === 'paused'
    )
    if (activeAgents.length > 0) {
      setShowShutdown(true)
    } else {
      window.agentHub.system.shutdown()
    }
  }, [agents])

  // Keyboard shortcuts for view mode switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey) {
        const store = useViewStore.getState()
        if (e.key === '1') { e.preventDefault(); store.setViewMode('raid') }
        if (e.key === '2') { e.preventDefault(); store.setViewMode('channel') }
        if (e.key === '3') { e.preventDefault(); store.setViewMode('terminal') }
        if (e.key === 'k') {
          e.preventDefault()
          setCommandPaletteOpen((prev) => !prev)
        }
        if (e.key === 'b') {
          e.preventDefault()
          if (store.viewMode === 'briefing') {
            store.setViewMode(previousViewMode)
          } else {
            setPreviousViewMode(store.viewMode as 'raid' | 'channel' | 'terminal')
            store.setViewMode('briefing')
          }
        }
        if (e.key === 'q') {
          e.preventDefault()
          handleShutdownRequest()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previousViewMode, handleShutdownRequest])

  // Close context menu on any click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (): void => setContextMenu(null)
    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [contextMenu])

  const handleSelectAgent = useCallback((agentId: string) => {
    setActiveAgent(agentId)
    setFocusedAgent(agentId)
  }, [setActiveAgent, setFocusedAgent])

  const handleSpawn = useCallback(
    async (cwd: string, name: string, repoId: string, model?: string, task?: string, color?: string) => {
      try {
        const response = await window.agentHub.agents.spawn({
          repoId,
          name,
          cwd,
          model,
          taskDescription: task || 'Interactive session',
          color
        })
        if (response.success && response.data) {
          addAgent(response.data)
          setActiveAgent(response.data.id)
          setFocusedAgent(response.data.id)
          useViewStore.getState().setViewMode('terminal')
        }
      } catch (err) {
        console.error('Spawn failed:', err)
      }
    },
    [addAgent]
  )

  // Kill with confirmation
  const handleKillRequest = useCallback(
    (agentId: string) => {
      const agent = agents.get(agentId)
      setKillTarget({ id: agentId, name: agent?.name ?? agentId })
    },
    [agents]
  )

  const handleKillConfirm = useCallback(async () => {
    if (!killTarget) return
    try {
      await window.agentHub.agents.kill(killTarget.id)
      removeAgent(killTarget.id)
    } catch (err) {
      console.error('Kill failed:', err)
    }
    setKillTarget(null)
  }, [killTarget, removeAgent])

  // Direct kill (no confirmation — used by Code Blue)
  const handleKillDirect = useCallback(
    async (agentId: string) => {
      try {
        await window.agentHub.agents.kill(agentId)
        removeAgent(agentId)
      } catch (err) {
        console.error('Kill failed:', err)
      }
    },
    [removeAgent]
  )

  const handlePause = useCallback(async (agentId: string) => {
    try {
      await window.agentHub.agents.pause(agentId)
    } catch (err) {
      console.error('Pause failed:', err)
    }
  }, [])

  const handleResume = useCallback(async (agentId: string) => {
    try {
      await window.agentHub.agents.resume(agentId)
    } catch (err) {
      console.error('Resume failed:', err)
    }
  }, [])

  const handleSendInput = useCallback(async (agentId: string, data: string) => {
    try {
      await window.agentHub.agents.sendInput(agentId, data)
    } catch (err) {
      console.error('Send input failed:', err)
    }
  }, [])

  const handleBreakout = useCallback(async (agentId: string) => {
    try {
      await window.agentHub.windows.createBreakout(agentId)
    } catch (err) {
      console.error('Breakout failed:', err)
    }
  }, [])

  const handleColorChange = useCallback(
    (agentId: string) => {
      handleSelectAgent(agentId)
      useViewStore.getState().setViewMode('terminal')
    },
    [handleSelectAgent]
  )

  const handleSpawnWithTask = useCallback(
    (task: string) => {
      const agent = activeAgentId ? agents.get(activeAgentId) : null
      if (agent) {
        handleSpawn(agent.cwd, `task-${Date.now().toString(36)}`, agent.repoId, undefined, task)
      }
    },
    [activeAgentId, agents, handleSpawn]
  )

  const handleSearchResult = useCallback((result: SearchResult) => {
    if (result.type === 'agent') {
      handleSelectAgent(result.id)
      useViewStore.getState().setViewMode('terminal')
    } else if (result.type === 'task') {
      useViewStore.getState().setViewMode('briefing')
    } else if (result.type === 'repo') {
      useViewStore.getState().setViewMode('briefing')
    } else if (result.type === 'terminal') {
      handleSelectAgent(result.id)
      useViewStore.getState().setViewMode('terminal')
    }
  }, [handleSelectAgent])

  const handleStartWorking = useCallback(() => {
    useViewStore.getState().setViewMode(previousViewMode)
  }, [previousViewMode])

  // Code Blue handlers
  const handleCodeBlueActivate = useCallback(() => {
    // Pause all running agents
    for (const agent of agents.values()) {
      if (agent.status === 'busy' || agent.status === 'locked') {
        handlePause(agent.id)
      }
    }
    setCodeBlueActive(true)
  }, [agents, handlePause])

  const handleResumeAll = useCallback(() => {
    for (const agent of agents.values()) {
      if (agent.status === 'paused') {
        handleResume(agent.id)
      }
    }
    setCodeBlueActive(false)
  }, [agents, handleResume])

  // Recovery handlers
  const handleRecoveryContinue = useCallback(() => {
    setShowRecovery(false)
    window.agentHub.recovery.ackRecovery().catch(() => {})
  }, [])

  // Guardrails handlers
  const handleOpenGuardrails = useCallback(
    (agentId: string) => {
      const agent = agents.get(agentId)
      if (!agent) return
      const repoPath = agent.cwd
      const repoName = repoPath.split('/').pop() ?? 'Project'
      setGuardrailsTarget({ agentId, repoId: agent.repoId, repoName, repoPath })
      window.agentHub.guardrails
        .get(repoPath)
        .then((res) => {
          if (res.success && res.data) {
            setGuardrailsConfig(res.data as GuardrailConfig)
          } else {
            setGuardrailsConfig({ ...DEFAULT_GUARDRAILS })
          }
        })
        .catch(() => setGuardrailsConfig({ ...DEFAULT_GUARDRAILS }))
    },
    [agents]
  )

  const guardrailSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleGuardrailUpdate = useCallback(
    (key: keyof GuardrailConfig, value: unknown) => {
      if (!guardrailsTarget) return
      setGuardrailsConfig((prev) => ({ ...prev, [key]: value }))
      // Debounce IPC save to avoid spamming on slider drag
      if (guardrailSaveTimerRef.current) clearTimeout(guardrailSaveTimerRef.current)
      guardrailSaveTimerRef.current = setTimeout(() => {
        window.agentHub.guardrails
          .update(guardrailsTarget.repoPath, key, value)
          .catch(() => {})
      }, 300)
    },
    [guardrailsTarget]
  )

  const handleGuardrailReset = useCallback(() => {
    if (!guardrailsTarget) return
    setGuardrailsConfig({ ...DEFAULT_GUARDRAILS })
    window.agentHub.guardrails.reset(guardrailsTarget.repoPath).catch(() => {})
  }, [guardrailsTarget])

  const agentList = Array.from(agents.values())

  // Show recovery screen if needed
  if (showRecovery && recoveryInfo) {
    return (
      <div data-theme={theme}>
        <RecoveryScreen
          recoveryInfo={recoveryInfo}
          onContinue={handleRecoveryContinue}
          onResumeAgent={(agentId) => {
            handleSelectAgent(agentId)
            handleRecoveryContinue()
          }}
          onViewOutput={(agentId) => {
            handleSelectAgent(agentId)
            useViewStore.getState().setViewMode('terminal')
            handleRecoveryContinue()
          }}
          onDropAgent={(agentId) => {
            handleKillDirect(agentId)
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" data-theme={theme}>
      {/* SA Bar — persistent status header */}
      <SABar
        agents={agentList}
        onCodeBlue={handleCodeBlueActivate}
        selectedAgentRepoPath={activeAgentId ? agents.get(activeAgentId)?.cwd : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGit={() => setGitPanelOpen(true)}
      />

      {/* Main layout: sidebar + content */}
      <main className="flex-1 flex min-h-0">
        <AgentSidebar
          agents={agentList}
          activeAgentId={activeAgentId}
          onSelectAgent={handleSelectAgent}
          onKillAgent={handleKillRequest}
          onPauseAgent={handlePause}
          onResumeAgent={handleResume}
          onSpawnAgent={() => setSpawnDialogOpen(true)}
          onOpenGuardrails={handleOpenGuardrails}
        />

        {/* Content area switches based on view mode */}
        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === 'briefing' ? (
            <BriefingView
              agents={agentList}
              onStartWorking={handleStartWorking}
              onViewAgent={handleSelectAgent}
              onResumeAgent={handleResume}
              onKillAgent={handleKillRequest}
              onSpawnTester={() => {}}
            />
          ) : (
            /* Workspace view — master-detail layout */
            <div className="flex-1 flex min-h-0 bg-base-100">
              {/* Overview panel (raid/channel grid) — only in raid/channel modes */}
              {(viewMode === 'raid' || viewMode === 'channel') && (
                <div
                  className={`min-h-0 overflow-y-auto ${
                    activeAgentId && agents.get(activeAgentId)
                      ? 'w-[320px] shrink-0 border-r border-base-content/10'
                      : 'flex-1'
                  }`}
                >
                  {agentList.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="panel-glass p-8 text-center max-w-md">
                        <h2 className="text-2xl font-bold mb-3">Welcome to AgentHub</h2>
                        <p className="text-base-content/70 mb-5 text-sm">
                          Command & Control center for AI coding agents.
                        </p>
                        <button
                          onClick={() => setSpawnDialogOpen(true)}
                          className="btn-lcars btn-primary w-full"
                        >
                          Launch First Agent
                        </button>
                      </div>
                    </div>
                  ) : (
                    <UnifiedView
                      agents={agentList}
                      onSelectAgent={handleSelectAgent}
                      onContextMenu={(agentId, pos) => setContextMenu({ agentId, position: pos })}
                    />
                  )}
                </div>
              )}

              {/* Agent Detail Panel — shows when agent is selected */}
              {activeAgentId && agents.get(activeAgentId) ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  {/* Evidence panel for paused agents */}
                  {agents.get(activeAgentId)?.status === 'paused' &&
                    pausedAgentAnomalies.length > 0 && (
                      <div className="px-4 py-2 shrink-0">
                        <EvidencePanel
                          agentId={activeAgentId}
                          agentName={agents.get(activeAgentId)?.name ?? ''}
                          anomalies={pausedAgentAnomalies}
                          pausedAt={pausedAt}
                          onResume={() => handleResume(activeAgentId)}
                          onKill={() => handleKillRequest(activeAgentId)}
                          onRestart={(_prompt) => {
                            handleKillDirect(activeAgentId).then(() => {
                              const agent = agents.get(activeAgentId)
                              if (agent) {
                                handleSpawn(agent.cwd, agent.name + '-retry', agent.repoId)
                              }
                            })
                          }}
                          onDismiss={(anomalyId) => {
                            setPausedAgentAnomalies((prev) =>
                              prev.filter((a) => a.id !== anomalyId)
                            )
                          }}
                        />
                      </div>
                    )}
                  <AgentDetailPanel
                    agent={agents.get(activeAgentId)!}
                    initialTab={viewMode === 'terminal' ? 'terminal' : 'general'}
                    onPause={handlePause}
                    onResume={handleResume}
                    onKill={handleKillRequest}
                    onSendInput={handleSendInput}
                    onSpawnWithTask={handleSpawnWithTask}
                    onBreakout={handleBreakout}
                  />
                  {/* Global inline task input — visible when agent selected */}
                  <InlineTaskInput
                    agent={agents.get(activeAgentId)!}
                    onSendInput={handleSendInput}
                  />
                </div>
              ) : viewMode === 'terminal' ? (
                /* Terminal mode with no agent selected — show welcome */
                <div className="flex-1 flex items-center justify-center">
                  <div className="panel-glass p-8 text-center max-w-md">
                    <h2 className="text-2xl font-bold mb-3">No Agent Selected</h2>
                    <p className="text-base-content/70 mb-5 text-sm">
                      Select an agent from the sidebar or launch a new one.
                    </p>
                    <button
                      onClick={() => setSpawnDialogOpen(true)}
                      className="btn-lcars btn-primary w-full"
                    >
                      Launch Agent
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <SpawnDialog
        open={spawnDialogOpen}
        onClose={() => setSpawnDialogOpen(false)}
        onSpawn={handleSpawn}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectResult={handleSearchResult}
      />

      {/* Code Blue emergency panel */}
      <CodeBluePanel
        agents={agentList}
        onResumeAgent={handleResume}
        onKillAgent={handleKillDirect}
        onRestartAgent={(id) => {
          const agent = agents.get(id)
          if (agent) {
            handleKillDirect(id).then(() => {
              handleSpawn(agent.cwd, agent.name + '-retry', agent.repoId)
            })
          }
        }}
        onResumeAll={handleResumeAll}
        onDismiss={() => setCodeBlueActive(false)}
        isActive={codeBlueActive}
      />

      {/* Kill confirmation toast */}
      {killTarget && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <KillConfirmToast
            agentName={killTarget.name}
            onConfirm={handleKillConfirm}
            onCancel={() => setKillTarget(null)}
          />
        </div>
      )}

      {/* Shutdown dialog */}
      {showShutdown && (
        <ShutdownDialog
          activeAgents={agentList.filter(
            (a) => a.status === 'busy' || a.status === 'locked' || a.status === 'paused'
          )}
          onLetThemFinish={() => {
            setShowShutdown(false)
            window.agentHub.system.minimizeToTray()
          }}
          onKillAllAndClose={() => {
            setShowShutdown(false)
            window.agentHub.system.shutdown()
          }}
          onCancel={() => setShowShutdown(false)}
        />
      )}

      {/* Guardrails panel */}
      {guardrailsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg mx-4">
            <GuardrailsPanel
              repoId={guardrailsTarget.repoId}
              repoName={guardrailsTarget.repoName}
              repoPath={guardrailsTarget.repoPath}
              config={guardrailsConfig}
              onUpdate={handleGuardrailUpdate}
              onReset={handleGuardrailReset}
              onClose={() => setGuardrailsTarget(null)}
            />
          </div>
        </div>
      )}

      {/* Agent context menu (right-click on raid frames) */}
      {contextMenu && agents.get(contextMenu.agentId) && (
        <AgentContextMenu
          agent={agents.get(contextMenu.agentId)!}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onPause={handlePause}
          onResume={handleResume}
          onKill={handleKillRequest}
          onViewOutput={(agentId) => {
            handleSelectAgent(agentId)
            useViewStore.getState().setViewMode('terminal')
          }}
          onCopyId={(agentId) => {
            navigator.clipboard.writeText(agentId).catch(() => {})
          }}
          onSendTask={(agentId) => {
            handleSelectAgent(agentId)
            useViewStore.getState().setViewMode('terminal')
          }}
          onViewNotes={(agentId) => {
            handleSelectAgent(agentId)
          }}
          onBreakout={handleBreakout}
          onChangeColor={handleColorChange}
        />
      )}

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Git panel */}
      {gitPanelOpen && <StandaloneGitPanel onClose={() => setGitPanelOpen(false)} />}
    </div>
  )
}

export default App
