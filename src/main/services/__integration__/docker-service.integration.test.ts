import { describe, it, expect, vi, afterAll } from 'vitest'
import path from 'path'

vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: vi.fn(() => []) } }))
vi.mock('electron-log/main', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { DockerService } from '../docker-service'
import { DOCKER_IMAGE_TAG } from '@shared/types/docker.types'

const SKIP = process.env.DOCKER_INTEGRATION !== 'true'

const deps = { logInfo: vi.fn(), logWarning: vi.fn() }

describe.skipIf(SKIP)('DockerService — real Docker', () => {
  let svc: DockerService

  // Fresh instance for each test so cache never bleeds across
  function makeSvc(): DockerService {
    return new DockerService({ logInfo: vi.fn(), logWarning: vi.fn() })
  }

  afterAll(() => {
    // Do NOT remove the image — other integration tests need it and it is expensive to rebuild
  })

  it('isAvailable() returns true (Docker is running)', async () => {
    svc = makeSvc()
    const result = await svc.isAvailable()
    expect(result).toBe(true)
  })

  it('getVersion() returns a non-empty string', async () => {
    svc = makeSvc()
    const version = await svc.getVersion()
    expect(typeof version).toBe('string')
    expect((version as string).length).toBeGreaterThan(0)
  })

  it('getStatus() returns correct shape with available=true', async () => {
    svc = makeSvc()
    const status = await svc.getStatus()
    expect(status).toMatchObject({
      available: true,
      imageTag: DOCKER_IMAGE_TAG
    })
    expect(typeof status.imageReady).toBe('boolean')
    expect(typeof status.activeContainerCount).toBe('number')
  })

  it('invalidateCache() clears cache — two sequential getStatus() calls with invalidate in between both succeed', async () => {
    svc = makeSvc()
    const first = await svc.getStatus()
    expect(first.available).toBe(true)

    svc.invalidateCache()

    const second = await svc.getStatus()
    expect(second.available).toBe(true)
  })

  it(
    'ensureImage() builds image if needed, then isImageBuilt() returns true',
    async () => {
      // This test may take 2-5 minutes on first run (building image)
      svc = makeSvc()
      const dockerfilePath = path.resolve(process.cwd(), 'docker/agent')
      await svc.ensureImage(dockerfilePath)
      const built = await svc.isImageBuilt()
      expect(built).toBe(true)
    }
  )
})
