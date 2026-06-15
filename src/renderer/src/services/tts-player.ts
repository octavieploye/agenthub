// src/renderer/src/services/tts-player.ts

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

let currentSource: AudioBufferSourceNode | null = null

export async function playWav(wavBuffer: ArrayBuffer, volume: number): Promise<void> {
  stopPlayback()
  const ctx = getAudioContext()
  const audioBuffer = await ctx.decodeAudioData(wavBuffer.slice(0))

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer

  const gainNode = ctx.createGain()
  gainNode.gain.value = Math.max(0, Math.min(1, volume))

  source.connect(gainNode)
  gainNode.connect(ctx.destination)

  currentSource = source

  return new Promise<void>((resolve) => {
    source.onended = () => {
      currentSource = null
      resolve()
    }
    source.start()
  })
}

export function stopPlayback(): void {
  if (currentSource) {
    try {
      currentSource.stop()
    } catch {
      // already stopped
    }
    currentSource = null
  }
}
