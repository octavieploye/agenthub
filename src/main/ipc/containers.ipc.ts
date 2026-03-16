import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/constants/ipc-channels'
import { success, error } from './ipc-helpers'
import { getContainerManager } from '../services/service-orchestrator'

export function registerContainersHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONTAINERS.LIST, async () => {
    try {
      const mgr = getContainerManager()
      if (!mgr) return error('SERVICE_ERROR', 'ContainerManager not initialized')
      return success(mgr.listContainers())
    } catch (err) {
      return error('CONTAINER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.CONTAINERS.STOP, async (_event, repoId: unknown) => {
    try {
      if (typeof repoId !== 'string') return error('VALIDATION_ERROR', 'repoId must be a string')
      const mgr = getContainerManager()
      if (!mgr) return error('SERVICE_ERROR', 'ContainerManager not initialized')
      await mgr.stopContainer(repoId)
      return success(undefined)
    } catch (err) {
      return error('CONTAINER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.CONTAINERS.DESTROY, async (_event, repoId: unknown) => {
    try {
      if (typeof repoId !== 'string') return error('VALIDATION_ERROR', 'repoId must be a string')
      const mgr = getContainerManager()
      if (!mgr) return error('SERVICE_ERROR', 'ContainerManager not initialized')
      await mgr.destroyContainer(repoId)
      return success(undefined)
    } catch (err) {
      return error('CONTAINER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })

  ipcMain.handle(IPC_CHANNELS.CONTAINERS.STOP_ALL, async () => {
    try {
      const mgr = getContainerManager()
      if (!mgr) return error('SERVICE_ERROR', 'ContainerManager not initialized')
      await mgr.stopAll()
      return success(undefined)
    } catch (err) {
      return error('CONTAINER_ERROR', err instanceof Error ? err.message : String(err))
    }
  })
}
