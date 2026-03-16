import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Agent Docker routing logic
//
// This file tests the routing condition extracted from agent-manager.ts:
//
//   if (options.skipPermissions && dockerEnabled && dockerSvc && containerMgr) {
//     const dockerStatus = await dockerSvc.getStatus()
//     if (dockerStatus.available && dockerStatus.imageReady) {
//       // → docker path
//     } else {
//       // → native fallback
//     }
//   } else {
//     // → native path
//   }
//
// We do NOT test the full spawnAgent() lifecycle (which requires node-pty,
// electron, DB, and many other services). Instead we extract the routing
// condition as a pure function and verify each branch.
// ---------------------------------------------------------------------------

function shouldUseDocker(opts: {
  skipPermissions: boolean
  dockerEnabled: boolean
  dockerAvailable: boolean
  imageReady: boolean
  provider?: string
}): boolean {
  const isOllama = opts.provider === 'ollama-local' || opts.provider === 'ollama-cloud'
  return opts.skipPermissions && !isOllama && opts.dockerEnabled && opts.dockerAvailable && opts.imageReady
}

describe('Docker routing logic', () => {
  it('routes to native when skipPermissions is false', () => {
    expect(
      shouldUseDocker({
        skipPermissions: false,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true
      })
    ).toBe(false)
  })

  it('routes to native when docker.enabled is false in settings', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: false,
        dockerAvailable: true,
        imageReady: true
      })
    ).toBe(false)
  })

  it('routes to native when Docker daemon is unavailable', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: false,
        imageReady: true
      })
    ).toBe(false)
  })

  it('routes to native when Docker image is not built', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: false
      })
    ).toBe(false)
  })

  it('routes to Docker when all conditions are met', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true
      })
    ).toBe(true)
  })

  it('routes to native when both docker unavailable and image not built', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: false,
        imageReady: false
      })
    ).toBe(false)
  })

  it('routes to native when skipPermissions false overrides all other true conditions', () => {
    // Even if everything else says Docker, no skipPermissions = native
    expect(
      shouldUseDocker({
        skipPermissions: false,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true
      })
    ).toBe(false)
  })

  it('routes to native when all conditions are false', () => {
    expect(
      shouldUseDocker({
        skipPermissions: false,
        dockerEnabled: false,
        dockerAvailable: false,
        imageReady: false
      })
    ).toBe(false)
  })

  it('routes ollama-local to native even when skipPermissions and Docker are fully ready', () => {
    // ollama-local connects to localhost:11434 on the host — unreachable from inside a Docker
    // container on macOS (Docker Desktop doesn't bridge host networking to host localhost)
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true,
        provider: 'ollama-local'
      })
    ).toBe(false)
  })

  it('routes ollama-cloud to native even when skipPermissions and Docker are fully ready', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true,
        provider: 'ollama-cloud'
      })
    ).toBe(false)
  })

  it('routes non-ollama provider (anthropic) to Docker when all conditions are met', () => {
    expect(
      shouldUseDocker({
        skipPermissions: true,
        dockerEnabled: true,
        dockerAvailable: true,
        imageReady: true,
        provider: 'anthropic'
      })
    ).toBe(true)
  })
})
