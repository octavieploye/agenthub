export const IPC_CHANNELS = {
  AGENTS: {
    SPAWN: 'agents:spawn',
    KILL: 'agents:kill',
    PAUSE: 'agents:pause',
    RESUME: 'agents:resume',
    LIST: 'agents:list',
    GET_STATE: 'agents:get-state',
    SEND_INPUT: 'agents:send-input',
    RESIZE: 'agents:resize'
  },
  DB: {
    GET_REPOS: 'db:get-repos',
    ADD_REPO: 'db:add-repo',
    REMOVE_REPO: 'db:remove-repo'
  },
  TASKS: {
    LIST: 'tasks:list',
    GET_BY_REPO: 'tasks:get-by-repo',
    GET_BY_STATUS: 'tasks:get-by-status',
    CREATE: 'tasks:create',
    UPDATE: 'tasks:update',
    DELETE: 'tasks:delete',
    SEARCH: 'tasks:search'
  },
  SEARCH: {
    QUERY: 'search:query'
  },
  SNAPSHOTS: {
    TAKE: 'snapshots:take',
    GET_LATEST: 'snapshots:get-latest',
    PRUNE: 'snapshots:prune'
  },
  RECOVERY: {
    GET_INFO: 'recovery:get-info',
    GET_SBAR: 'recovery:get-sbar',
    CREATE_SBAR: 'recovery:create-sbar',
    ACK_RECOVERY: 'recovery:ack'
  },
  CLIPS: {
    LIST: 'clips:list',
    GET: 'clips:get',
    CREATE: 'clips:create',
    UPDATE: 'clips:update',
    DELETE: 'clips:delete',
    RECORD_LAUNCH: 'clips:record-launch'
  },
  BUGS: {
    LIST: 'bugs:list',
    GET_BY_REPO: 'bugs:get-by-repo',
    GET_BY_SEVERITY: 'bugs:get-by-severity',
    GET_UNRESOLVED: 'bugs:get-unresolved',
    CREATE: 'bugs:create',
    RESOLVE: 'bugs:resolve',
    DELETE: 'bugs:delete'
  },
  DIALOG: {
    OPEN_DIRECTORY: 'dialog:open-directory'
  },
  USAGE: {
    GET_SNAPSHOT: 'usage:get-snapshot',
    REFRESH: 'usage:refresh'
  },
  GUARDRAILS: {
    GET: 'guardrails:get',
    UPDATE: 'guardrails:update',
    RESET: 'guardrails:reset'
  },
  HEALTH: {
    GET_SNAPSHOT: 'health:get-snapshot'
  },
  NOTES: {
    GET: 'notes:get',
    GET_BY_AGENT: 'notes:get-by-agent',
    GET_BY_REPO: 'notes:get-by-repo',
    GET_GLOBAL: 'notes:get-global',
    SAVE: 'notes:save',
    DELETE: 'notes:delete'
  },
  HISTORY: {
    GET: 'history:get',
    SEARCH: 'history:search'
  },
  SYSTEM: {
    GET_APP_VERSION: 'system:get-app-version',
    GET_PLATFORM: 'system:get-platform',
    SHUTDOWN: 'system:shutdown',
    MINIMIZE_TO_TRAY: 'system:minimize-to-tray'
  }
} as const

export const IPC_EVENTS = {
  AGENTS: {
    STATUS_CHANGE: 'on-agents:status-change',
    OUTPUT: 'on-agents:output',
    EXIT: 'on-agents:exit'
  },
  RECOVERY: {
    SNAPSHOT_SAVED: 'on-recovery:snapshot-saved'
  }
} as const
