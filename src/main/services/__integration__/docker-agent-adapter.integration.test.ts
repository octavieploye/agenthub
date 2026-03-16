import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execSync, execFileSync } from 'child_process'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => []) } }))
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { DockerAgentAdapter } from '../adapters/docker-agent-adapter'
import { DOCKER_IMAGE_TAG } from '@shared/types/docker.types'

const SKIP = process.env.DOCKER_INTEGRATION !== 'true'

const CONTAINER_NAME = `agenthub-adapter-test-${Date.now()}`
let containerId: string

beforeAll(() => {
  if (SKIP) return
  containerId = execFileSync('docker', [
    'run', '-d', '--name', CONTAINER_NAME,
    '--cpus', '1', '--memory', '1g',
    DOCKER_IMAGE_TAG
  ], { encoding: 'utf-8' }).trim()
})

afterAll(() => {
  if (SKIP) return
  try { execSync(`docker rm -f ${CONTAINER_NAME}`, { stdio: 'ignore' }) } catch {}
})

describe.skipIf(SKIP)('DockerAgentAdapter — real Docker', () => {
  const adapter = new DockerAgentAdapter()

  // -------------------------------------------------------------------------
  // S6.3 — PTY bridge
  // -------------------------------------------------------------------------

  it('exec() returns an object with write, onData, kill, resize properties', () => {
    const ptyProc = adapter.exec(containerId, { cols: 80, rows: 24, role: 'spawn', env: {} })
    expect(typeof ptyProc.write).toBe('function')
    expect(typeof ptyProc.onData).toBe('function')
    expect(typeof ptyProc.kill).toBe('function')
    expect(typeof ptyProc.resize).toBe('function')
    ptyProc.kill()
  })

  it('exec() + write echo hello → receives stdout containing "hello"', async () => {
    const ptyProc = adapter.exec(containerId, { cols: 80, rows: 24, role: 'spawn', env: {} })

    const output = await new Promise<string>((resolve) => {
      let buf = ''
      ptyProc.onData((d) => {
        buf += d
        if (buf.includes('hello')) resolve(buf)
      })
      // Wait for shell init before writing
      setTimeout(() => { ptyProc.write('echo hello\n') }, 500)
      // Timeout fallback
      setTimeout(() => resolve(buf), 8000)
    })

    expect(output).toContain('hello')
    ptyProc.kill()
  })

  it('file write test: docker exec touch creates a file in the container', () => {
    // Use docker exec directly to write a file and verify
    // (simpler than PTY file write which needs shell interaction)
    const filename = `/tmp/test-write-${Date.now()}`
    execSync(`docker exec ${containerId} touch ${filename}`)
    // This verifies the container is accessible for exec operations
    const result = execSync(`docker exec ${containerId} ls ${filename}`).toString()
    expect(result.trim()).toBe(filename)
  })

  // -------------------------------------------------------------------------
  // S6.4 — Multi-agent shared container
  // -------------------------------------------------------------------------

  it('3 simultaneous PTY sessions in one container — all active, container keeps running', () => {
    const pty1 = adapter.exec(containerId, { cols: 80, rows: 24, role: 'lead', env: {} })
    const pty2 = adapter.exec(containerId, { cols: 80, rows: 24, role: 'spawn', env: {} })
    const pty3 = adapter.exec(containerId, { cols: 80, rows: 24, role: 'spawn', env: {} })

    expect(pty1).toBeDefined()
    expect(pty2).toBeDefined()
    expect(pty3).toBeDefined()

    // Container is still running while all 3 are active
    const running = execSync(
      `docker ps --filter name=${CONTAINER_NAME} --format "{{.Names}}"`
    ).toString()
    expect(running).toContain(CONTAINER_NAME)

    pty1.kill()
    pty2.kill()

    // Container still running with pty3 alive
    const stillRunning = execSync(
      `docker ps --filter name=${CONTAINER_NAME} --format "{{.Names}}"`
    ).toString()
    expect(stillRunning).toContain(CONTAINER_NAME)

    pty3.kill()
  })

  it('getClaudePidInContainer() returns null when no claude process is running', async () => {
    const pid = await adapter.getClaudePidInContainer(containerId)
    // claude is not running in our test container, so pid should be null
    expect(pid).toBeNull()
  })

  it('sendSignalInContainer() to a valid PID does not throw', async () => {
    // Ensure there is a stable long-running process in the container to signal
    // Use pgrep to find any running process (e.g. the entrypoint / init shell)
    let targetPid: string | undefined
    try {
      // pgrep with no args returns the first process; fallback to PID 1
      const pids = execSync(`docker exec ${containerId} ps -o pid= -p 1`).toString().trim()
      targetPid = pids.split('\n')[0]?.trim()
    } catch {
      targetPid = '1'
    }

    if (targetPid && !isNaN(Number(targetPid))) {
      await expect(
        adapter.sendSignalInContainer(containerId, Number(targetPid), 'SIGCONT')
      ).resolves.not.toThrow()
    }
  })
})
