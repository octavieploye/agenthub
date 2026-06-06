import { useEffect, useState, useCallback, useRef } from 'react'
import { useAgentStore } from './stores/agent-store'
import { useViewStore } from './stores/view-store'
import { useThemeStore } from './stores/theme-store'
import { useUsageStore } from './stores/usage-store'
import AgentSidebar from './widgets/agent-sidebar/AgentSidebar'
import RepoSidebar from './widgets/repo-sidebar/RepoSidebar'
import SABar from './widgets/sa-bar/SABar'
import SpawnDialog from './widgets/spawn-dialog/SpawnDialog'
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
import FilePreviewLayout from './widgets/file-preview/FilePreviewLayout'
import SettingsPanel from './widgets/settings-panel/SettingsPanel'
import TerminalSearchPanel from './widgets/terminal-search/TerminalSearchPanel'
import HelpModal from './widgets/help-modal/HelpModal'
import StandaloneGitPanel from './widgets/git-panel/StandaloneGitPanel'
import ActivityLogView from './widgets/activity-log/ActivityLogView'
import type { RepoSwitcherHandle } from './widgets/repo-switcher/RepoSwitcher'
import { useWindowSize } from './hooks/useWindowSize'
import type { SearchResult } from '@shared/types/search.types'
import type { HealthAnomaly } from '@shared/types/health.types'
import type { RecoveryInfo } from '@shared/types/recovery.types'
import type { GuardrailConfig } from '@shared/types/config.types'
import { DEFAULT_GUARDRAILS } from '@shared/types/config.types'
import type { AgentLifecycleStatus } from '@shared/types/agent.types'
import { playAgentSound, createSoundAlertDeps, statusToSoundEvent } from './services/sound-alert'
import { speakTriageEvent } from './services/voice-tts'
import type { VoiceTtsDeps } from './services/voice-tts'
import type { RoutingResult } from '@shared/types/notification.types'
import { useNotificationStore } from './stores/notification-store'
import { buildToastFromTriageEvent } from './helpers/triage-toast'
import type { TriageEvent } from '@shared/types/triage.types'
import { startIpcListener } from './widgets/full-terminal/terminal-manager'
import { usePrefetchAgentData } from './hooks/usePrefetchAgentData'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import { VoiceInputProvider } from './contexts/VoiceInputContext'

function App(): React.JSX.Element {
  // Detect breakout mode from URL search params
  const urlParams = new URLSearchParams(window.location.search)
  const isBreakout = urlParams.get('breakout') === 'true'
  const breakoutType = urlParams.get('type')
  const breakoutAgentId = urlParams.get('agentId')

  if (isBreakout && breakoutType === 'file-preview') {
    const filePath = urlParams.get('filePath') ?? ''
    const repoPath = urlParams.get('repoPath') ?? ''
    const repoName = urlParams.get('repoName') ?? 'project'
    return <FilePreviewLayout filePath={filePath} repoPath={repoPath} repoName={repoName} />
  }

  if (isBreakout && breakoutAgentId) {
    return (
      <VoiceInputProvider>
        <BreakoutLayout agentId={breakoutAgentId} />
      </VoiceInputProvider>
    )
  }

  return <AppMain />
}

function sendDesktopNotificationFromRenderer(event: TriageEvent): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  new Notification(`AgentHub — ${event.agentName}`, {
    body: `${event.repoName}: ${event.reason}`,
    silent: true, // sound is handled by Layer 3
  })
}

function AppMain(): React.JSX.Element {
  const { agents, activeAgentId, setActiveAgent, addAgent, updateStatus, removeAgent } =
    useAgentStore()
  const viewMode = useViewStore((s) => s.viewMode)
  const selectedRepoId = useViewStore((s) => s.selectedRepoId)
  const setSelectedRepoId = useViewStore((s) => s.setSelectedRepoId)
  const focusedAgentId = useViewStore((s) => s.focusedAgentId)
  const theme = useThemeStore((s) => s.theme)
  const setFocusedAgent = useViewStore((s) => s.setFocusedAgent)
  const fetchUsage = useUsageStore((s) => s.fetchUsage)
  const prefetchAgentData = usePrefetchAgentData()
  const { width: windowWidth } = useWindowSize()
  const isNarrowWindow = windowWidth < 728
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
  const lastMousePos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
  useEffect(() => {
    const track = (e: MouseEvent): void => { lastMousePos.current = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', track)
    return () => window.removeEventListener('mousemove', track)
  }, [])

  // Terminal search
  const [terminalSearchOpen, setTerminalSearchOpen] = useState(false)

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Git panel
  const [gitPanelOpen, setGitPanelOpen] = useState(false)

  // Help modal
  const [helpOpen, setHelpOpen] = useState(false)

  // CLI version mismatch banner
  const [cliVersionBanner, setCliVersionBanner] = useState<{ hostVersion: string; imageVersion: string } | null>(null)

  // Active detail tab tracking
  const [activeDetailTab, setActiveDetailTab] = useState('terminal')

  // Sound alert deps (Howler.js backed, reads soundEnabled from view-store)
  const soundDeps = useRef(
    createSoundAlertDeps(() => useViewStore.getState().soundEnabled)
  )

  // Ref to imperative handle on RepoSwitcher (for Cmd+E)
  const repoSwitcherRef = useRef<RepoSwitcherHandle>(null)

  // Track known agent IDs to detect first spawn
  const knownAgentIds = useRef(new Set<string>())

  // Subscribe to IPC events
  // ── Status change listener ───────────────────────────────────────────────
  // Responsibilities:
  //   - Update Zustand agent state on every status change
  //   - Play mission_complete sound (requires cross-agent context triage cannot provide)
  // Sounds for individual agent events (spawned, completed, locked, etc.)
  // are now handled by the agentTriaged subscriber below.
  useEffect(() => {
    const pendingMissionComplete = new Map<string, ReturnType<typeof setTimeout>>()

    const unsubStatus = window.agentHub.on.agentStatusChange((agentId, status, confidence) => {
      updateStatus(
        agentId,
        status as Parameters<typeof updateStatus>[1],
        confidence as Parameters<typeof updateStatus>[2]
      )

      const lifecycleStatus = status as AgentLifecycleStatus

      // Track known agents — play spawn sound on first appearance
      if (!knownAgentIds.current.has(agentId)) {
        knownAgentIds.current.add(agentId)
        playAgentSound('agent_spawned', soundDeps.current)
      }

      // mission_complete: all agents done AND more than 1 agent — needs cross-agent context
      if (lifecycleStatus === 'completed') {
        const timer = setTimeout(() => {
          pendingMissionComplete.delete(agentId)
          const currentAgents = useAgentStore.getState().agents
          if (currentAgents.size > 1) {
            const allDone = Array.from(currentAgents.values()).every(
              (a) => a.status === 'completed' || a.status === 'interrupted'
            )
            if (allDone) {
              playAgentSound('mission_complete', soundDeps.current)
            }
          }
        }, 1800)
        pendingMissionComplete.set(agentId, timer)
      }
    })

    const unsubExit = window.agentHub.on.agentExit((agentId, exitCode) => {
      // Cancel any pending mission_complete check for this agent
      const pending = pendingMissionComplete.get(agentId)
      if (pending !== undefined) {
        clearTimeout(pending)
        pendingMissionComplete.delete(agentId)
      }

      // Clean up persistent terminal for this agent
      import('./widgets/full-terminal/terminal-manager').then(m => m.destroyTerminal(agentId))
      setProxyAgents((prev) => {
        if (!prev.has(agentId)) return prev
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })

      if (typeof exitCode === 'number' && exitCode !== 0) {
        console.warn('[sound-alert] agent exited with code', exitCode, 'for', agentId)
        updateStatus(agentId, 'error', 'confirmed')
      } else {
        updateStatus(agentId, 'completed', 'confirmed')
      }
    })

    // ── Unified notification routing (agentTriaged) ───────────────────────
    // Layer 1: Toast     — always fires for all triage events
    // Layer 2: Desktop   — medium+ events, gated by desktopNotificationsEnabled
    // Layer 3: Sound     — high+ events, gated by soundEnabled
    // Layer 4: Voice TTS — critical events, gated by voiceEnabled

    const voiceDeps: VoiceTtsDeps = {
      speak: ({ text, volume }) => {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.volume = volume
        window.speechSynthesis.speak(utterance)
      },
      isVoiceEnabled: () => useViewStore.getState().voiceEnabled,
      isFocused: (agentId) => useViewStore.getState().focusedAgentId === agentId,
    }

    const agentTriagedHandler = (window.agentHub.on as Record<string, unknown>)['agentTriaged'] as
      | ((callback: (routingResult: RoutingResult) => void) => () => void)
      | undefined

    const unsubTriaged = agentTriagedHandler?.((routingResult: RoutingResult) => {
      const { layers, triageEvent } = routingResult

      // Layer 1: Toast — always on, no toggle
      useNotificationStore.getState().addToast(buildToastFromTriageEvent(triageEvent))

      // Layer 2: Desktop — medium+ events, gated by toggle
      if (layers.includes('desktop') && useNotificationStore.getState().desktopNotificationsEnabled) {
        sendDesktopNotificationFromRenderer(triageEvent)
      }

      // Layer 3: Sound
      if (layers.includes('sound')) {
        // Handle completed: suppress in multi-agent (mission_complete plays instead)
        if (triageEvent.currentStatus === 'completed') {
          const agentCount = useAgentStore.getState().agents.size
          if (agentCount <= 1) {
            playAgentSound('agent_completed', soundDeps.current)
          }
        }

        // Handle awaiting_approval only (locked is excluded — fires too often)
        const soundEvent = statusToSoundEvent(triageEvent.currentStatus)
        if (soundEvent) {
          playAgentSound(soundEvent, soundDeps.current)
        }
      }

      // code_blue: play for error status regardless of sound layer
      // (error has requiresUserAction=false so sound layer is not added by router)
      if (triageEvent.currentStatus === 'error') {
        playAgentSound('code_blue', soundDeps.current)
      }

      // Layer 4: Voice TTS — critical events, gated by voiceEnabled
      if (layers.includes('voice')) {
        speakTriageEvent(triageEvent, voiceDeps, useViewStore.getState().ttsVolume)
      }
    })

    return () => {
      for (const timer of pendingMissionComplete.values()) {
        clearTimeout(timer)
      }
      pendingMissionComplete.clear()
      unsubStatus()
      unsubExit()
      unsubTriaged?.()
    }
  }, [updateStatus])

  // When a breakout window closes, select that agent and switch to terminal view
  useEffect(() => {
    const unsub = window.agentHub.on.breakoutClosed((agentId) => {
      if (!useAgentStore.getState().agents.has(agentId)) return
      setActiveAgent(agentId)
      setFocusedAgent(agentId)
      useViewStore.getState().setViewMode('terminal')
    })
    return unsub
  }, [setActiveAgent, setFocusedAgent])

  // Start terminal IPC listener immediately so no data is lost
  useEffect(() => {
    startIpcListener()
  }, [])

  // Request desktop notification permission once on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

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

  // CLI version check — runs once on mount after a 3s delay
  useEffect(() => {
    const timer = setTimeout(() => {
      window.agentHub.docker.checkCliVersion()
        .then((res) => {
          if (res.success && res.data.mismatch) {
            setCliVersionBanner({
              hostVersion: res.data.hostVersion as string,
              imageVersion: res.data.imageVersion as string
            })
          }
        })
        .catch(() => {})
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  const handleRebuildImage = useCallback(async () => {
    setCliVersionBanner(null)
    try {
      await window.agentHub.docker.rebuild()
    } catch (err) {
      console.error('Rebuild failed:', err)
    }
  }, [])

  // Wire useKeyboardNav hook — handles Cmd+1/2, Cmd+N, Cmd+K, Escape, Tab, Enter, Space, Delete
  useKeyboardNav({
    onSpawnDialog: () => setSpawnDialogOpen(true),
    onCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onEscape: () => {
      setCommandPaletteOpen(false)
      setContextMenu(null)
      setFocusedAgent(null)
    },
    onExpandFocused: () => {
      const focused = useViewStore.getState().focusedAgentId
      if (focused) handleSelectAgent(focused)
    },
    onContextMenuFocused: () => {
      const focused = useViewStore.getState().focusedAgentId
      if (!focused) return
      // Position context menu at the center of the screen as a fallback
      setContextMenu({ agentId: focused, position: lastMousePos.current })
    },
    onDeleteFocused: () => {
      const focused = useViewStore.getState().focusedAgentId
      if (focused) handleKillRequest(focused)
    }
  })

  // Keyboard shortcuts — only keys NOT handled by useKeyboardNav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'q') {
          e.preventDefault()
          handleShutdownRequest()
        }
        if (e.key === 'r') {
          e.preventDefault()
          repoSwitcherRef.current?.open()
        }

        // Cmd+Shift+↑/↓ — navigate repo list (raid view only)
        const store = useViewStore.getState()
        if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && store.viewMode === 'raid') {
          e.preventDefault()
          const allAgents = Array.from(useAgentStore.getState().agents.values())
          const ATTENTION_STATUSES_NAV = new Set(['locked', 'awaiting_approval', 'error', 'looping'])
          const repoMap = new Map<string, { repoId: string; hasAttention: boolean }>()
          for (const agent of allAgents) {
            const existing = repoMap.get(agent.repoId)
            const hasAttention = ATTENTION_STATUSES_NAV.has(agent.status)
            if (existing) {
              if (hasAttention) existing.hasAttention = true
            } else {
              repoMap.set(agent.repoId, { repoId: agent.repoId, hasAttention })
            }
          }
          const sortedRepos = Array.from(repoMap.values()).sort((a, b) => {
            if (a.hasAttention !== b.hasAttention) return a.hasAttention ? -1 : 1
            return a.repoId.localeCompare(b.repoId)
          })
          if (sortedRepos.length < 2) return
          const currentRepoId = store.selectedRepoId
          const currentRepoIndex = sortedRepos.findIndex((r) => r.repoId === currentRepoId)
          const nextRepoIndex =
            e.key === 'ArrowDown'
              ? (currentRepoIndex + 1) % sortedRepos.length
              : (currentRepoIndex - 1 + sortedRepos.length) % sortedRepos.length
          const nextRepo = sortedRepos[nextRepoIndex]
          if (nextRepo) store.setSelectedRepoId(nextRepo.repoId)
        }
      }

      // Plain Arrow ↑/↓ or ⌥ ↑/↓ — cycle focused agent in raid view
      if (
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        !e.metaKey && !e.ctrlKey && !e.shiftKey
      ) {
        const store = useViewStore.getState()
        if (store.viewMode !== 'raid') return
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
        e.preventDefault()
        const allAgents = Array.from(useAgentStore.getState().agents.values())
        const currentRaidAgents = store.selectedRepoId
          ? allAgents.filter((a) => a.repoId === store.selectedRepoId)
          : allAgents
        if (currentRaidAgents.length === 0) return
        const currentFocused = store.focusedAgentId
        if (currentFocused === null) {
          const first = currentRaidAgents[0]
          if (first) store.setFocusedAgent(first.id)
        } else {
          const currentIdx = currentRaidAgents.findIndex((a) => a.id === currentFocused)
          const nextIdx =
            e.key === 'ArrowDown'
              ? (currentIdx + 1) % currentRaidAgents.length
              : (currentIdx - 1 + currentRaidAgents.length) % currentRaidAgents.length
          const next = currentRaidAgents[nextIdx]
          if (next) store.setFocusedAgent(next.id)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleShutdownRequest])

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
    const agent = agents.get(agentId)
    if (agent) {
      prefetchAgentData(agentId, agent.cwd)
    }
  }, [setActiveAgent, setFocusedAgent, agents, prefetchAgentData])

  // Agent navigation — Cmd+←/→ or ⌥ ←/→ switches agents in terminal view
  useEffect(() => {
    const handleAgentNav = (e: KeyboardEvent): void => {
      const isCmdArrow = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey
      const isAltArrow = e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey
      if (!isCmdArrow && !isAltArrow) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return

      const viewStore = useViewStore.getState()
      if (viewStore.viewMode !== 'terminal') return

      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const allAgents = Array.from(useAgentStore.getState().agents.values())
      if (allAgents.length < 2) return

      const currentId = useAgentStore.getState().activeAgentId
      const currentIndex = allAgents.findIndex((a) => a.id === currentId)

      e.preventDefault()
      const nextIndex =
        e.key === 'ArrowRight'
          ? (currentIndex + 1) % allAgents.length
          : (currentIndex - 1 + allAgents.length) % allAgents.length
      handleSelectAgent(allAgents[nextIndex].id)
    }
    window.addEventListener('keydown', handleAgentNav)
    return () => window.removeEventListener('keydown', handleAgentNav)
  }, [handleSelectAgent])

  const handleSpawn = useCallback(
    async (cwd: string, name: string, repoId: string, model?: string, task?: string, color?: string, provider?: string, effortLevel?: string, skipPermissions?: boolean): Promise<string | null> => {
      try {
        const response = await window.agentHub.agents.spawn({
          repoId,
          name,
          cwd,
          model,
          provider: provider as import('@shared/types/agent.types').ModelProvider | undefined,
          effortLevel: effortLevel as import('@shared/types/agent.types').EffortLevel | undefined,
          taskDescription: task || 'Interactive session',
          color,
          skipPermissions
        })
        if (response.success && response.data) {
          addAgent(response.data)
          setActiveAgent(response.data.id)
          setFocusedAgent(response.data.id)
          setSelectedRepoId(response.data.repoId)
          useViewStore.getState().setViewMode('terminal')
          return null
        }
        const errMsg = !response.success ? response.error.message : 'Spawn returned no agent data'
        console.error('Spawn failed:', errMsg)
        return errMsg
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('Spawn failed:', errMsg)
        return errMsg
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

  const handleSendInput = useCallback((agentId: string, data: string) => {
    window.agentHub.agents.sendInput(agentId, data)
  }, [])

  const handleBreakout = useCallback(async (agentId: string) => {
    try {
      await window.agentHub.windows.createBreakout(agentId)
    } catch (err) {
      console.error('Breakout failed:', err)
    }
  }, [])

  const [proxyAgents, setProxyAgents] = useState<Set<string>>(new Set())

  const handleAttachTerminal = useCallback(async (agentId: string) => {
    try {
      const res = await window.agentHub.agents.attachTerminal(agentId)
      if (res.success) {
        setProxyAgents((prev) => new Set(prev).add(agentId))
        // Auto-launch external terminal with the attach command
        window.agentHub.system.openTerminal(res.data.attachCommand).catch((err) => {
          console.warn('Auto-launch terminal failed (command copied to clipboard):', err)
        })
      }
    } catch (err) {
      console.error('Attach terminal failed:', err)
    }
  }, [])

  const handleDetachTerminal = useCallback(async (agentId: string) => {
    try {
      await window.agentHub.agents.detachTerminal(agentId)
      setProxyAgents((prev) => {
        const next = new Set(prev)
        next.delete(agentId)
        return next
      })
    } catch (err) {
      console.error('Detach terminal failed:', err)
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
      if (!activeAgentId) return
      // Send task directly to the active agent's terminal instead of spawning a new agent
      handleSendInput(activeAgentId, task + '\r')
    },
    [activeAgentId, handleSendInput]
  )

  const handleSearchResult = useCallback((result: SearchResult) => {
    if (result.type === 'agent') {
      handleSelectAgent(result.id)
      useViewStore.getState().setViewMode('terminal')
    } else if (result.type === 'task') {
      useViewStore.getState().setViewMode('raid')
    } else if (result.type === 'repo') {
      useViewStore.getState().setViewMode('raid')
    } else if (result.type === 'terminal') {
      handleSelectAgent(result.id)
      useViewStore.getState().setViewMode('terminal')
    }
  }, [handleSelectAgent])

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
    // Only agents explicitly resumed via the Resume button are in the store.
    // Remaining recovered/interrupted agents are left behind — user chose to move on.
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
  const terminalSidebarAgents = agentList

  // Auto-select first repo when none selected
  useEffect(() => {
    if (selectedRepoId === null && agentList.length > 0) {
      const firstAgent = agentList[0]
      if (firstAgent) setSelectedRepoId(firstAgent.repoId)
    }
  }, [agentList, selectedRepoId, setSelectedRepoId])

  // Clear selectedRepoId if selected repo no longer has agents
  useEffect(() => {
    if (selectedRepoId === null) return
    const stillExists = agentList.some((a) => a.repoId === selectedRepoId)
    if (!stillExists) {
      const next = agentList.length > 0 ? agentList[0].repoId : null
      setSelectedRepoId(next ?? null)
    }
  }, [agentList, selectedRepoId, setSelectedRepoId])

  const raidAgents = selectedRepoId
    ? agentList.filter((a) => a.repoId === selectedRepoId)
    : agentList

  // Show recovery screen if needed
  if (showRecovery && recoveryInfo) {
    return (
      <div data-theme={theme}>
        <RecoveryScreen
          recoveryInfo={recoveryInfo}
          onContinue={handleRecoveryContinue}
          onViewOutput={(agentId) => {
            // Hydrate agent into store so it can be rendered
            const agent = recoveryInfo?.recoveredAgents.find(a => a.id === agentId)
              ?? recoveryInfo?.interruptedAgents.find(a => a.id === agentId)
            if (agent) addAgent(agent)
            handleSelectAgent(agentId)
            useViewStore.getState().setViewMode('terminal')
            // Remove from recovery list, auto-dismiss if none left
            if (recoveryInfo) {
              const updatedRecovered = recoveryInfo.recoveredAgents.filter(a => a.id !== agentId)
              const updatedInterrupted = recoveryInfo.interruptedAgents.filter(a => a.id !== agentId)
              if (updatedRecovered.length === 0 && updatedInterrupted.length === 0) {
                handleRecoveryContinue()
              } else {
                setRecoveryInfo({
                  ...recoveryInfo,
                  recoveredAgents: updatedRecovered,
                  interruptedAgents: updatedInterrupted
                })
              }
            }
          }}
          onDropAgent={async (agentId) => {
            await handleKillDirect(agentId)
            removeAgent(agentId)
            if (recoveryInfo) {
              const updatedRecovered = recoveryInfo.recoveredAgents.filter(a => a.id !== agentId)
              const updatedInterrupted = recoveryInfo.interruptedAgents.filter(a => a.id !== agentId)
              if (updatedRecovered.length === 0 && updatedInterrupted.length === 0) {
                handleRecoveryContinue()
              } else {
                setRecoveryInfo({
                  ...recoveryInfo,
                  recoveredAgents: updatedRecovered,
                  interruptedAgents: updatedInterrupted
                })
              }
            }
          }}
        />
      </div>
    )
  }

  return (
    <VoiceInputProvider>
    <div className="flex flex-col h-full" data-theme={theme}>
      {/* CLI version mismatch banner */}
      {cliVersionBanner && (
        <div className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 px-4 py-2 bg-warning/20 border-b border-warning/40 text-warning-content text-xs">
          <span>
            Claude CLI updated: host <code className="font-mono">{cliVersionBanner.hostVersion}</code>
            {' '}→ image <code className="font-mono">{cliVersionBanner.imageVersion}</code>.
            {' '}Rebuild the Docker image to use the latest CLI.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="btn btn-xs btn-warning"
              onClick={handleRebuildImage}
            >
              Rebuild Image
            </button>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => setCliVersionBanner(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Skip to content link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-content"
      >
        Skip to content
      </a>

      {/* SA Bar — persistent status header */}
      <SABar
        agents={agentList}
        onCodeBlue={handleCodeBlueActivate}
        selectedAgentRepoPath={activeAgentId ? agents.get(activeAgentId)?.cwd : undefined}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGit={() => setGitPanelOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenSearch={() => setTerminalSearchOpen(true)}
        repoSwitcherRef={repoSwitcherRef}
      />

      {/* Main layout: sidebar + content */}
      <main id="main-content" className="flex-1 flex min-h-0">
        {/* Agent sidebar — only shown in terminal view */}
        {viewMode === 'terminal' && (
          <AgentSidebar
            agents={terminalSidebarAgents}
            activeAgentId={activeAgentId}
            onSelectAgent={handleSelectAgent}
            onKillAgent={handleKillRequest}
            onPauseAgent={handlePause}
            onResumeAgent={handleResume}
            onSpawnAgent={() => setSpawnDialogOpen(true)}
            onOpenGuardrails={handleOpenGuardrails}
          />
        )}

        {/* Content area switches based on view mode */}
        <div className="flex-1 flex flex-col min-h-0">
          {viewMode === 'activity' ? (
            <ActivityLogView />
          ) : viewMode === 'raid' ? (
            /* Raid view — 3-column layout: RepoSidebar + AgentList + DetailPanel */
            <div className="flex h-full overflow-x-auto">
              <RepoSidebar onAddRepo={() => setSpawnDialogOpen(true)} />
              <div className="w-56 flex-shrink-0 h-full overflow-y-auto border-r border-base-content/10">
                {agentList.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm h-full">
                    Add a repo to get started
                  </div>
                ) : raidAgents.length === 0 ? (
                  <div className="flex items-center justify-center text-base-content/40 text-sm h-full">
                    No agents in this repo. Click + to add one.
                  </div>
                ) : (
                  <AgentSidebar
                    agents={raidAgents}
                    activeAgentId={focusedAgentId}
                    onSelectAgent={handleSelectAgent}
                    onKillAgent={handleKillRequest}
                    onPauseAgent={handlePause}
                    onResumeAgent={handleResume}
                    onSpawnAgent={() => setSpawnDialogOpen(true)}
                    onOpenGuardrails={handleOpenGuardrails}
                  />
                )}
              </div>
              <div className="flex-1 min-w-[280px] h-full overflow-hidden">
                {isNarrowWindow ? (
                  <div className="flex items-center justify-center h-full text-base-content/40 text-sm px-4 text-center">
                    Expand window to see details
                  </div>
                ) : activeAgentId && agents.get(activeAgentId) ? (
                  <div className="h-full flex flex-col">
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
                      initialTab="general"
                      onPause={handlePause}
                      onResume={handleResume}
                      onKill={handleKillRequest}
                      onSpawnWithTask={handleSpawnWithTask}
                      onBreakout={handleBreakout}
                      onAttachTerminal={handleAttachTerminal}
                      onDetachTerminal={handleDetachTerminal}
                      proxyActive={activeAgentId ? proxyAgents.has(activeAgentId) : false}
                      onTabChange={setActiveDetailTab}
                    />
                    {activeDetailTab === 'terminal' && (
                      <InlineTaskInput
                        agent={agents.get(activeAgentId)!}
                        onSendInput={handleSendInput}
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="panel-glass p-8 text-center max-w-md">
                      <h2 className="text-2xl font-bold mb-3">Welcome to AgentHub</h2>
                      <p className="text-base-content/70 mb-5 text-sm">
                        Command &amp; Control center for AI coding agents.
                      </p>
                      <button
                        onClick={() => setSpawnDialogOpen(true)}
                        className="btn-lcars btn-primary w-full"
                      >
                        Launch First Agent
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Terminal/other workspace view — master-detail layout */
            <div className="flex-1 flex min-h-0 bg-base-100">
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
                    onSpawnWithTask={handleSpawnWithTask}
                    onBreakout={handleBreakout}
                    onAttachTerminal={handleAttachTerminal}
                    onDetachTerminal={handleDetachTerminal}
                    proxyActive={activeAgentId ? proxyAgents.has(activeAgentId) : false}
                    onTabChange={setActiveDetailTab}
                  />
                  {/* Global inline task input — visible when agent selected */}
                  {activeDetailTab === 'terminal' && (
                    <InlineTaskInput
                      agent={agents.get(activeAgentId)!}
                      onSendInput={handleSendInput}
                    />
                  )}
                </div>
              ) : viewMode === 'terminal' ? (
                /* Terminal mode with no agent selected */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-base-content/40 text-sm">
                    Select an agent from the sidebar.
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
        prefilledRepoId={selectedRepoId ?? undefined}
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
        <div onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}

      {/* Terminal search */}
      {terminalSearchOpen && (
        <TerminalSearchPanel
          onClose={() => setTerminalSearchOpen(false)}
          onSelectAgent={handleSelectAgent}
        />
      )}

      {/* Settings panel */}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      {/* Git panel */}
      {gitPanelOpen && <StandaloneGitPanel onClose={() => setGitPanelOpen(false)} />}

      {/* Help modal */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

    </div>
    </VoiceInputProvider>
  )
}

export default App
