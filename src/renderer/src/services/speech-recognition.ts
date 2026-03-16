import type { AgentState } from '@shared/types/agent.types'

export interface SpeechRecognitionDeps {
  onTranscript: (agentId: string, transcript: string) => void
  onError: (error: string) => void
}

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null
  private currentAgentId: string | null = null
  private deps: SpeechRecognitionDeps
  private isListening = false

  constructor(deps: SpeechRecognitionDeps) {
    this.deps = deps
    this.initRecognition()
  }

  private initRecognition(): void {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      this.deps.onError('Speech recognition not supported in this browser')
      return
    }

    this.recognition = new SpeechRecognition()
    this.recognition.continuous = false
    this.recognition.interimResults = false
    this.recognition.lang = 'en-US'

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (this.currentAgentId) {
        this.deps.onTranscript(this.currentAgentId, transcript)
      }
    }

    this.recognition.onerror = (event) => {
      this.deps.onError(`Speech recognition error: ${event.error}`)
      this.stop()
    }

    this.recognition.onend = () => {
      this.isListening = false
    }
  }

  public start(agentId: string): boolean {
    if (!this.recognition) {
      this.deps.onError('Speech recognition not available')
      return false
    }

    if (this.isListening) {
      this.deps.onError('Already listening')
      return false
    }

    this.currentAgentId = agentId
    this.isListening = true
    this.recognition.start()
    return true
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
      this.isListening = false
    }
  }

  public isAvailable(): boolean {
    return !!this.recognition
  }

  public isListeningNow(): boolean {
    return this.isListening
  }
}