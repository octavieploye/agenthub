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
    this.send({ type: 'notify', payload })
  }

  sendAgentList(agents: TelegramAgentEntry[]): void {
    this.send({ type: 'agent_list', agents })
  }

  sendRepoList(repos: TelegramRepoEntry[]): void {
    this.send({ type: 'repo_list', repos })
  }

  async disconnect(): Promise<void> {
    this.stop()
    this.encryptedToken = null
    clearTelegramAllowlist(this.deps.db)
  }

  getStatus(): TelegramStatus {
    const user = getTelegramAllowedUser(this.deps.db)
    if (!user || !this.encryptedToken) return { connected: false }
    const maskedUserId = '···' + String(user.telegram_user_id).slice(-4)
    const prefs = getTelegramPrefs(this.deps.db)
    return { connected: true, maskedUserId, prefs }
  }

  private send(msg: object): void {
    if (!this.proc?.stdin) return
    this.proc.stdin.write(JSON.stringify(msg) + '\n')
  }

  private handleFromSidecar(msg: TelegramFromSidecarMsg): void {
    switch (msg.type) {
      case 'ready':
        this.deps.logInfo('telegram sidecar ready')
        break
      case 'blocked_sender':
        this.deps.onBlockedSender(msg.telegramUserId)
        break
      case 'first_contact':
        insertTelegramAllowedUser(this.deps.db, msg.telegramUserId, msg.chatId)
        this.deps.onFirstContact(msg.telegramUserId, msg.chatId)
        break
      case 'command':
      case 'error':
        this.deps.onCommand(msg)
        break
    }
  }
}
