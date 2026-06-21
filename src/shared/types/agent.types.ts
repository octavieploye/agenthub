export type ExecutionMode = 'native' | 'docker'

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
  | 'error'
  | 'awaiting_approval'

export type StatusConfidence = 'confirmed' | 'inferred' | 'unknown'

export type ModelProvider = 'anthropic' | 'ollama-local' | 'ollama-cloud'

export type EffortLevel = 'high' | 'medium' | 'low'

import type { VoiceMode } from './voice.types'
export type { VoiceMode }

export interface AgentState {
  id: string
  repoId: string
  name: string
  status: AgentLifecycleStatus
  confidence: StatusConfidence
  model: string
  provider: ModelProvider
  effortLevel: EffortLevel
  taskDescription: string
  pid: number | null
  ptyFd: number | null
  cwd: string
  createdAt: string
  updatedAt: string
  progress: number
  color: string
  executionMode: ExecutionMode
  voiceMode: VoiceMode
}

export interface AgentSpawnOptions {
  repoId: string
  name: string
  cwd: string
  model?: string
  provider?: ModelProvider
  effortLevel?: EffortLevel
  taskDescription?: string
  envOverrides?: Record<string, string>
  color?: string
  cols?: number
  rows?: number
  skipPermissions?: boolean
  isLeadAgent?: boolean
  voiceMode?: VoiceMode
}
