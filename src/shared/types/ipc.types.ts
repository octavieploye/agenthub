export interface IpcSuccess<T> {
  success: true
  data: T
}

export interface IpcError {
  success: false
  error: {
    code: string
    message: string
  }
}

export type IpcResponse<T> = IpcSuccess<T> | IpcError

export interface AgentHubBridge {
  agents: {
    spawn: (options: import('./agent.types').AgentSpawnOptions) => Promise<IpcResponse<import('./agent.types').AgentState>>
    kill: (agentId: string) => Promise<IpcResponse<void>>
    pause: (agentId: string) => Promise<IpcResponse<void>>
    resume: (agentId: string) => Promise<IpcResponse<void>>
    list: () => Promise<IpcResponse<import('./agent.types').AgentState[]>>
    getState: (agentId: string) => Promise<IpcResponse<import('./agent.types').AgentState>>
    sendInput: (agentId: string, data: string) => Promise<IpcResponse<void>>
    resize: (agentId: string, cols: number, rows: number) => Promise<IpcResponse<void>>
  }
  db: {
    getRepos: () => Promise<IpcResponse<import('./config.types').RepoConfig[]>>
    addRepo: (repo: Omit<import('./config.types').RepoConfig, 'id' | 'createdAt'>) => Promise<IpcResponse<import('./config.types').RepoConfig>>
    removeRepo: (repoId: string) => Promise<IpcResponse<void>>
  }
  search: {
    query: (query: string) => Promise<IpcResponse<import('../types/search.types').SearchResult[]>>
  }
  tasks: {
    list: () => Promise<IpcResponse<import('./task.types').TaskItem[]>>
    getByRepo: (repoId: string) => Promise<IpcResponse<import('./task.types').TaskItem[]>>
    getByStatus: (status: import('./task.types').TaskStatus) => Promise<IpcResponse<import('./task.types').TaskItem[]>>
    create: (input: import('./task.types').CreateTaskInput) => Promise<IpcResponse<import('./task.types').TaskItem>>
    update: (id: string, input: import('./task.types').UpdateTaskInput) => Promise<IpcResponse<void>>
    delete: (id: string) => Promise<IpcResponse<void>>
  }
  clips: {
    list: () => Promise<IpcResponse<import('./clip.types').ClipItem[]>>
    get: (id: string) => Promise<IpcResponse<import('./clip.types').ClipItem | null>>
    create: (input: unknown) => Promise<IpcResponse<import('./clip.types').ClipItem>>
    update: (id: string, input: unknown) => Promise<IpcResponse<import('./clip.types').ClipItem | null>>
    delete: (id: string) => Promise<IpcResponse<void>>
    recordLaunch: (id: string) => Promise<IpcResponse<void>>
  }
  bugs: {
    list: () => Promise<IpcResponse<import('./bug-radar.types').BugEntry[]>>
    getByRepo: (repoId: string) => Promise<IpcResponse<import('./bug-radar.types').BugEntry[]>>
    getBySeverity: (severity: string) => Promise<IpcResponse<import('./bug-radar.types').BugEntry[]>>
    getUnresolved: () => Promise<IpcResponse<import('./bug-radar.types').BugEntry[]>>
    create: (input: unknown) => Promise<IpcResponse<import('./bug-radar.types').BugEntry>>
    resolve: (id: string) => Promise<IpcResponse<void>>
    delete: (id: string) => Promise<IpcResponse<void>>
  }
  dialog: {
    openDirectory: () => Promise<IpcResponse<string | null>>
  }
  usage: {
    getSnapshot: () => Promise<IpcResponse<unknown>>
    refresh: () => Promise<IpcResponse<unknown>>
  }
  guardrails: {
    get: (repoPath: string) => Promise<IpcResponse<import('./config.types').GuardrailConfig>>
    update: (repoPath: string, key: string, value: unknown) => Promise<IpcResponse<import('./config.types').GuardrailConfig>>
    reset: (repoPath: string) => Promise<IpcResponse<import('./config.types').GuardrailConfig>>
  }
  health: {
    getSnapshot: (agentId: string) => Promise<IpcResponse<unknown>>
  }
  recovery: {
    getInfo: () => Promise<IpcResponse<import('./recovery.types').RecoveryInfo>>
    getSbar: (agentId: string) => Promise<IpcResponse<import('./recovery.types').SBARHandoff | null>>
    createSbar: (input: import('./recovery.types').CreateSBARInput) => Promise<IpcResponse<import('./recovery.types').SBARHandoff>>
    ackRecovery: () => Promise<IpcResponse<void>>
  }
  system: {
    getAppVersion: () => Promise<IpcResponse<string>>
    getPlatform: () => Promise<IpcResponse<string>>
    shutdown: () => Promise<IpcResponse<void>>
    minimizeToTray: () => Promise<IpcResponse<void>>
  }
  on: {
    agentStatusChange: (callback: (agentId: string, status: import('./agent.types').AgentLifecycleStatus, confidence: import('./agent.types').StatusConfidence) => void) => () => void
    agentOutput: (callback: (agentId: string, data: string) => void) => () => void
    agentExit: (callback: (agentId: string, exitCode: number) => void) => () => void
  }
}
