export class AudioRecorderService {
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private samples: Float32Array[] = []
  private recording = false
  private cancelled = false

  async startRecording(): Promise<void> {
    if (this.recording) return

    this.cancelled = false
    this.samples = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    })

    // stopRecording() may have been called while getUserMedia was pending —
    // release the just-acquired stream rather than leaking an open mic.
    if (this.cancelled) {
      this.stream.getTracks().forEach((t) => t.stop())
      this.stream = null
      return
    }

    this.audioContext = new AudioContext({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.stream)

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (event) => {
      if (!this.recording) return
      const input = event.inputBuffer.getChannelData(0)
      this.samples.push(new Float32Array(input))
    }

    // Route through a silent gain node so the processor fires onaudioprocess
    // without playing mic audio back to speakers — preventing AEC from
    // treating the user's voice as echo and cancelling it (sandbox: true issue).
    const silentGain = this.audioContext.createGain()
    silentGain.gain.value = 0
    this.source.connect(this.processor)
    this.processor.connect(silentGain)
    silentGain.connect(this.audioContext.destination)
    this.recording = true
  }

  async stopRecording(): Promise<ArrayBuffer> {
    this.cancelled = true
    this.recording = false

    // Capture actual rate before closing — macOS may override the requested 16kHz
    // in sandboxed mode, so we resample explicitly rather than relying on the header.
    const capturedRate = this.audioContext?.sampleRate ?? 16000

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

    // Resample to exactly 16kHz if macOS gave a different rate in sandboxed mode
    const TARGET_RATE = 16000
    let finalSamples = merged
    if (capturedRate !== TARGET_RATE && merged.length > 0) {
      const targetLength = Math.ceil(merged.length * (TARGET_RATE / capturedRate))
      const offlineCtx = new OfflineAudioContext(1, targetLength, TARGET_RATE)
      const srcBuf = offlineCtx.createBuffer(1, merged.length, capturedRate)
      srcBuf.getChannelData(0).set(merged)
      const srcNode = offlineCtx.createBufferSource()
      srcNode.buffer = srcBuf
      srcNode.connect(offlineCtx.destination)
      srcNode.start()
      const rendered = await offlineCtx.startRendering()
      finalSamples = rendered.getChannelData(0)
    }

    // Convert Float32 [-1,1] to Int16 PCM
    const pcm = new Int16Array(finalSamples.length)
    for (let i = 0; i < finalSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, finalSamples[i]))
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }

    return pcm.buffer
  }

  isRecording(): boolean {
    return this.recording
  }
}
