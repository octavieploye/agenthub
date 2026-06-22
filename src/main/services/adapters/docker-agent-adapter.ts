import * as pty from 'node-pty'
import { execFile } from 'child_process'
import log from 'electron-log/main'

export type DockerAgentRole = 'lead' | 'spawn'

export interface DockerExecOptions {
  cols?: number
  rows?: number
  role: DockerAgentRole
  env?: Record<string, string>
}

export class DockerAgentAdapter {
  /**
   * Spawns `docker exec -it <containerId> /bin/bash -l` via node-pty.
   * Returns a real pty.IPty — fully compatible with PtyProxy and all existing ptyProcess usage.
   * Uses /bin/bash (available in node:20-slim); zsh is not installed in the base image.
   */
  exec(containerId: string, options: DockerExecOptions): pty.IPty {
    const cols = options.cols ?? 120
    const rows = options.rows ?? 30

    const dockerPty = pty.spawn(
      'docker',
      ['exec', '-it', containerId, '/bin/bash', '-l'],
      {
        name: 'xterm-256color',
        cols,
        rows,
        env: process.env as Record<string, string>
      }
    )

    log.info('DockerAgentAdapter: exec spawned', {
      containerId,
      pid: dockerPty.pid,
      role: options.role
    })

    return dockerPty
  }

  /**
   * Gets the PID of the claude process running inside the container.
   */
  getClaudePidInContainer(containerId: string): Promise<number | null> {
    return new Promise((resolve) => {
      execFile(
        'docker',
        ['exec', containerId, 'pgrep', '-f', 'claude'],
        (err, stdout) => {
          if (err || !stdout.trim()) {
            resolve(null)
            return
          }
          const firstLine = stdout.trim().split('\n')[0]
          const pid = parseInt(firstLine ?? '', 10)
          resolve(isNaN(pid) ? null : pid)
        }
      )
    })
  }

  /**
   * Sends a signal to a process inside the container by PID.
   */
  sendSignalInContainer(containerId: string, pid: number, signal: string): Promise<void> {
    return new Promise((resolve) => {
      execFile('docker', ['exec', containerId, 'kill', `-${signal}`, String(pid)], () => resolve())
    })
  }

  /**
   * Checks if a process is alive inside the container.
   */
  isProcessAliveInContainer(containerId: string, pid: number): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('docker', ['exec', containerId, 'kill', '-0', String(pid)], (err) => {
        resolve(!err)
      })
    })
  }
}
