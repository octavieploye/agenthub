/**
 * OrchestratorBrain — stateless LLM decision engine.
 *
 * Called by the orchestrator-scheduler on each tick.
 * Selects the single highest-priority unblocked task to execute next.
 * All failures return null — never throws.
 */
import log from 'electron-log/main'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrainTask {
  id: string
  description: string
  category: string
  priority: number
  repo: string
  skill: string | null
  blockedBy: string[]
}

export interface BrainContext {
  readyTasks: BrainTask[]
  activeAgentCount: number
  recentOutcomes: Array<{
    taskId: string
    status: 'completed' | 'failed'
    skill: string | null
    model: string | null
  }>
}

export interface BrainDecision {
  taskId: string
  reason: string
}

export type BrainProvider = 'ollama-local' | 'ollama-cloud' | 'codex'

export interface BrainConfig {
  provider: BrainProvider
  /** e.g. 'qwen3:8b', 'qwen3:14b-cloud', 'o4-mini' */
  model: string
  /** e.g. 'http://localhost:11434/api/chat' */
  endpoint: string
  /** Milliseconds before aborting the fetch. Default: 30_000 */
  timeoutMs?: number
  /** Required for codex / cloud endpoints */
  apiKey?: string
}

// ---------------------------------------------------------------------------
// Internal types — raw LLM response shapes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOG_PREFIX = '[orchestrator-brain]'
const DEFAULT_TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = `You are a task dispatcher for an AI coding agent system. Given the list of ready tasks and current system state, select the single highest-priority unblocked task to execute next.

Return ONLY valid JSON in this exact format:
{"taskId": "<id>", "reason": "<brief reason>"}

Rules:
- taskId must be one of the provided ready task IDs
- Do NOT select a model or skill — both are defined in task metadata
- reason should be 1 sentence`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractContent(raw: unknown): string | null {
  if (raw === null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  // Ollama: { message: { content: "..." } }
  if (obj['message'] && typeof obj['message'] === 'object') {
    const msg = obj['message'] as Record<string, unknown>
    if (typeof msg['content'] === 'string') return msg['content']
  }

  // Ollama (generate endpoint): { response: "..." }
  if (typeof obj['response'] === 'string') return obj['response']

  // OpenAI-compatible: { choices: [{ message: { content: "..." } }] }
  if (Array.isArray(obj['choices']) && obj['choices'].length > 0) {
    const choice = obj['choices'][0] as Record<string, unknown>
    if (choice['message'] && typeof choice['message'] === 'object') {
      const msg = choice['message'] as Record<string, unknown>
      if (typeof msg['content'] === 'string') return msg['content']
    }
  }

  return null
}

function buildPayload(model: string, userContent: string): string {
  return JSON.stringify({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ],
    stream: false,
    format: 'json'
  })
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return headers
}

function buildUserContent(context: BrainContext): string {
  return JSON.stringify(context, null, 2)
}

// ---------------------------------------------------------------------------
// OrchestratorBrain
// ---------------------------------------------------------------------------

export class OrchestratorBrain {
  private readonly timeoutMs: number

  constructor(private readonly config: BrainConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async decide(context: BrainContext): Promise<BrainDecision | null> {
    if (context.readyTasks.length === 0) {
      return null
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let rawJson: unknown
    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: buildHeaders(this.config.apiKey),
        body: buildPayload(this.config.model, buildUserContent(context)),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!response.ok) {
        log.warn(LOG_PREFIX, `HTTP error ${response.status} from provider ${this.config.provider}`)
        return this.deterministicFallback(context)
      }

      rawJson = await response.json()
    } catch (err: unknown) {
      clearTimeout(timer)

      if (controller.signal.aborted) {
        log.warn(LOG_PREFIX, `LLM timeout after ${this.timeoutMs}ms on provider ${this.config.provider}`)
      } else {
        log.warn(LOG_PREFIX, `fetch error from provider ${this.config.provider}:`, err instanceof Error ? err.message : String(err))
      }
      return this.deterministicFallback(context)
    }

    const content = extractContent(rawJson)
    if (content === null) {
      log.warn(LOG_PREFIX, `invalid JSON: could not extract content from LLM response`, rawJson)
      return this.deterministicFallback(context)
    }

    // Strip markdown fences (```json ... ```) that many LLMs wrap around JSON
    const cleaned = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      log.warn(LOG_PREFIX, `invalid JSON from LLM (raw truncated): ${content.slice(0, 200)}`)
      return this.deterministicFallback(context)
    }

    if (parsed === null || typeof parsed !== 'object') {
      log.warn(LOG_PREFIX, `invalid JSON from LLM: parsed value is not an object`)
      return this.deterministicFallback(context)
    }

    const obj = parsed as Record<string, unknown>
    const taskId = typeof obj['taskId'] === 'string' ? obj['taskId'] : null

    if (!taskId) {
      log.warn(LOG_PREFIX, `invalid JSON from LLM: missing taskId field`)
      return this.deterministicFallback(context)
    }

    const readyIds = new Set(context.readyTasks.map(t => t.id))
    if (!readyIds.has(taskId)) {
      log.warn(LOG_PREFIX, `LLM picked unknown taskId: ${taskId} (not in ready list)`)
      return this.deterministicFallback(context)
    }

    const reason = typeof obj['reason'] === 'string' ? obj['reason'] : ''

    return { taskId, reason }
  }

  private deterministicFallback(context: BrainContext): BrainDecision {
    const task = context.readyTasks.reduce((best, t) =>
      t.priority < best.priority ? t : best
    )
    log.info(LOG_PREFIX, `deterministic fallback: selecting task ${task.id} (priority ${task.priority})`)
    return {
      taskId: task.id,
      reason: 'deterministic fallback — LLM unavailable'
    }
  }
}
