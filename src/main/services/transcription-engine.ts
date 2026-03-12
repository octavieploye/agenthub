import { spawn, type ChildProcess } from 'child_process'
import { writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

export interface TranscriptionEngine {
  transcribe(audioBuffer: ArrayBuffer): Promise<string>
  isAvailable(): boolean
  dispose(): void
}

export class WhisperEngine implements TranscriptionEngine {
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private activeProc: ChildProcess | null = null
  private readonly binaryPath: string
  private readonly modelPath: string
  private static readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000

  constructor(binaryPath: string, modelPath: string) {
    this.binaryPath = binaryPath
    this.modelPath = modelPath
  }

  isAvailable(): boolean {
    return existsSync(this.binaryPath) && existsSync(this.modelPath)
  }

  getMissingReason(): 'binary-missing' | 'model-missing' | null {
    if (!existsSync(this.binaryPath)) return 'binary-missing'
    if (!existsSync(this.modelPath)) return 'model-missing'
    return null
  }

  async transcribe(audioBuffer: ArrayBuffer): Promise<string> {
    this.resetIdleTimer()

    const tempPath = join(tmpdir(), `agenthub-voice-${Date.now()}.wav`)
    try {
      const wavBuffer = this.pcmToWav(audioBuffer)
      await writeFile(tempPath, wavBuffer)
      const transcript = await this.runWhisper(tempPath)
      return transcript.trim()
    } finally {
      await unlink(tempPath).catch(() => {})
    }
  }

  private runWhisper(wavPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.binaryPath, [
        '-m', this.modelPath,
        '-f', wavPath,
        '--no-timestamps',
        '-otxt',
        '-of', '-'
      ])
      this.activeProc = proc

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
      proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

      proc.on('error', (err) => {
        this.activeProc = null
        reject(err)
      })

      proc.on('close', (code) => {
        this.activeProc = null
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`whisper-cli exited ${code}: ${stderr}`))
        }
      })
    })
  }

  private pcmToWav(pcmBuffer: ArrayBuffer): Buffer {
    const pcm = Buffer.from(pcmBuffer)
    const sampleRate = 16000
    const numChannels = 1
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = pcm.length
    const header = Buffer.alloc(44)

    header.write('RIFF', 0)
    header.writeUInt32LE(36 + dataSize, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(numChannels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(bitsPerSample, 34)
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return Buffer.concat([header, pcm])
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = setTimeout(() => this.dispose(), WhisperEngine.IDLE_TIMEOUT_MS)
  }

  dispose(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
    if (this.activeProc) {
      this.activeProc.kill()
      this.activeProc = null
    }
  }
}
