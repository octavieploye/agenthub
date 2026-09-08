// service-registry.ts
// Thin registry that breaks the circular import between agent-manager and service-orchestrator.
// service-orchestrator registers values here at init time.
// agent-manager reads from here instead of importing service-orchestrator directly.

import type { WindowManager } from './window-manager'
import type { IAnamnesisAdapter } from './adapters/anamnesis-adapter'

let windowManager: WindowManager | null = null
let anamnesisWriter: IAnamnesisAdapter | null = null
let telegramSocketPathFn: (() => string | null) | null = null
let currentSessionId: string | null = null

// Called by service-orchestrator at init time
export function registerWindowManager(wm: WindowManager): void {
  windowManager = wm
}

export function registerAnamnesisWriter(aw: IAnamnesisAdapter): void {
  anamnesisWriter = aw
}

export function registerTelegramSocketPathFn(fn: () => string | null): void {
  telegramSocketPathFn = fn
}

export function registerCurrentSessionId(id: string | null): void {
  currentSessionId = id
}

// Used by agent-manager (previously imported from service-orchestrator)
export function getWindowManager(): WindowManager | null {
  return windowManager
}

export function getAnamnesisWriter(): IAnamnesisAdapter | null {
  return anamnesisWriter
}

export function getTelegramSocketPath(): string | null {
  return telegramSocketPathFn ? telegramSocketPathFn() : null
}

export function getCurrentSessionId(): string | null {
  return currentSessionId
}
