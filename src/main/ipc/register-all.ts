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
import { registerNotesHandlers } from './notes.ipc'
import { registerHistoryHandlers } from './history.ipc'
import { registerGitHandlers } from './git.ipc'
import { registerSkillsHandlers } from './skills.ipc'
import { registerWindowsHandlers } from './windows.ipc'
import { registerSettingsHandlers } from './settings.ipc'
import { registerModelsHandlers } from './models.ipc'
import { registerVoiceHandlers } from './voice.ipc'
import { registerDockerHandlers } from './docker.ipc'
import { registerContainersHandlers } from './containers.ipc'
import { registerFsHandlers } from './fs.ipc'
import { registerActivityHandlers } from './activity.ipc'

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
  registerNotesHandlers()
  registerHistoryHandlers()
  registerGitHandlers()
  registerSkillsHandlers()
  registerWindowsHandlers()
  registerSettingsHandlers()
  registerModelsHandlers()
  registerVoiceHandlers()
  registerDockerHandlers()
  registerContainersHandlers()
  registerFsHandlers()
  registerActivityHandlers()
  log.info('All IPC handlers registered')
}
