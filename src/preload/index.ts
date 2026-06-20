import { contextBridge, ipcRenderer, clipboard } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, IPC_EVENTS } from '../shared/constants/ipc-channels'
import type { RendererErrorPayload } from '../shared/types/log.types'

const agentHubBridge = {
  agents: {
    spawn: (options: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.SPAWN, options),
    kill: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.KILL, agentId),
    pause: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.PAUSE, agentId),
    resume: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.RESUME, agentId),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.LIST),
    respawn: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.RESPAWN, agentId),
    getState: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.GET_STATE, agentId),
    sendInput: (agentId: string, data: string) => {
      ipcRenderer.send(IPC_CHANNELS.AGENTS.SEND_INPUT, agentId, data)
    },
    resize: (agentId: string, cols: number, rows: number) => {
      ipcRenderer.send(IPC_CHANNELS.AGENTS.RESIZE, agentId, cols, rows)
    },
    updateColor: (agentId: string, color: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_COLOR, agentId, color),
    updateTaskDescription: (agentId: string, taskDescription: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_TASK_DESCRIPTION, agentId, taskDescription),
    rename: (agentId: string, name: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.RENAME, agentId, name),
    updateModel: (agentId: string, model: string, provider: string, effortLevel: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_MODEL, agentId, model, provider, effortLevel),
    attachTerminal: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.ATTACH_TERMINAL, agentId),
    detachTerminal: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.DETACH_TERMINAL, agentId),
    getProxyPath: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.GET_PROXY_PATH, agentId),
    updateVoiceMode: (agentId: string, mode: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_VOICE_MODE, agentId, mode)
  },
  models: {
    listAll: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS.LIST_ALL),
    fetchOllama: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS.FETCH_OLLAMA)
  },
  db: {
    getRepos: () => ipcRenderer.invoke(IPC_CHANNELS.DB.GET_REPOS),
    addRepo: (repo: unknown) => ipcRenderer.invoke(IPC_CHANNELS.DB.ADD_REPO, repo),
    removeRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB.REMOVE_REPO, repoId),
    unhideRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB.UNHIDE_REPO, repoId),
    updateRepoColor: (repoId: string, color: string) => ipcRenderer.invoke(IPC_CHANNELS.DB.UPDATE_REPO_COLOR, repoId, color)
  },
  search: {
    query: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH.QUERY, query)
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TASKS.LIST),
    getByRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.GET_BY_REPO, repoId),
    getByStatus: (status: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.GET_BY_STATUS, status),
    create: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.SEARCH, query)
  },
  clips: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.LIST),
    get: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.GET, id),
    create: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.DELETE, id),
    recordLaunch: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CLIPS.RECORD_LAUNCH, id)
  },
  bugs: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.BUGS.LIST),
    getByRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.BUGS.GET_BY_REPO, repoId),
    getBySeverity: (severity: string) => ipcRenderer.invoke(IPC_CHANNELS.BUGS.GET_BY_SEVERITY, severity),
    getUnresolved: () => ipcRenderer.invoke(IPC_CHANNELS.BUGS.GET_UNRESOLVED),
    create: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.BUGS.CREATE, input),
    resolve: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BUGS.RESOLVE, id),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BUGS.DELETE, id)
  },
  notes: {
    get: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.NOTES.GET, id),
    getByAgent: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES.GET_BY_AGENT, agentId),
    getByRepo: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES.GET_BY_REPO, repoPath),
    getGlobal: () => ipcRenderer.invoke(IPC_CHANNELS.NOTES.GET_GLOBAL),
    save: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.NOTES.SAVE, input),
    delete: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.NOTES.DELETE, id)
  },
  history: {
    get: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY.GET, agentId),
    search: (agentId: string, query: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.HISTORY.SEARCH, agentId, query)
  },
  dialog: {
    openDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.DIALOG.OPEN_DIRECTORY)
  },
  usage: {
    getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.USAGE.GET_SNAPSHOT),
    refresh: () => ipcRenderer.invoke(IPC_CHANNELS.USAGE.REFRESH)
  },
  guardrails: {
    get: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GUARDRAILS.GET, repoPath),
    update: (repoPath: string, key: string, value: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.GUARDRAILS.UPDATE, repoPath, key, value),
    reset: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GUARDRAILS.RESET, repoPath)
  },
  health: {
    getSnapshot: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.HEALTH.GET_SNAPSHOT, agentId)
  },
  snapshots: {
    take: (trigger?: string) => ipcRenderer.invoke(IPC_CHANNELS.SNAPSHOTS.TAKE, trigger),
    getLatest: () => ipcRenderer.invoke(IPC_CHANNELS.SNAPSHOTS.GET_LATEST),
    prune: () => ipcRenderer.invoke(IPC_CHANNELS.SNAPSHOTS.PRUNE)
  },
  recovery: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.RECOVERY.GET_INFO),
    getSbar: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.RECOVERY.GET_SBAR, agentId),
    createSbar: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.RECOVERY.CREATE_SBAR, input),
    ackRecovery: () => ipcRenderer.invoke(IPC_CHANNELS.RECOVERY.ACK_RECOVERY)
  },
  skills: {
    list: (repoPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS.LIST, { repoPath }),
    execute: (skillId: string, repoPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS.EXECUTE, { skillId, repoPath }),
    refresh: (repoPath?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SKILLS.REFRESH, { repoPath })
  },
  git: {
    getStatus: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.GET_STATUS, repoPath),
    getAllStatus: () => ipcRenderer.invoke(IPC_CHANNELS.GIT.GET_ALL_STATUS),
    getDiff: (input: { repoPath: string; staged?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.GET_DIFF, input),
    stageFiles: (input: { repoPath: string; files: string[] }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.STAGE_FILES, input),
    unstageFiles: (input: { repoPath: string; files: string[] }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.UNSTAGE_FILES, input),
    commit: (input: { repoPath: string; message: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.COMMIT, input),
    push: (input: { repoPath: string; branch?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.PUSH, input),
    pull: (repoPath: string) => ipcRenderer.invoke(IPC_CHANNELS.GIT.PULL, repoPath),
    getLog: (input: { repoPath: string; limit?: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.GET_LOG, input),
    getBranches: (repoPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.GET_BRANCHES, repoPath),
    suggestCommit: (repoPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.GIT.SUGGEST_COMMIT, repoPath)
  },
  windows: {
    createBreakout: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOWS.CREATE_BREAKOUT, agentId),
    createFilePreview: (input: { filePath: string; repoPath: string; theme?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOWS.CREATE_FILE_PREVIEW, input),
    closeBreakout: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOWS.CLOSE_BREAKOUT, agentId),
    listBreakouts: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOWS.LIST_BREAKOUTS),
    focusBreakout: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOWS.FOCUS_BREAKOUT, agentId)
  },
  settings: {
    getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_ALL),
    set: (key: string, value: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET, key, value),
    export: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.EXPORT),
    import: (data: unknown) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.IMPORT, data)
  },
  clipboard: {
    writeText: (text: string) => clipboard.writeText(text),
    readText: () => clipboard.readText()
  },
  system: {
    getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_APP_VERSION),
    getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_PLATFORM),
    shutdown: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.SHUTDOWN),
    minimizeToTray: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.MINIMIZE_TO_TRAY),
    openTerminal: (command: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_TERMINAL, command)
  },
  log: {
    rendererError: (payload: RendererErrorPayload): void => {
      ipcRenderer.send(IPC_CHANNELS.LOG.RENDERER_ERROR, payload)
    }
  },
  voice: {
    transcribe: (audioBuffer: ArrayBuffer) =>
      ipcRenderer.invoke(IPC_CHANNELS.VOICE.TRANSCRIBE, audioBuffer),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.VOICE.STATUS),
    cancel: () => ipcRenderer.invoke(IPC_CHANNELS.VOICE.CANCEL)
  },
  docker: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER.STATUS),
    build: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER.BUILD),
    rebuild: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER.REBUILD),
    checkCliVersion: () => ipcRenderer.invoke(IPC_CHANNELS.DOCKER.CHECK_CLI_VERSION),
    onBuildProgress: (callback: (line: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, line: string): void => callback(line)
      ipcRenderer.on(IPC_EVENTS.DOCKER.BUILD_PROGRESS, handler)
      return (): void => { ipcRenderer.removeListener(IPC_EVENTS.DOCKER.BUILD_PROGRESS, handler) }
    }
  },
  fs: {
    readDir: (input: { repoPath: string; dirPath: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS.READ_DIR, input),
    readFile: (input: { repoPath: string; filePath: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.FS.READ_FILE, input)
  },
  containers: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS.LIST),
    stop: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS.STOP, repoId),
    destroy: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS.DESTROY, repoId),
    stopAll: () => ipcRenderer.invoke(IPC_CHANNELS.CONTAINERS.STOP_ALL)
  },
  activity: {
    query: (params: { since: string; repoId?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY.QUERY, params),
    stats: (params: { since: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.ACTIVITY.STATS, params)
  },
  project: {
    init: (cwd: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT.INIT, cwd)
  },
  kanban: {
    open: (agentId?: string) => ipcRenderer.invoke(IPC_CHANNELS.KANBAN.OPEN, agentId),
    updatePosition: (taskId: string, position: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN.UPDATE_POSITION, taskId, position),
    sprintIntake: (stories: unknown[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.KANBAN.SPRINT_INTAKE, stories)
  },
  projects: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.LIST),
    create: (input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.CREATE, input),
    update: (id: string, input: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.UPDATE, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.DELETE, id),
    getByRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.GET_BY_REPO, repoId),
    linkRepo: (projectId: string, repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.LINK_REPO, projectId, repoId),
    unlinkRepo: (projectId: string, repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.UNLINK_REPO, projectId, repoId)
  },
  tts: {
    speak: (opts: { text: string; voiceId: string; rate: number; volume: number }) =>
      ipcRenderer.invoke(IPC_CHANNELS.TTS.SPEAK, opts),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.TTS.STOP),
    status: () => ipcRenderer.invoke(IPC_CHANNELS.TTS.STATUS),
    listVoices: () => ipcRenderer.invoke(IPC_CHANNELS.TTS.LIST_VOICES),
    onResponseReady: (cb: (agentId: string, text: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, agentId: string, text: string) =>
        cb(agentId, text)
      ipcRenderer.on(IPC_EVENTS.TTS.RESPONSE_READY, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.TTS.RESPONSE_READY, handler)
    },
  },
  on: {
    agentStatusChange: (
      callback: (agentId: string, status: string, confidence: string) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        agentId: string,
        status: string,
        confidence: string
      ): void => callback(agentId, status, confidence)
      ipcRenderer.on(IPC_EVENTS.AGENTS.STATUS_CHANGE, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.AGENTS.STATUS_CHANGE, handler)
    },
    agentOutput: (callback: (agentId: string, data: string) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        agentId: string,
        data: string
      ): void => callback(agentId, data)
      ipcRenderer.on(IPC_EVENTS.AGENTS.OUTPUT, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.AGENTS.OUTPUT, handler)
    },
    agentExit: (callback: (agentId: string, exitCode: number) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        agentId: string,
        exitCode: number
      ): void => callback(agentId, exitCode)
      ipcRenderer.on(IPC_EVENTS.AGENTS.EXIT, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.AGENTS.EXIT, handler)
    },
    breakoutClosed: (callback: (agentId: string) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        agentId: string
      ): void => callback(agentId)
      ipcRenderer.on(IPC_EVENTS.WINDOWS.BREAKOUT_CLOSED, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.WINDOWS.BREAKOUT_CLOSED, handler)
    },
    snapshotSaved: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC_EVENTS.RECOVERY.SNAPSHOT_SAVED, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.RECOVERY.SNAPSHOT_SAVED, handler)
    },
    agentTriaged: (callback: (result: import('../shared/types/notification.types').RoutingResult) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        result: import('../shared/types/notification.types').RoutingResult
      ): void => callback(result)
      ipcRenderer.on(IPC_EVENTS.NOTIFICATIONS.TRIAGED, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.NOTIFICATIONS.TRIAGED, handler)
    },
    dockerStatusChange: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC_EVENTS.DOCKER.STATUS_CHANGE, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.DOCKER.STATUS_CHANGE, handler)
    },
    tasksUpdated: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on(IPC_EVENTS.TASKS.UPDATED, handler)
      return () => ipcRenderer.removeListener(IPC_EVENTS.TASKS.UPDATED, handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('agentHub', agentHubBridge)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.agentHub = agentHubBridge
}
