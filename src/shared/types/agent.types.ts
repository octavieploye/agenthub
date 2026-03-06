export type AgentLifecycleStatus =
  | 'spawning'
  | 'busy'
  | 'idle'
  | 'locked'
  | 'completed'
  | 'looping'
  | 'paused'
  | 'interrupted'
  | 'tray_running'

export type StatusConfidence = 'confirmed' | 'inferred' | 'unknown'

export type ModelProvider = 'anthropic' | 'ollama-local' | 'ollama-cloud'

export interface AgentState {
  id: string
  repoId: string
  name: string
  status: AgentLifecycleStatus
  confidence: StatusConfidence
  model: string
  provider: ModelProvider
  taskDescription: string
  pid: number | null
  ptyFd: number | null
  cwd: string
  createdAt: string
  updatedAt: string
  progress: number
  color: string
}

export interface AgentSpawnOptions {
  repoId: string
  name: string
  cwd: string
  model?: string
  provider?: ModelProvider
  taskDescription?: string
  envOverrides?: Record<string, string>
  color?: string
}
