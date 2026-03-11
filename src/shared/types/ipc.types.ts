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
    sendInput: (agentId: string, data: string) => void
    resize: (agentId: string, cols: number, rows: number) => void
    updateColor: (agentId: string, color: string) => Promise<IpcResponse<void>>
    updateModel: (agentId: string, model: string, provider: string, effortLevel: string) => Promise<IpcResponse<void>>
    attachTerminal: (agentId: string) => Promise<IpcResponse<{ socketPath: string; attachCommand: string }>>
    detachTerminal: (agentId: string) => Promise<IpcResponse<void>>
    getProxyPath: (agentId: string) => Promise<IpcResponse<string | null>>
  }
  models: {
    listAll: () => Promise<IpcResponse<import('./model.types').ModelCatalogEntry[]>>
    fetchOllama: () => Promise<IpcResponse<import('./model.types').ModelCatalogEntry[]>>
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
    search: (query: string) => Promise<IpcResponse<import('./task.types').TaskItem[]>>
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
  snapshots: {
    take: (trigger?: string) => Promise<IpcResponse<import('./recovery.types').SessionSnapshot>>
    getLatest: () => Promise<IpcResponse<import('./recovery.types').SessionSnapshot | null>>
    prune: () => Promise<IpcResponse<{ deleted: number }>>
  }
  recovery: {
    getInfo: () => Promise<IpcResponse<import('./recovery.types').RecoveryInfo>>
    getSbar: (agentId: string) => Promise<IpcResponse<import('./recovery.types').SBARHandoff | null>>
    createSbar: (input: import('./recovery.types').CreateSBARInput) => Promise<IpcResponse<import('./recovery.types').SBARHandoff>>
    ackRecovery: () => Promise<IpcResponse<void>>
  }
  notes: {
    get: (id: number) => Promise<IpcResponse<import('./note.types').NoteItem | null>>
    getByAgent: (agentId: string) => Promise<IpcResponse<import('./note.types').NoteItem[]>>
    getByRepo: (repoPath: string) => Promise<IpcResponse<import('./note.types').NoteItem[]>>
    getGlobal: () => Promise<IpcResponse<import('./note.types').NoteItem[]>>
    save: (input: import('./note.types').CreateNoteInput) => Promise<IpcResponse<import('./note.types').NoteItem>>
    delete: (id: number) => Promise<IpcResponse<void>>
  }
  history: {
    get: (agentId: string) => Promise<IpcResponse<import('./history.types').HistoryEntry[]>>
    search: (agentId: string, query: string) => Promise<IpcResponse<import('./history.types').HistorySearchResult[]>>
  }
  skills: {
    list: (repoPath?: string) => Promise<IpcResponse<import('./skills.types').SkillItem[]>>
    execute: (skillId: string, repoPath?: string) => Promise<IpcResponse<import('./skills.types').SkillExecutionResult>>
    refresh: (repoPath?: string) => Promise<IpcResponse<import('./skills.types').SkillItem[]>>
  }
  git: {
    getStatus: (repoPath: string) => Promise<IpcResponse<import('./git.types').GitRepoStatus>>
    getAllStatus: () => Promise<IpcResponse<import('./git.types').GitRepoStatus[]>>
    getDiff: (input: { repoPath: string; staged?: boolean }) => Promise<IpcResponse<import('./git.types').GitDiffResult>>
    stageFiles: (input: { repoPath: string; files: string[] }) => Promise<IpcResponse<void>>
    unstageFiles: (input: { repoPath: string; files: string[] }) => Promise<IpcResponse<void>>
    commit: (input: { repoPath: string; message: string }) => Promise<IpcResponse<string>>
    push: (input: { repoPath: string; branch?: string }) => Promise<IpcResponse<void>>
    pull: (repoPath: string) => Promise<IpcResponse<void>>
    getLog: (input: { repoPath: string; limit?: number }) => Promise<IpcResponse<import('./git.types').GitCommitEntry[]>>
    getBranches: (repoPath: string) => Promise<IpcResponse<import('./git.types').GitBranchInfo>>
    suggestCommit: (repoPath: string) => Promise<IpcResponse<string>>
  }
  windows: {
    createBreakout: (agentId: string) => Promise<IpcResponse<import('./window.types').BreakoutWindowInfo>>
    closeBreakout: (agentId: string) => Promise<IpcResponse<void>>
    listBreakouts: () => Promise<IpcResponse<import('./window.types').BreakoutWindowInfo[]>>
    focusBreakout: (agentId: string) => Promise<IpcResponse<void>>
  }
  settings: {
    getAll: () => Promise<IpcResponse<Record<string, string>>>
    set: (key: string, value: string) => Promise<IpcResponse<void>>
    export: () => Promise<IpcResponse<import('./settings.types').SettingsExport>>
    import: (data: import('./settings.types').SettingsExport) => Promise<IpcResponse<void>>
  }
  clipboard: {
    writeText: (text: string) => void
    readText: () => string
  }
  system: {
    getAppVersion: () => Promise<IpcResponse<string>>
    getPlatform: () => Promise<IpcResponse<string>>
    shutdown: () => Promise<IpcResponse<void>>
    minimizeToTray: () => Promise<IpcResponse<void>>
    openTerminal: (command: string) => Promise<IpcResponse<void>>
  }
  on: {
    agentStatusChange: (callback: (agentId: string, status: import('./agent.types').AgentLifecycleStatus, confidence: import('./agent.types').StatusConfidence) => void) => () => void
    agentOutput: (callback: (agentId: string, data: string) => void) => () => void
    agentExit: (callback: (agentId: string, exitCode: number) => void) => () => void
    breakoutClosed: (callback: (agentId: string) => void) => () => void
    snapshotSaved: (callback: () => void) => () => void
    agentTriaged: (callback: (result: import('./notification.types').RoutingResult) => void) => () => void
  }
}
