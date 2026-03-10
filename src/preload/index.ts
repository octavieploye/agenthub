import { contextBridge, ipcRenderer, clipboard } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, IPC_EVENTS } from '../shared/constants/ipc-channels'

const agentHubBridge = {
  agents: {
    spawn: (options: unknown) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.SPAWN, options),
    kill: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.KILL, agentId),
    pause: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.PAUSE, agentId),
    resume: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.RESUME, agentId),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.LIST),
    getState: (agentId: string) => ipcRenderer.invoke(IPC_CHANNELS.AGENTS.GET_STATE, agentId),
    sendInput: (agentId: string, data: string) => {
      ipcRenderer.send(IPC_CHANNELS.AGENTS.SEND_INPUT, agentId, data)
    },
    resize: (agentId: string, cols: number, rows: number) => {
      ipcRenderer.send(IPC_CHANNELS.AGENTS.RESIZE, agentId, cols, rows)
    },
    updateColor: (agentId: string, color: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_COLOR, agentId, color),
    updateModel: (agentId: string, model: string, provider: string, effortLevel: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.UPDATE_MODEL, agentId, model, provider, effortLevel),
    attachTerminal: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.ATTACH_TERMINAL, agentId),
    detachTerminal: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.DETACH_TERMINAL, agentId),
    getProxyPath: (agentId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.GET_PROXY_PATH, agentId)
  },
  models: {
    listAll: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS.LIST_ALL),
    fetchOllama: () => ipcRenderer.invoke(IPC_CHANNELS.MODELS.FETCH_OLLAMA)
  },
  db: {
    getRepos: () => ipcRenderer.invoke(IPC_CHANNELS.DB.GET_REPOS),
    addRepo: (repo: unknown) => ipcRenderer.invoke(IPC_CHANNELS.DB.ADD_REPO, repo),
    removeRepo: (repoId: string) => ipcRenderer.invoke(IPC_CHANNELS.DB.REMOVE_REPO, repoId)
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
