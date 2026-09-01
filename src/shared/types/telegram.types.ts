/**
 * Telegram Sidecar Integration Types
 *
 * Sovereignty firewall: TelegramNotificationPayload enforces strict limits on
 * dynamic content to prevent injection attacks and ensure safe relay.
 * - summary: max 200 chars (plain English only)
 * - proposedAction/question: max 300 chars (awaiting_approval/needs_input only)
 */

export interface TelegramNotificationPayload {
  type: 'completed' | 'failed' | 'awaiting_approval' | 'needs_input' | 'agent_message' | 'silent_lock'
  agentId: string
  agentName: string
  repo: string
  summary: string        // max 200 chars — plain English only
  proposedAction?: string // awaiting_approval only — max 300 chars
  question?: string       // needs_input only — max 300 chars
  message?: string        // agent_message only — the composed message (max 4000 chars)
  format?: 'status' | 'question' | 'error'  // agent_message only
  requestId?: string      // for approval correlation (use agentId in Phase 1)
  timestamp: string       // ISO 8601
}

export interface TelegramAgentEntry {
  id: string
  name: string
  status: string
  repo: string
}

export interface TelegramRepoEntry {
  name: string
  path: string
}

export interface TelegramNotificationPrefs {
  notify_completed: boolean
  notify_failed: boolean
  notify_awaiting_approval: boolean
  notify_needs_input: boolean
}

export type TelegramSocketState = 'stopped' | 'starting' | 'listening' | 'error'

export interface TelegramSocketStatus {
  socketPath: string | null
  state: TelegramSocketState
  errorCode: string | null
}

export interface TelegramStatus {
  connected: boolean
  botUsername?: string
  maskedUserId?: string   // e.g. "···7842"
  prefs?: TelegramNotificationPrefs
  socket?: TelegramSocketStatus
}

// JSON-RPC: AgentHub main → sidecar (via stdin)
export type TelegramToSidecarMsg =
  | { type: 'config'; botToken: string }
  | { type: 'set_user'; telegramUserId: number; chatId: number }
  | { type: 'notify'; payload: TelegramNotificationPayload }
  | { type: 'approval_result'; requestId: string; decision: 'approved' | 'denied' }
  | { type: 'agent_list'; agents: TelegramAgentEntry[] }
  | { type: 'repo_list'; repos: TelegramRepoEntry[] }
  | { type: 'shutdown' }

// JSON-RPC: sidecar → AgentHub main (via stdout)
export type TelegramFromSidecarMsg =
  | { type: 'ready' }
  | { type: 'first_contact'; telegramUserId: number; chatId: number }
  | { type: 'command'; command: 'send_task'; agentId: string; message: string }
  | { type: 'command'; command: 'spawn_agent'; repo: string; task: string; name: string }
  | { type: 'command'; command: 'approve'; requestId: string }
  | { type: 'command'; command: 'deny'; requestId: string }
  | { type: 'command'; command: 'pause'; agentId: string }
  | { type: 'command'; command: 'resume'; agentId: string }
  | { type: 'command'; command: 'stop'; agentId: string }
  | { type: 'command'; command: 'respawn'; agentId: string }
  | { type: 'command'; command: 'get_status' }
  | { type: 'command'; command: 'get_repos' }
  | { type: 'blocked_sender'; telegramUserId: number }
  | { type: 'error'; message: string }
