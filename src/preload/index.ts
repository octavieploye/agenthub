import { contextBridge, ipcRenderer } from 'electron'
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
    sendInput: (agentId: string, data: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.SEND_INPUT, agentId, data),
    resize: (agentId: string, cols: number, rows: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.AGENTS.RESIZE, agentId, cols, rows)
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
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.DELETE, id)
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
  system: {
    getAppVersion: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_APP_VERSION),
    getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_PLATFORM),
    shutdown: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.SHUTDOWN),
    minimizeToTray: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.MINIMIZE_TO_TRAY)
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
