export const IPC_CHANNELS = {
  AGENTS: {
    SPAWN: 'agents:spawn',
    KILL: 'agents:kill',
    PAUSE: 'agents:pause',
    RESUME: 'agents:resume',
    LIST: 'agents:list',
    GET_STATE: 'agents:get-state',
    SEND_INPUT: 'agents:send-input',
    RESIZE: 'agents:resize',
    UPDATE_COLOR: 'agents:update-color',
    UPDATE_TASK_DESCRIPTION: 'agents:update-task-description',
    RENAME: 'agents:rename',
    UPDATE_MODEL: 'agents:update-model',
    ATTACH_TERMINAL: 'agents:attach-terminal',
    DETACH_TERMINAL: 'agents:detach-terminal',
    GET_PROXY_PATH: 'agents:get-proxy-path',
    RESPAWN: 'agents:respawn',
    UPDATE_VOICE_MODE: 'agents:update-voice-mode'
  },
  MODELS: {
    LIST_ALL: 'models:list-all',
    FETCH_OLLAMA: 'models:fetch-ollama'
  },
  DB: {
    GET_REPOS: 'db:get-repos',
    ADD_REPO: 'db:add-repo',
    REMOVE_REPO: 'db:remove-repo',
    UNHIDE_REPO: 'db:unhide-repo',
    UPDATE_REPO_COLOR: 'db:update-repo-color'
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
  GIT: {
    GET_STATUS: 'git:get-status',
    GET_ALL_STATUS: 'git:get-all-status',
    GET_DIFF: 'git:get-diff',
    STAGE_FILES: 'git:stage-files',
    UNSTAGE_FILES: 'git:unstage-files',
    COMMIT: 'git:commit',
    PUSH: 'git:push',
    PULL: 'git:pull',
    GET_LOG: 'git:get-log',
    GET_BRANCHES: 'git:get-branches',
    SUGGEST_COMMIT: 'git:suggest-commit'
  },
  SKILLS: {
    LIST: 'skills:list',
    EXECUTE: 'skills:execute',
    REFRESH: 'skills:refresh'
  },
  WINDOWS: {
    CREATE_BREAKOUT: 'windows:create-breakout',
    CREATE_FILE_PREVIEW: 'windows:create-file-preview',
    CLOSE_BREAKOUT: 'windows:close-breakout',
    LIST_BREAKOUTS: 'windows:list-breakouts',
    FOCUS_BREAKOUT: 'windows:focus-breakout'
  },
  SETTINGS: {
    GET_ALL: 'settings:get-all',
    SET: 'settings:set',
    EXPORT: 'settings:export',
    IMPORT: 'settings:import'
  },
  SYSTEM: {
    GET_APP_VERSION: 'system:get-app-version',
    GET_PLATFORM: 'system:get-platform',
    SHUTDOWN: 'system:shutdown',
    MINIMIZE_TO_TRAY: 'system:minimize-to-tray',
    OPEN_TERMINAL: 'system:open-terminal'
  },
  VOICE: {
    TRANSCRIBE: 'voice:transcribe',
    STATUS: 'voice:status',
    CANCEL: 'voice:cancel'
  },
  DOCKER: {
    STATUS: 'docker:status',
    BUILD: 'docker:build',
    REBUILD: 'docker:rebuild',
    CHECK_CLI_VERSION: 'docker:check-cli-version'
  },
  FS: {
    READ_DIR: 'fs:read-dir',
    READ_FILE: 'fs:read-file'
  },
  ACTIVITY: {
    QUERY: 'activity:query',
    STATS: 'activity:stats'
  },
  CONTAINERS: {
    LIST: 'containers:list',
    STOP: 'containers:stop',
    DESTROY: 'containers:destroy',
    STOP_ALL: 'containers:stop-all'
  },
  PROJECT: {
    INIT: 'project:init'
  },
  KANBAN: {
    OPEN: 'kanban:open',
    UPDATE_POSITION: 'kanban:update-position',
    SPRINT_INTAKE: 'kanban:sprint-intake'
  },
  LOG: {
    RENDERER_ERROR: 'log:renderer-error'
  },
  TTS: {
    SPEAK: 'tts:speak',
    STOP: 'tts:stop',
    STATUS: 'tts:status',
    LIST_VOICES: 'tts:list-voices',
  },
} as const

export const IPC_EVENTS = {
  AGENTS: {
    STATUS_CHANGE: 'on-agents:status-change',
    OUTPUT: 'on-agents:output',
    EXIT: 'on-agents:exit'
  },
  NOTIFICATIONS: {
    TRIAGED: 'on-agents:triaged'
  },
  WINDOWS: {
    BREAKOUT_CLOSED: 'on-windows:breakout-closed'
  },
  RECOVERY: {
    SNAPSHOT_SAVED: 'on-recovery:snapshot-saved'
  },
  DOCKER: {
    BUILD_PROGRESS: 'on-docker:build-progress',
    STATUS_CHANGE: 'on-docker:status-change'
  },
  TTS: {
    RESPONSE_READY: 'on-tts:response-ready',
  },
} as const
