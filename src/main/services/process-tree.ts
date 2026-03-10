import { execFile } from 'child_process'

const TREE_KILL_TIMEOUT_MS = 5000

/**
 * Kill an entire process tree (parent + all descendants).
 * - Unix: sends signal to process group (-pid), falls back to pkill -P
 * - Windows: uses taskkill /T /F /PID for native tree kill
 */
export async function killProcessTree(pid: number, signal = 'SIGKILL'): Promise<void> {
  if (pid <= 0) throw new Error('pid must be positive')

  if (process.platform === 'win32') {
    return killTreeWindows(pid)
  }
  return killTreeUnix(pid, signal)
}

function killTreeUnix(pid: number, signal: string): Promise<void> {
  return new Promise((resolve) => {
    // Strategy 1: Kill the process group (negative PID)
    try {
      process.kill(-pid, signal)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ESRCH') {
        // Process already dead
        resolve()
        return
      }
      // EPERM or other — fall through to pkill
    }

    // Strategy 2: pkill children by parent PID
    execFile('pkill', ['-P', String(pid)], () => {
      // Ignore errors — children may already be dead
      // Now kill the parent itself
      try {
        process.kill(pid, signal)
      } catch {
        // Already dead
      }
      resolve()
    })
  })
}

function killTreeWindows(pid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`taskkill timed out after ${TREE_KILL_TIMEOUT_MS}ms`))
    }, TREE_KILL_TIMEOUT_MS)

    execFile('taskkill', ['/T', '/F', '/PID', String(pid)], (err) => {
      clearTimeout(timer)
      if (err) {
        const msg = (err as Error).message ?? ''
        // "not found" means process already exited — treat as success
        if (msg.includes('not found') || msg.includes('not running')) {
          resolve()
          return
        }
        reject(err)
        return
      }
      resolve()
    })
  })
}
