import log from 'electron-log/main'
import { registerAgentHandlers } from './agents.ipc'
import { registerDbHandlers } from './db.ipc'
import { registerSystemHandlers } from './system.ipc'
import { registerSnapshotHandlers } from './snapshots.ipc'
import { registerRecoveryHandlers } from './recovery.ipc'
import { registerTasksHandlers } from './tasks.ipc'
import { registerSearchHandlers } from './search.ipc'
import { registerClipsHandlers } from './clips.ipc'
import { registerBugsHandlers } from './bugs.ipc'
import { registerDialogHandlers } from './dialog.ipc'
import { registerUsageHandlers } from './usage.ipc'
import { registerGuardrailsHandlers } from './guardrails.ipc'
import { registerHealthHandlers } from './health.ipc'

export function registerAllIpcHandlers(): void {
  registerAgentHandlers()
  registerDbHandlers()
  registerSystemHandlers()
  registerSnapshotHandlers()
  registerRecoveryHandlers()
  registerTasksHandlers()
  registerSearchHandlers()
  registerClipsHandlers()
  registerBugsHandlers()
  registerDialogHandlers()
  registerUsageHandlers()
  registerGuardrailsHandlers()
  registerHealthHandlers()
  log.info('All IPC handlers registered')
}
