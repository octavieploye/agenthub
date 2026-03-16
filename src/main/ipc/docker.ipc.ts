import { ipcMain, app } from 'electron'
import path from 'path'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getDockerService, getContainerManager } from '../services/service-orchestrator'

function getDockerfilePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'docker', 'agent')
  }
  return path.join(process.cwd(), 'docker', 'agent')
}

export function registerDockerHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DOCKER.STATUS, async () => {
    try {
      const svc = getDockerService()
      if (!svc) return error('SERVICE_ERROR', 'DockerService not initialized')
      const status = await svc.getStatus()
      const containerMgr = getContainerManager()
      const activeCount = containerMgr?.listContainers().filter(c => c.status === 'running').length ?? 0
      return success({ ...status, activeContainerCount: activeCount })
    } catch (err) {
      return error('DOCKER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER.BUILD, async () => {
    try {
      const svc = getDockerService()
      if (!svc) return error('SERVICE_ERROR', 'DockerService not initialized')
      await svc.buildImage(getDockerfilePath())
      return success(undefined)
    } catch (err) {
      return error('DOCKER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER.REBUILD, async () => {
    try {
      const svc = getDockerService()
      if (!svc) return error('SERVICE_ERROR', 'DockerService not initialized')
      await svc.buildImage(getDockerfilePath())
      return success(undefined)
    } catch (err) {
      return error('DOCKER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCKER.CHECK_CLI_VERSION, async () => {
    try {
      const svc = getDockerService()
      if (!svc) return error('SERVICE_ERROR', 'DockerService not initialized')
      const result = await svc.checkCliVersion()
      return success(result)
    } catch (err) {
      return error('CHECK_CLI_VERSION_FAILED', String(err))
    }
  })
}
