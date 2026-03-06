import { useCallback } from 'react'
import type { IpcResponse } from '@shared/types/ipc.types'

function unwrap<T>(response: IpcResponse<T>): T {
  if (response.success) return response.data
  throw new Error(`[${response.error.code}] ${response.error.message}`)
}

export function useIPC() {
  const agents = {
    spawn: useCallback(async (options: Parameters<typeof window.agentHub.agents.spawn>[0]) => {
      return unwrap(await window.agentHub.agents.spawn(options))
    }, []),
    kill: useCallback(async (agentId: string) => {
      return unwrap(await window.agentHub.agents.kill(agentId))
    }, []),
    pause: useCallback(async (agentId: string) => {
      return unwrap(await window.agentHub.agents.pause(agentId))
    }, []),
    resume: useCallback(async (agentId: string) => {
      return unwrap(await window.agentHub.agents.resume(agentId))
    }, []),
    list: useCallback(async () => {
      return unwrap(await window.agentHub.agents.list())
    }, []),
    getState: useCallback(async (agentId: string) => {
      return unwrap(await window.agentHub.agents.getState(agentId))
    }, []),
    sendInput: useCallback(async (agentId: string, data: string) => {
      return unwrap(await window.agentHub.agents.sendInput(agentId, data))
    }, []),
    resize: useCallback(async (agentId: string, cols: number, rows: number) => {
      return unwrap(await window.agentHub.agents.resize(agentId, cols, rows))
    }, [])
  }

  const db = {
    getRepos: useCallback(async () => {
      return unwrap(await window.agentHub.db.getRepos())
    }, []),
    addRepo: useCallback(
      async (repo: Parameters<typeof window.agentHub.db.addRepo>[0]) => {
        return unwrap(await window.agentHub.db.addRepo(repo))
      },
      []
    ),
    removeRepo: useCallback(async (repoId: string) => {
      return unwrap(await window.agentHub.db.removeRepo(repoId))
    }, [])
  }

  const system = {
    getAppVersion: useCallback(async () => {
      return unwrap(await window.agentHub.system.getAppVersion())
    }, []),
    getPlatform: useCallback(async () => {
      return unwrap(await window.agentHub.system.getPlatform())
    }, [])
  }

  return { agents, db, system }
}
