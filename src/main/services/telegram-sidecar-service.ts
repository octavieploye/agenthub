import { spawn, type ChildProcess } from 'child_process'
import { safeStorage } from 'electron'
import { createInterface } from 'readline'
import type Database from 'better-sqlite3'
import type {
  TelegramNotificationPayload,
  TelegramAgentEntry,
  TelegramRepoEntry,
  TelegramFromSidecarMsg,
  TelegramStatus,
} from '../../shared/types/telegram.types'
import {
  getTelegramAllowedUser,
  insertTelegramAllowedUser,
  clearTelegramAllowlist,
  getTelegramPrefs,
} from '../db/queries/telegram.queries'

export interface TelegramSidecarDeps {
  scriptPath: string
  nodePath: string
  db: Database.Database
  logInfo: (msg: string, meta?: Record<string, unknown>) => void
  logError: (msg: string, meta?: Record<string, unknown>) => void
  onBlockedSender: (telegramUserId: number) => void
  onFirstContact: (telegramUserId: number, chatId: number) => void
  onCommand: (msg: TelegramFromSidecarMsg) => void
  onReady?: () => void
}

export class TelegramSidecarService {
  private proc: ChildProcess | null = null
  private encryptedToken: Buffer | null = null
  private readonly deps: TelegramSidecarDeps

  constructor(deps: TelegramSidecarDeps) {
    this.deps = deps
  }

  isRunning(): boolean {
    return this.proc !== null && !this.proc.killed
  }

  async saveToken(token: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this system')
    }
    this.encryptedToken = safeStorage.encryptString(token)
    // Persist to DB so it survives app restarts
    this.deps.db.prepare(
      'UPDATE telegram_allowlist SET encrypted_token = ? WHERE id = (SELECT id FROM telegram_allowlist LIMIT 1)'
    ).run(this.encryptedToken.toString('base64'))
  }

  private loadTokenFromDb(): boolean {
    const row = this.deps.db.prepare(
      'SELECT encrypted_token FROM telegram_allowlist LIMIT 1'
    ).get() as { encrypted_token: string | null } | undefined
    if (!row?.encrypted_token) return false
    try {
      this.encryptedToken = Buffer.from(row.encrypted_token, 'base64')
      // Verify it can be decrypted (keychain still valid)
      safeStorage.decryptString(this.encryptedToken)
      return true
    } catch {
      this.encryptedToken = null
      return false
    }
  }

  private getDecryptedToken(): string | null {
    if (!this.encryptedToken) return null
    try {
      return safeStorage.decryptString(this.encryptedToken)
    } catch {
      return null
    }
  }

  async start(token?: string): Promise<void> {
    if (this.isRunning()) return
    if (token) await this.saveToken(token)
    if (!this.encryptedToken) this.loadTokenFromDb()
    const decrypted = this.getDecryptedToken()
    if (!decrypted) throw new Error('No bot token stored')

    this.proc = spawn(this.deps.nodePath, [this.deps.scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    this.send({ type: 'config', botToken: decrypted })

    const rl = createInterface({ input: this.proc.stdout!, crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (!line.trim()) return
      try {
        const msg = JSON.parse(line) as TelegramFromSidecarMsg
        this.handleFromSidecar(msg)
      } catch {
        this.deps.logError('telegram sidecar: bad stdout line', { line })
      }
    })

    this.proc.stderr?.on('data', (data: Buffer) => {
      this.deps.logInfo('telegram sidecar stderr', { msg: data.toString().trim() })
    })

    this.proc.on('exit', (code) => {
      this.deps.logInfo('telegram sidecar exited', { code })
      this.proc = null
    })

    this.proc.on('error', (err) => {
      this.deps.logError('telegram sidecar error', { err: String(err) })
      this.proc = null
    })
  }

  stop(): void {
    if (!this.proc) return
    this.send({ type: 'shutdown' })
    setTimeout(() => {
      if (this.proc && !this.proc.killed) this.proc.kill('SIGTERM')
    }, 1000)
  }

  notify(payload: TelegramNotificationPayload): void {
    this.deps.logInfo('[Telegram Debug] sidecar notify payload', {
      type: payload.type,
      agentId: payload.agentId,
      agentName: payload.agentName,
      repo: payload.repo,
      summaryLen: payload.summary?.length ?? 0,
      summaryFirst500: (payload.summary ?? '').slice(0, 500),
      hasQuestion: Boolean(payload.question),
      questionFirst200: (payload.question ?? '').slice(0, 200),
      hasProposedAction: Boolean(payload.proposedAction),
    })
    this.send({ type: 'notify', payload })
  }

  sendAgentList(agents: TelegramAgentEntry[]): void {
    this.send({ type: 'agent_list', agents })
  }

  sendRepoList(repos: TelegramRepoEntry[]): void {
    this.send({ type: 'repo_list', repos })
  }

  sendUser(telegramUserId: number, chatId: number): void {
    this.send({ type: 'set_user', telegramUserId, chatId })
  }

  async disconnect(): Promise<void> {
    this.stop()
    this.encryptedToken = null
    clearTelegramAllowlist(this.deps.db) // also deletes the persisted encrypted_token
  }

  getStatus(): TelegramStatus {
    const user = getTelegramAllowedUser(this.deps.db)
    if (!user) return { connected: false }
    if (!this.encryptedToken) this.loadTokenFromDb()
    if (!this.encryptedToken) return { connected: false }
    const maskedUserId = '···' + String(user.telegram_user_id).slice(-4)
    const prefs = getTelegramPrefs(this.deps.db)
    return { connected: true, maskedUserId, prefs }
  }

  private send(msg: object): void {
    if (!this.proc?.stdin) {
      throw new Error('Telegram sidecar not running')
    }
    this.proc.stdin.write(JSON.stringify(msg) + '\n')
  }

  private handleFromSidecar(msg: TelegramFromSidecarMsg): void {
    switch (msg.type) {
      case 'ready':
        this.deps.logInfo('telegram sidecar ready')
        this.deps.onReady?.()
        break
      case 'blocked_sender':
        this.deps.onBlockedSender(msg.telegramUserId)
        break
      case 'first_contact':
        insertTelegramAllowedUser(this.deps.db, msg.telegramUserId, msg.chatId)
        // Persist the encrypted token now that the allowlist row exists
        if (this.encryptedToken) {
          this.deps.db.prepare(
            'UPDATE telegram_allowlist SET encrypted_token = ? WHERE telegram_user_id = ?'
          ).run(this.encryptedToken.toString('base64'), msg.telegramUserId)
        }
        this.deps.onFirstContact(msg.telegramUserId, msg.chatId)
        break
      case 'command':
      case 'error':
        this.deps.onCommand(msg)
        break
    }
  }
}
