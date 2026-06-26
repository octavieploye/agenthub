export class AudioRecorderService {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private samples: Float32Array[] = []
  private recording = false

  async startRecording(): Promise<void> {
    if (this.recording) return

    this.samples = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.stream)

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      if (!this.recording) return
      const input = event.inputBuffer.getChannelData(0)
      this.samples.push(new Float32Array(input))
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
    this.recording = true
  }

  async stopRecording(): Promise<ArrayBuffer> {
    this.recording = false

    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
    }
    if (this.audioContext) {
      await this.audioContext.close()
      this.audioContext = null
    }

    const totalLength = this.samples.reduce((sum, s) => sum + s.length, 0)
    const merged = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of this.samples) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    this.samples = []

    // Convert Float32 [-1,1] to Int16 PCM
    const pcm = new Int16Array(merged.length)
    for (let i = 0; i < merged.length; i++) {
      const s = Math.max(-1, Math.min(1, merged[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    return pcm.buffer
  }

  isRecording(): boolean {
    return this.recording
  }
}
