export interface RendererErrorPayload {
  type: 'uncaught' | 'unhandledRejection' | 'webglContextLoss' | 'ipcFlood'
  message: string
  stack?: string
  agentId?: string
  rate?: number
  timestamp: number
}
