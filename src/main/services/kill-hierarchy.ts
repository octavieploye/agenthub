import { killProcessTree } from './process-tree'

export interface KillHierarchyCallbacks {
  sendSignal: (pid: number, signal: string) => void
  updateStatus: (agentId: string, status: string, confidence: string) => void
  isProcessAlive: (pid: number) => boolean
  onWarning: (agentId: string, message: string) => void
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function executeKillHierarchy(
  agentId: string,
  pid: number,
  callbacks: KillHierarchyCallbacks
): Promise<void> {
  if (!agentId) throw new Error('agentId is required')
  if (pid <= 0) throw new Error('pid must be positive')

  // Step 1: SIGTSTP (pause) — immediate and reversible
  callbacks.sendSignal(pid, 'SIGTSTP')
  callbacks.updateStatus(agentId, 'paused', 'confirmed')

  await wait(2000)
  if (!callbacks.isProcessAlive(pid)) return

  // Step 2: SIGINT — graceful interrupt
  callbacks.sendSignal(pid, 'SIGINT')
  callbacks.updateStatus(agentId, 'interrupted', 'confirmed')

  await wait(2000)
  if (!callbacks.isProcessAlive(pid)) return

  // Step 3: SIGTERM — terminate
  callbacks.sendSignal(pid, 'SIGTERM')
  callbacks.updateStatus(agentId, 'interrupted', 'confirmed')

  await wait(5000)
  if (!callbacks.isProcessAlive(pid)) return

  // Step 4: SIGKILL + tree kill — last resort
  callbacks.onWarning(agentId, 'Sending SIGKILL + tree kill — work may be lost')
  await killProcessTree(pid, 'SIGKILL').catch(() => {
    // Fallback to direct signal if tree kill fails
    callbacks.sendSignal(pid, 'SIGKILL')
  })
  callbacks.updateStatus(agentId, 'interrupted', 'confirmed')
}
