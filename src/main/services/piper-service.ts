import { spawn } from 'child_process'
import { readdirSync, existsSync, readFileSync, realpathSync } from 'fs'
import path from 'path'

export interface InstalledVoice {
  id: string
  lang: string
  name: string
  quality: string
}

export interface PiperServiceDeps {
  binaryPath: string
  voicesDir: string
  logInfo: (message: string, meta?: Record<string, unknown>) => void
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
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

export class PiperService {
  private readonly deps: PiperServiceDeps

  constructor(deps: PiperServiceDeps) {
    this.deps = deps
  }

  listVoices(): InstalledVoice[] {
    if (!existsSync(this.deps.voicesDir)) return []
    const files = readdirSync(this.deps.voicesDir)
    return files
      .filter((f) => f.endsWith('.onnx.json'))
      .map((f) => {
        const id = f.replace('.onnx.json', '')
        const parts = id.split('-')
        const lang = parts[0] ?? id
        const name = parts[1] ?? id
        const quality = parts[2] ?? 'medium'
        return { id, lang, name, quality }
      })
  }

  speak(text: string, voiceId: string, rate: number): Promise<Buffer> {
    if (!text.trim()) return Promise.resolve(Buffer.alloc(0))
    return new Promise((resolve, reject) => {
      // Security: strip path separators and use basename to prevent path traversal
      const safeVoiceId = path.basename(voiceId.replace(/[/\\]/g, ''))
      const modelPath = path.join(this.deps.voicesDir, `${safeVoiceId}.onnx`)
      // Verify resolved path is within voicesDir
      if (!modelPath.startsWith(this.deps.voicesDir)) {
        reject(new Error(`Invalid voice ID: path traversal detected`))
        return
      }
      if (!existsSync(modelPath)) {
        reject(new Error(`Voice model not found: ${modelPath}`))
        return
      }

      const sampleRate = this.getSampleRate(safeVoiceId)
      const lengthScale = String(Math.max(0.25, Math.min(4.0, 1.0 / rate)))
      const espeakData = this.resolveEspeakData()

      const args = [
        '--model', modelPath,
        '--output_raw',
        '--length_scale', lengthScale,
        '--sentence_silence', '0.2',
      ]
      if (espeakData) args.push('--espeak_data', espeakData)

      const proc = spawn(this.deps.binaryPath, args)

      const chunks: Buffer[] = []
      proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))

      proc.stderr.on('data', (data: Buffer) => {
        this.deps.logInfo('piper stderr', { msg: data.toString().trim() })
      })

      proc.on('error', (err) => reject(err))

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`piper exited with code ${code}`))
          return
        }
        const pcm = Buffer.concat(chunks)
        resolve(pcmToWav(pcm, sampleRate))
      })

      proc.stdin.write(text)
      proc.stdin.end()
    })
  }

  private resolveEspeakData(): string | null {
    try {
      const realBin = realpathSync(this.deps.binaryPath)
      const candidate = path.join(path.dirname(realBin), 'espeak-ng-data')
      return existsSync(candidate) ? candidate : null
    } catch {
      return null
    }
  }

  private getSampleRate(voiceId: string): number {
    try {
      const jsonPath = path.join(this.deps.voicesDir, `${voiceId}.onnx.json`)
      const meta = JSON.parse(readFileSync(jsonPath, 'utf-8'))
      return meta?.audio?.sample_rate ?? 22050
    } catch {
      return 22050
    }
  }
}
