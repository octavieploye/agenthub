import { exec, spawn } from 'child_process'
import { BrowserWindow } from 'electron'
import { promisify } from 'util'
import type { DockerStatus } from '../../shared/types/docker.types'
import { DOCKER_IMAGE_TAG } from '../../shared/types/docker.types'
import { IPC_EVENTS } from '../../shared/constants/ipc-channels'

const execAsync = promisify(exec)
const STATUS_CACHE_TTL_MS = 30_000

interface DockerServiceDeps {
  logInfo: (message: string, meta?: Record<string, unknown>) => void
  logWarning: (message: string, meta?: Record<string, unknown>) => void
}

export class DockerService {
  private readonly deps: DockerServiceDeps
  private statusCache: DockerStatus | null = null
  private statusCacheTime = 0

  constructor(deps: DockerServiceDeps) {
    this.deps = deps
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('docker info --format "{{.ServerVersion}}"')
      return true
    } catch {
      return false
    }
  }

  async getVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"')
      return stdout.trim() || undefined
    } catch {
      return undefined
    }
  }

  async isImageBuilt(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`docker image inspect ${DOCKER_IMAGE_TAG} --format "{{.Id}}"`)
      return stdout.trim().length > 0
    } catch {
      return false
    }
  }

  async getStatus(): Promise<DockerStatus> {
    const now = Date.now()
    if (this.statusCache && now - this.statusCacheTime < STATUS_CACHE_TTL_MS) {
      return this.statusCache
    }
    const available = await this.isAvailable()
    const version = available ? await this.getVersion() : undefined
    const imageReady = available ? await this.isImageBuilt() : false
    const status: DockerStatus = {
      available,
      version,
      imageReady,
      imageTag: DOCKER_IMAGE_TAG,
      activeContainerCount: 0
    }
    this.statusCache = status
    this.statusCacheTime = now
    return status
  }

  invalidateCache(): void {
    this.statusCache = null
    this.statusCacheTime = 0
  }

  async buildImage(dockerfilePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('docker', ['build', '-t', DOCKER_IMAGE_TAG, dockerfilePath], {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      const emitProgress = (line: string): void => {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send(IPC_EVENTS.DOCKER.BUILD_PROGRESS, line)
          }
        }
      }

      proc.stdout?.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n').filter(Boolean)) {
          this.deps.logInfo('docker build stdout', { line })
          emitProgress(line)
        }
      })

      proc.stderr?.on('data', (data: Buffer) => {
        for (const line of data.toString().split('\n').filter(Boolean)) {
          emitProgress(line)
        }
      })

      proc.on('close', (code) => {
        this.invalidateCache()
        if (code === 0) resolve()
        else reject(new Error(`docker build exited with code ${code}`))
      })

      proc.on('error', reject)
    })
  }

  async ensureImage(dockerfilePath: string): Promise<void> {
    const ready = await this.isImageBuilt()
    if (!ready) {
      this.deps.logInfo('DockerService: image not found, building', {})
      await this.buildImage(dockerfilePath)
    }
  }

  async checkCliVersion(): Promise<{ hostVersion: string | null; imageVersion: string | null; mismatch: boolean }> {
    let hostVersion: string | null = null
    try {
      const { stdout } = await execAsync('claude --version')
      // claude --version output looks like: "Claude Code 1.2.3" or "1.2.3"
      // Extract the first version-like token (digits.digits.digits)
      const match = stdout.match(/(\d+\.\d+\.\d+)/)
      hostVersion = match ? match[1] : stdout.trim().split('\n')[0] ?? null
    } catch { /* claude not installed on host */ }

    let imageVersion: string | null = null
    try {
      const imageBuilt = await this.isImageBuilt()
      if (imageBuilt) {
        const { stdout } = await execAsync(`docker run --rm --entrypoint claude ${DOCKER_IMAGE_TAG} --version`)
        const match = stdout.match(/(\d+\.\d+\.\d+)/)
        imageVersion = match ? match[1] : stdout.trim().split('\n')[0] ?? null
      }
    } catch { /* image not available or claude not in image */ }

    const mismatch = hostVersion !== null && imageVersion !== null && hostVersion !== imageVersion
    return { hostVersion, imageVersion, mismatch }
  }
}
