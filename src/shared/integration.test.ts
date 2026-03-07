import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { IPC_CHANNELS, IPC_EVENTS } from './constants/ipc-channels'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively extracts all string values from a nested object.
 * Used to flatten IPC_CHANNELS / IPC_EVENTS into a flat list of channel strings.
 */
function flattenChannels(obj: Record<string, unknown>): string[] {
  const result: string[] = []
  for (const value of Object.values(obj)) {
    if (typeof value === 'string') {
      result.push(value)
    } else if (typeof value === 'object' && value !== null) {
      result.push(...flattenChannels(value as Record<string, unknown>))
    }
  }
  return result
}

/**
 * Recursively builds constant-path references from a nested object.
 * E.g. for IPC_CHANNELS = { AGENTS: { SPAWN: 'agents:spawn' } }
 * produces [{ path: 'IPC_CHANNELS.AGENTS.SPAWN', value: 'agents:spawn' }]
 */
interface ChannelEntry {
  path: string
  value: string
}

function buildChannelPaths(
  obj: Record<string, unknown>,
  prefix: string
): ChannelEntry[] {
  const result: ChannelEntry[] = []
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = `${prefix}.${key}`
    if (typeof value === 'string') {
      result.push({ path: currentPath, value })
    } else if (typeof value === 'object' && value !== null) {
      result.push(
        ...buildChannelPaths(value as Record<string, unknown>, currentPath)
      )
    }
  }
  return result
}

/**
 * Extracts top-level namespace keys from the AgentHubBridge interface block.
 * Looks for lines like `  agents: {` or `  on: {` at the first indent level
 * inside the interface body.
 */
function extractBridgeNamespaces(typeSource: string): string[] {
  const interfaceMatch = typeSource.match(
    /export\s+interface\s+AgentHubBridge\s*\{([\s\S]*?)\n\}/
  )
  if (!interfaceMatch) return []
  const body = interfaceMatch[1]
  const namespaces: string[] = []
  const regex = /^\s{2}(\w+)\s*:\s*\{/gm
  let match: RegExpExecArray | null
  while ((match = regex.exec(body)) !== null) {
    namespaces.push(match[1])
  }
  return namespaces
}

// ---------------------------------------------------------------------------
// Resolve project file paths relative to this test file's location
// (src/shared/ -> one level up to reach src/)
// ---------------------------------------------------------------------------

const SRC_DIR = path.resolve(__dirname, '..')
const PRELOAD_FILE = path.join(SRC_DIR, 'preload', 'index.ts')
const IPC_TYPES_FILE = path.join(SRC_DIR, 'shared', 'types', 'ipc.types.ts')
const REGISTER_ALL_FILE = path.join(SRC_DIR, 'main', 'ipc', 'register-all.ts')
const IPC_HANDLERS_DIR = path.join(SRC_DIR, 'main', 'ipc')

// Read files once (these are structural integration tests — real filesystem reads)
const preloadSource = fs.readFileSync(PRELOAD_FILE, 'utf-8')
const ipcTypesSource = fs.readFileSync(IPC_TYPES_FILE, 'utf-8')
const registerAllSource = fs.readFileSync(REGISTER_ALL_FILE, 'utf-8')

// Collect all *.ipc.ts handler file contents
const ipcHandlerFiles = fs
  .readdirSync(IPC_HANDLERS_DIR)
  .filter((f) => f.endsWith('.ipc.ts'))

const ipcHandlerSources: Record<string, string> = {}
for (const file of ipcHandlerFiles) {
  ipcHandlerSources[file] = fs.readFileSync(
    path.join(IPC_HANDLERS_DIR, file),
    'utf-8'
  )
}
const allHandlerSource = Object.values(ipcHandlerSources).join('\n')

// Build structured channel/event entries with constant paths
const channelEntries = buildChannelPaths(
  IPC_CHANNELS as unknown as Record<string, unknown>,
  'IPC_CHANNELS'
)
const eventEntries = buildChannelPaths(
  IPC_EVENTS as unknown as Record<string, unknown>,
  'IPC_EVENTS'
)

// Flat string lists (still useful for exclusion lookups & sanity checks)
const allChannels = channelEntries.map((e) => e.value)
const allEvents = eventEntries.map((e) => e.value)

// ---------------------------------------------------------------------------
// Known exclusions — channels that are intentionally NOT wired in preload
// because they are internal-only (main-to-main) or handled differently.
// Document any such channels here with a reason.
// ---------------------------------------------------------------------------

/**
 * Channel constant paths intentionally excluded from the preload bridge.
 * Currently none — all channels are wired.
 */
const PRELOAD_EXCLUSIONS: string[] = []

/**
 * Channel constant paths intentionally excluded from IPC handler checks.
 * Currently none — all channels have handlers.
 */
const HANDLER_EXCLUSIONS: string[] = []

/**
 * Event constant paths intentionally excluded from preload wiring.
 * Currently none — all events are wired.
 */
const EVENT_PRELOAD_EXCLUSIONS: string[] = []

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IPC Layer Integration — Structural Consistency', () => {
  describe('IPC_CHANNELS -> Preload bridge', () => {
    const entriesToCheck = channelEntries.filter(
      (e) => !PRELOAD_EXCLUSIONS.includes(e.path)
    )

    it('should have a non-empty list of channels to verify', () => {
      expect(entriesToCheck.length).toBeGreaterThan(0)
    })

    it.each(entriesToCheck.map((e) => [e.path, e.value]))(
      'channel %s ("%s") must be referenced in preload/index.ts',
      (constPath) => {
        // The preload file references channels via constant paths like
        // IPC_CHANNELS.AGENTS.SPAWN, not raw strings like 'agents:spawn'.
        expect(preloadSource).toContain(constPath)
      }
    )

    it('documents known preload exclusions', () => {
      // Ensure exclusions still actually exist in the channel entries
      const allPaths = channelEntries.map((e) => e.path)
      for (const excluded of PRELOAD_EXCLUSIONS) {
        expect(allPaths).toContain(excluded)
      }
    })
  })

  describe('IPC_CHANNELS -> Handler registration', () => {
    const entriesToCheck = channelEntries.filter(
      (e) => !HANDLER_EXCLUSIONS.includes(e.path)
    )

    it('should have a non-empty list of channels to verify', () => {
      expect(entriesToCheck.length).toBeGreaterThan(0)
    })

    it.each(entriesToCheck.map((e) => [e.path, e.value]))(
      'channel %s ("%s") must be handled in at least one *.ipc.ts file',
      (constPath) => {
        // Handler files reference channels via IPC_CHANNELS.AGENTS.SPAWN etc.
        expect(allHandlerSource).toContain(constPath)
      }
    )

    it('documents known handler exclusions', () => {
      const allPaths = channelEntries.map((e) => e.path)
      for (const excluded of HANDLER_EXCLUSIONS) {
        expect(allPaths).toContain(excluded)
      }
    })
  })

  describe('AgentHubBridge type -> Preload implementation', () => {
    const bridgeNamespaces = extractBridgeNamespaces(ipcTypesSource)

    it('should extract at least one namespace from AgentHubBridge', () => {
      expect(bridgeNamespaces.length).toBeGreaterThan(0)
    })

    it.each(bridgeNamespaces)(
      'namespace "%s" from AgentHubBridge must exist in preload bridge object',
      (ns) => {
        // We expect the preload source to contain a property like `agents: {`
        const nsPattern = new RegExp(`\\b${ns}\\s*:\\s*\\{`)
        expect(preloadSource).toMatch(nsPattern)
      }
    )
  })

  describe('Preload bridge namespaces -> AgentHubBridge type', () => {
    // Extract namespace names from the preload agentHubBridge literal.
    // The preload object spans from `const agentHubBridge = {` to the
    // matching closing brace. We match everything up to `\n}` (the
    // first top-level closing brace at indent 0).
    const preloadBridgeMatch = preloadSource.match(
      /const\s+agentHubBridge\s*=\s*\{([\s\S]*?)\n\}/
    )

    it('should be able to parse the agentHubBridge object', () => {
      expect(preloadBridgeMatch).not.toBeNull()
    })

    /**
     * Preload namespaces excluded from the AgentHubBridge type check.
     * Currently none — all namespaces are typed.
     */
    const TYPE_GAP_EXCLUSIONS: string[] = []

    it('every preload namespace should exist in the AgentHubBridge type', () => {
      if (!preloadBridgeMatch) return
      const body = preloadBridgeMatch[1]
      const nsRegex = /^\s{2}(\w+)\s*:\s*\{/gm
      const preloadNamespaces: string[] = []
      let match: RegExpExecArray | null
      while ((match = nsRegex.exec(body)) !== null) {
        preloadNamespaces.push(match[1])
      }

      const bridgeNamespaces = extractBridgeNamespaces(ipcTypesSource)
      const namespacesToCheck = preloadNamespaces.filter(
        (ns) => !TYPE_GAP_EXCLUSIONS.includes(ns)
      )
      for (const ns of namespacesToCheck) {
        expect(
          bridgeNamespaces,
          `Preload namespace "${ns}" is not declared in AgentHubBridge type`
        ).toContain(ns)
      }
    })

    it('documents known type-gap exclusions (preload vs type)', () => {
      // Verify each exclusion still actually exists in the preload source
      // so stale exclusions get caught when the gap is fixed.
      for (const ns of TYPE_GAP_EXCLUSIONS) {
        const nsPattern = new RegExp(`\\b${ns}\\s*:\\s*\\{`)
        expect(
          preloadSource,
          `Type-gap exclusion "${ns}" no longer exists in preload — remove it from TYPE_GAP_EXCLUSIONS`
        ).toMatch(nsPattern)
      }
    })
  })

  describe('No orphaned IPC handler files', () => {
    it.each(ipcHandlerFiles)(
      'handler file "%s" must be imported in register-all.ts',
      (file) => {
        // register-all.ts uses imports like: import { ... } from './xxx.ipc'
        // Strip .ts extension for the import path check
        const importPath = `./${file.replace(/\.ts$/, '')}`
        expect(registerAllSource).toContain(importPath)
      }
    )

    it('register-all.ts should not import non-existent handler files', () => {
      // Extract all import paths from register-all.ts that look like './xxx.ipc'
      const importRegex = /from\s+['"]\.\/([\w-]+\.ipc)['"]/g
      let match: RegExpExecArray | null
      const importedFiles: string[] = []
      while ((match = importRegex.exec(registerAllSource)) !== null) {
        importedFiles.push(`${match[1]}.ts`)
      }
      for (const imported of importedFiles) {
        expect(
          ipcHandlerFiles,
          `register-all.ts imports "${imported}" but file does not exist`
        ).toContain(imported)
      }
    })
  })

  describe('IPC_EVENTS -> Preload bridge', () => {
    const eventsToCheck = eventEntries.filter(
      (e) => !EVENT_PRELOAD_EXCLUSIONS.includes(e.path)
    )

    it('should have a non-empty list of events to verify', () => {
      expect(eventsToCheck.length).toBeGreaterThan(0)
    })

    it.each(eventsToCheck.map((e) => [e.path, e.value]))(
      'event %s ("%s") must be referenced in preload/index.ts',
      (constPath) => {
        // The preload file references events via constant paths like
        // IPC_EVENTS.AGENTS.STATUS_CHANGE, not raw strings.
        expect(preloadSource).toContain(constPath)
      }
    )

    it('documents known event preload exclusions', () => {
      const allPaths = eventEntries.map((e) => e.path)
      for (const excluded of EVENT_PRELOAD_EXCLUSIONS) {
        expect(allPaths).toContain(excluded)
      }
    })
  })

  describe('flattenChannels helper', () => {
    it('extracts strings from a flat object', () => {
      expect(flattenChannels({ A: 'x', B: 'y' })).toEqual(['x', 'y'])
    })

    it('extracts strings from nested objects', () => {
      const result = flattenChannels({
        GROUP: { A: 'a:one', B: 'a:two' },
        OTHER: { C: 'b:three' }
      })
      expect(result).toEqual(['a:one', 'a:two', 'b:three'])
    })

    it('handles deeply nested objects', () => {
      const result = flattenChannels({
        L1: { L2: { L3: 'deep:value' } }
      })
      expect(result).toEqual(['deep:value'])
    })

    it('returns empty array for empty object', () => {
      expect(flattenChannels({})).toEqual([])
    })
  })

  describe('buildChannelPaths helper', () => {
    it('builds paths for a flat object', () => {
      const result = buildChannelPaths({ A: 'val-a' }, 'ROOT')
      expect(result).toEqual([{ path: 'ROOT.A', value: 'val-a' }])
    })

    it('builds paths for nested objects', () => {
      const result = buildChannelPaths(
        { GROUP: { X: 'g:x', Y: 'g:y' } },
        'IPC'
      )
      expect(result).toEqual([
        { path: 'IPC.GROUP.X', value: 'g:x' },
        { path: 'IPC.GROUP.Y', value: 'g:y' }
      ])
    })
  })

  describe('Consistency sanity checks', () => {
    it('IPC_CHANNELS has more than 10 channels (sanity)', () => {
      expect(allChannels.length).toBeGreaterThan(10)
    })

    it('IPC_EVENTS has at least 1 event (sanity)', () => {
      expect(allEvents.length).toBeGreaterThan(0)
    })

    it('there are handler files for each IPC_CHANNELS namespace', () => {
      const namespaceKeys = Object.keys(IPC_CHANNELS).map((k) =>
        k.toLowerCase()
      )
      const handlerBaseNames = ipcHandlerFiles.map((f) =>
        f.replace('.ipc.ts', '')
      )

      // Loose check — exact 1:1 mapping is not required
      // (e.g., 'system' handles both SYSTEM and DIALOG).
      expect(handlerBaseNames.length).toBeGreaterThanOrEqual(
        namespaceKeys.length - 2
      )
    })
  })
})
