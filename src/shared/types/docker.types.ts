export type ContainerStatus = 'creating' | 'running' | 'stopped' | 'destroyed' | 'error'

export interface ContainerInfo {
  id: string
  repoId: string
  containerId: string
  status: ContainerStatus
  createdAt: string
  lastActivity: string
  config: DockerContainerConfig
}

export interface DockerStatus {
  available: boolean
  version?: string
  imageReady: boolean
  imageTag: string
  activeContainerCount: number
}

export interface DockerContainerConfig {
  cpus: number
  memoryGb: number
  networkMode: 'host' | 'none'
  repoPath: string
  isLeadAgent: boolean
}

export interface DockerConfig {
  enabled: boolean
  ttlDays: number
  cpus: number
  memoryGb: number
  networkMode: 'host' | 'none'
}

export const DOCKER_IMAGE_TAG = 'agenthub-cli:latest'
export const DOCKER_DEFAULT_TTL_DAYS = 7
export const DOCKER_CONTAINER_PREFIX = 'agenthub-'
