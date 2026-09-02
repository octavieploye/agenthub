import type { McpIpcRequest, McpIpcResponse } from '@shared/types/mcp-server.types'

// Tool I/O types are re-exported directly from @shared/types/mcp-server.types by all
// consumers (server.ts, handlers). Only the wire-frame types are specific to this layer
// and therefore kept here.

/** Wire-level request frame — wraps an IPC request with a correlation ID */
export interface McpIpcFrame {
  correlationId: string
  token: string
  request: McpIpcRequest
}

/** Wire-level response frame — echoes the correlation ID for async matching */
export interface McpIpcResponseFrame {
  correlationId: string
  response: McpIpcResponse
}
