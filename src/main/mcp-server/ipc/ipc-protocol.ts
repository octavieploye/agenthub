import type { McpIpcRequest, McpIpcResponse } from '@shared/types/mcp-server.types'

export type { McpIpcRequest, McpIpcResponse }

/** Wire-level request frame — wraps an IPC request with a correlation ID */
export interface McpIpcFrame {
  correlationId: string
  request: McpIpcRequest
}

/** Wire-level response frame — echoes the correlation ID for async matching */
export interface McpIpcResponseFrame {
  correlationId: string
  response: McpIpcResponse
}
