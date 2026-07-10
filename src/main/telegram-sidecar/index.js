// src/main/telegram-sidecar/index.js
'use strict'

const https = require('https')
const readline = require('readline')

// ── State ─────────────────────────────────────────────────────────────────────
let botToken = null
let allowedUserId = null   // number | null — Phase 1 single user
let allowedChatId = null   // number | null — same as userId for private chats
let agentCache = new Map() // name (lowercase) -> { id, name, status, repo }
let repoCache = []         // { name, path }[]
let pendingApprovals = new Map() // requestId -> { chatId, messageId, timerId }
let pendingSpawn = null    // { step: 1|2|3, chatId, repo?, task? } | null
let pendingSendAgent = null // { chatId } | null — waiting for agent pick
let mutedUntil = 0
let notifyQueue = []       // pending notification messages
let flushTimer = null
let isShuttingDown = false
let lastUpdateId = 0

// ── Parent communication ───────────────────────────────────────────────────────
function sendToParent(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

// ── Telegram API ───────────────────────────────────────────────────────────────
function telegramPost(method, params) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(params)
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('Bad JSON')) } })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function escapeHtml(str) {
  // Strip control characters (U+0000-U+001F) except \n and \t — these silently kill Telegram messages
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function sendMessage(chatId, text, replyMarkup) {
  const params = { chat_id: chatId, text: escapeHtml(text), parse_mode: 'HTML' }
  if (replyMarkup) params.reply_markup = replyMarkup
  const res = await telegramPost('sendMessage', params)
  if (!res.ok) {
    sendToParent({ type: 'error', error: `sendMessage failed: ${res.description || JSON.stringify(res)}` })
  }
  return res
}

async function editMessageText(chatId, messageId, text) {
  return telegramPost('editMessageText', { chat_id: chatId, message_id: messageId, text })
}

async function answerCallback(callbackQueryId, text) {
  return telegramPost('answerCallbackQuery', { callback_query_id: callbackQueryId, text })
}

// ── Long-poll loop ─────────────────────────────────────────────────────────────
async function pollOnce() {
  try {
    const res = await telegramPost('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
      allowed_updates: ['message', 'callback_query']
    })
    if (!res.ok || !res.result.length) return
    for (const update of res.result) {
      lastUpdateId = update.update_id
      if (update.message) await handleMessage(update.message)
      if (update.callback_query) await handleCallback(update.callback_query)
    }
  } catch (err) {
    sendToParent({ type: 'error', message: String(err) })
  }
}

function schedulePoll() {
  if (isShuttingDown) return
  setTimeout(async () => {
    await pollOnce()
    schedulePoll()
  }, 500)
}

// ── Access control ─────────────────────────────────────────────────────────────
function isKnownUser(fromId) {
  if (allowedUserId === null) return false
  return fromId === allowedUserId
}

// ── Message handler ────────────────────────────────────────────────────────────
async function handleMessage(msg) {
  const fromId = msg.from?.id
  const chatId = msg.chat.id
  const text = (msg.text || '').trim()

  // First-run: auto-add first sender
  if (allowedUserId === null && fromId) {
    allowedUserId = fromId
    allowedChatId = chatId
    sendToParent({ type: 'first_contact', telegramUserId: fromId, chatId })
    await sendMessage(chatId,
      `Hi! Your AgentHub is connected.\n\nI'll send you a message whenever one of your agents needs you — like when they finish a job or need your go-ahead.\n\nType /help to see what I can do.`
    )
    sendToParent({ type: 'command', command: 'get_status' })
    return
  }

  if (!isKnownUser(fromId)) {
    sendToParent({ type: 'blocked_sender', telegramUserId: fromId })
    return // silent ignore — no reply to unknown sender
  }

  // Check if this is a reply to a needs_input message
  if (msg.reply_to_message) {
    // Route reply to the agent that asked the question
    // The original message text contains the agentId encoded via pendingApprovals lookup
    // For Phase 1: send to the agent that last sent a needs_input notification
    // Simple implementation: user must /send explicitly for now; reply routing is Phase 2
  }

  // Muted check
  if (Date.now() < mutedUntil && text !== '/unmute') {
    return
  }

  // Spawn flow in progress
  if (pendingSpawn && pendingSpawn.chatId === chatId) {
    await handleSpawnStep(chatId, text)
    return
  }

  // Commands always escape any pending flow
  if (text.startsWith('/')) {
    pendingSendAgent = null
    pendingSpawn = null
    await handleCommand(chatId, text)
    return
  }

  // Awaiting agent pick for /send
  if (pendingSendAgent && pendingSendAgent.chatId === chatId) {
    await handleSendAgentPick(chatId, text)
    return
  }

  await sendMessage(chatId, `I didn't quite understand that.\n\nTry /help to see what I can do, or just describe what you want and I'll do my best.`)
}

// ── Commands ───────────────────────────────────────────────────────────────────
async function handleCommand(chatId, text) {
  const [cmd, ...rest] = text.split(' ')

  switch (cmd) {
    case '/start':
    case '/help':
      await sendMessage(chatId, helpText())
      break

    case '/status': {
      sendToParent({ type: 'command', command: 'get_status' })
      pendingSendAgent = null
      setTimeout(async () => {
        const agents = [...agentCache.values()]
        if (!agents.length) {
          await sendMessage(chatId, 'No agents running right now.\n\nType /start_agent to launch one.')
        } else {
          const lines = agents.map(a => `• ${a.name} (${a.status}) — ${a.repo}`).join('\n')
          const buttons = agents.map(a => [{ text: `Send to ${a.name}`, callback_data: `send_to:${a.id}` }])
          await sendMessage(chatId, `Your active agents:\n\n${lines}`, { inline_keyboard: buttons })
        }
      }, 300)
      break
    }

    case '/send': {
      const parts = rest.join(' ')
      // Try to extract agent name as first word if it matches a known agent
      const firstWord = (rest[0] || '').toLowerCase()
      const knownAgent = agentCache.get(firstWord)
      if (knownAgent && rest.length > 1) {
        const message = rest.slice(1).join(' ')
        sendToParent({ type: 'command', command: 'send_task', agentId: knownAgent.id, message })
        await sendMessage(chatId, `Sent to ${knownAgent.name}.`)
      } else if (agentCache.size === 0) {
        await sendMessage(chatId, 'No agents are running right now. Want to start one? Type /start_agent')
      } else if (agentCache.size === 1) {
        const agent = [...agentCache.values()][0]
        const message = parts || ''
        if (!message) { await sendMessage(chatId, 'What do you want to send?'); return }
        sendToParent({ type: 'command', command: 'send_task', agentId: agent.id, message })
        await sendMessage(chatId, `Sent to ${agent.name}.`)
      } else {
        // Multiple agents — show pick list
        const agents = [...agentCache.values()]
        const buttons = agents.map(a => [{ text: a.name, callback_data: `pick_agent:${a.id}:${parts}` }])
        pendingSendAgent = { chatId }
        await sendMessage(chatId, 'Which agent should receive this?', { inline_keyboard: buttons })
      }
      break
    }

    case '/start_agent':
      // Begin spawn flow — step 1
      sendToParent({ type: 'command', command: 'get_repos' })
      setTimeout(async () => {
        if (!repoCache.length) {
          await sendMessage(chatId, `Let's start a new agent. I'll ask you a few quick questions.\n\nWhich project folder should it work on?\n\nType the path, or add a folder in AgentHub first.`)
          pendingSpawn = { step: 2, chatId, repo: null }
        } else {
          const shown = repoCache.slice(0, 5)
          const buttons = shown.map(r => [{ text: r.name, callback_data: `spawn_repo:${r.path}` }])
          if (repoCache.length > 5) buttons.push([{ text: 'Show more\u2026', callback_data: 'spawn_repo_more' }])
          buttons.push([{ text: '+ Other', callback_data: 'spawn_repo_custom' }])
          await sendMessage(chatId, `Let's start a new agent. I'll ask you a few quick questions.\n\nWhich project should it work on?`, { inline_keyboard: buttons })
          pendingSpawn = { step: 1, chatId }
        }
      }, 300)
      break

    case '/pause': {
      const name = rest.join(' ').toLowerCase()
      const agent = agentCache.get(name)
      if (!agent) { await sendMessage(chatId, `I couldn't find an agent called "${rest.join(' ')}". Type /status to see active agents.`); return }
      sendToParent({ type: 'command', command: 'pause', agentId: agent.id })
      await sendMessage(chatId, `Pausing ${agent.name}.`)
      break
    }

    case '/resume': {
      const name = rest.join(' ').toLowerCase()
      const agent = agentCache.get(name)
      if (!agent) { await sendMessage(chatId, `I couldn't find an agent called "${rest.join(' ')}". Type /status to see active agents.`); return }
      sendToParent({ type: 'command', command: 'resume', agentId: agent.id })
      await sendMessage(chatId, `Resuming ${agent.name}.`)
      break
    }

    case '/stop': {
      const name = rest.join(' ').toLowerCase()
      const agent = agentCache.get(name)
      if (!agent) { await sendMessage(chatId, `I couldn't find an agent called "${rest.join(' ')}". Type /status to see active agents.`); return }
      sendToParent({ type: 'command', command: 'stop', agentId: agent.id })
      await sendMessage(chatId, `Stopping ${agent.name}.`)
      break
    }

    case '/mute':
      mutedUntil = Date.now() + 60 * 60 * 1000
      await sendMessage(chatId, 'Notifications paused for 1 hour. Type /unmute to turn them back on.')
      break

    case '/unmute':
      mutedUntil = 0
      await sendMessage(chatId, 'Notifications are back on.')
      break

    default:
      await sendMessage(chatId, `I didn't quite understand that.\n\nTry /help to see what I can do, or just describe what you want and I'll do my best.`)
  }
}

// ── Spawn flow ─────────────────────────────────────────────────────────────────
async function handleSpawnStep(chatId, text) {
  const spawn = pendingSpawn
  if (spawn.step === 2) {
    // Received repo path (custom or from text)
    spawn.repo = text
    spawn.step = 3
    await sendMessage(chatId, `Got it \u2014 ${text}.\n\nWhat do you want the agent to do?\nType a task or instruction.`)
  } else if (spawn.step === 3 && !spawn.task) {
    spawn.task = text
    await sendMessage(chatId, `Almost ready. What should I call this agent?\n(Leave blank and I'll pick a name for you.)`)
    spawn.step = 3.5
  } else if (spawn.step === 3.5) {
    const name = (!text || text.toLowerCase() === 'skip')
      ? `agent-${Date.now().toString(36)}`
      : text
    const buttons = [[{ text: '\u2713 Launch it', callback_data: `spawn_confirm:${spawn.repo}:${spawn.task}:${name}` }, { text: 'Cancel', callback_data: 'spawn_cancel' }]]
    const taskDisplay = spawn.task.length > 120 ? spawn.task.slice(0, 117) + '\u2026' : spawn.task
    await sendMessage(chatId,
      `Ready to go! Here's what I'll launch:\n\n  Project:  ${spawn.repo}\n  Task:     ${taskDisplay}\n  Name:     ${name}`,
      { inline_keyboard: buttons }
    )
    pendingSpawn = null
  }
}

async function handleSendAgentPick(chatId, text) {
  // Agent already picked — this message is the content to send
  if (pendingSendAgent?.awaitingMessage && pendingSendAgent.agentId) {
    const agentId = pendingSendAgent.agentId
    pendingSendAgent = null
    sendToParent({ type: 'command', command: 'send_task', agentId, message: text })
    const agent = [...agentCache.values()].find(a => a.id === agentId)
    await sendMessage(chatId, `Sent to ${agent?.name ?? agentId}.`)
    return
  }

  // User typed an agent name instead of using button
  const agent = agentCache.get(text.toLowerCase())
  if (!agent) {
    await sendMessage(chatId, `I don't recognise "${text}". Type /status to see available agents.`)
    return
  }
  pendingSendAgent = { chatId, agentId: agent.id, awaitingMessage: true }
  await sendMessage(chatId, `What do you want to send to ${agent.name}?`)
}

// ── Callback handler (button presses) ─────────────────────────────────────────
async function handleCallback(cb) {
  const fromId = cb.from?.id
  if (!isKnownUser(fromId)) {
    await answerCallback(cb.id, '')
    return
  }

  const chatId = cb.message?.chat?.id
  const msgId = cb.message?.message_id
  const data = cb.data || ''

  await answerCallback(cb.id, '')

  if (data.startsWith('approve:')) {
    const requestId = data.split(':')[1]
    sendToParent({ type: 'command', command: 'approve', requestId })
    await editMessageText(chatId, msgId, '\u2705 You approved this.')
    const pending = pendingApprovals.get(requestId)
    if (pending) { clearTimeout(pending.timerId); pendingApprovals.delete(requestId) }
  } else if (data.startsWith('deny:')) {
    const requestId = data.split(':')[1]
    sendToParent({ type: 'command', command: 'deny', requestId })
    await editMessageText(chatId, msgId, '\u2717 You denied this.')
    const pending = pendingApprovals.get(requestId)
    if (pending) { clearTimeout(pending.timerId); pendingApprovals.delete(requestId) }
  } else if (data.startsWith('retry:')) {
    const agentId = data.split(':')[1]
    sendToParent({ type: 'command', command: 'respawn', agentId })
    await sendMessage(chatId, 'Retrying\u2026')
  } else if (data === 'dismiss') {
    // no-op, just clear the buttons by editing
    await editMessageText(chatId, msgId, cb.message.text + '\n\n(dismissed)')
  } else if (data.startsWith('reply:')) {
    const parts = data.split(':')
    const agentId = parts[1]
    const key = parts.slice(2).join(':')
    sendToParent({ type: 'command', command: 'send_task', agentId, message: key })
    await editMessageText(chatId, msgId, cb.message.text + `\n\n\u2705 Sent "${key}"`)
  } else if (data.startsWith('pick_agent:')) {
    const [, agentId, ...msgParts] = data.split(':')
    const message = msgParts.join(':')
    sendToParent({ type: 'command', command: 'send_task', agentId, message })
    const agent = [...agentCache.values()].find(a => a.id === agentId)
    await sendMessage(chatId, `Sent to ${agent?.name ?? agentId}.`)
    pendingSendAgent = null
  } else if (data.startsWith('spawn_repo:')) {
    const repoPath = data.slice('spawn_repo:'.length)
    if (pendingSpawn) {
      pendingSpawn.repo = repoPath
      pendingSpawn.step = 3
      const repoName = repoCache.find(r => r.path === repoPath)?.name ?? repoPath
      await sendMessage(chatId, `Got it \u2014 ${repoName}.\n\nWhat do you want the agent to do?\nType a task or instruction.`)
    }
  } else if (data === 'spawn_repo_custom') {
    if (pendingSpawn) {
      pendingSpawn.step = 2
      await sendMessage(chatId, 'Type the path to the project folder:')
    }
  } else if (data.startsWith('spawn_confirm:')) {
    const parts = data.split(':')
    const repo = parts[1]
    const task = parts[2]
    const name = parts[3]
    sendToParent({ type: 'command', command: 'spawn_agent', repo, task, name })
    await sendMessage(chatId, `\u2705 Agent launched!\n\n${name} is now running. I'll message you when it's done or if it needs anything.`)
  } else if (data === 'spawn_cancel') {
    pendingSpawn = null
    await sendMessage(chatId, 'Cancelled.')
  } else if (data === 'try_again') {
    sendToParent({ type: 'command', command: 'get_status' })
    await sendMessage(chatId, 'Checking\u2026')
  } else if (data.startsWith('send_to:')) {
    const agentId = data.slice('send_to:'.length)
    const agent = [...agentCache.values()].find(a => a.id === agentId)
    pendingSendAgent = { chatId, agentId, awaitingMessage: true }
    await sendMessage(chatId, `What do you want to send to ${agent?.name ?? agentId}?`)
  }
}

// ── Choice detection ──────────────────────────────────────────────────────────
function extractChoices(text) {
  if (!text) return null
  const patterns = [
    /^\s*(\d+)[.)]\s+(.+)$/gm,                           // 1. Option or 1) Option
    /^\s*\(?([A-Za-z])[.)]\s+(.+)$/gm,                   // A. Option or (A) Option
    /^\s*\*\*(?:Option\s+)?([A-Za-z\d]+)[.:]\*\*\s*(.+)$/gm,  // **Option A:** desc
  ]
  for (const pat of patterns) {
    const matches = [...text.matchAll(pat)]
    if (matches.length >= 2 && matches.length <= 6) {
      return matches.map(m => ({ key: m[1], label: m[2].trim() }))
    }
  }
  return null
}

function buildChoiceMarkup(choices, agentId) {
  const buttons = choices.map(c => ({
    text: String(c.key),
    callback_data: `reply:${agentId}:${c.key}`
  }))
  const rows = []
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(buttons.slice(i, i + 4))
  }
  return { inline_keyboard: rows }
}

function formatChoiceBody(choices) {
  return choices.map(c => `${c.key} · ${c.label}`).join('\n')
}

// ── Notification sender ────────────────────────────────────────────────────────
async function sendNotification(payload) {
  if (!allowedChatId) return
  if (Date.now() < mutedUntil) return

  let text, replyMarkup

  const time = new Date(payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (payload.type === 'completed') {
    const summary = payload.summary.length > 200
      ? payload.summary.slice(0, 197) + '\u2026'
      : payload.summary
    text = `\u2705 Done \u2014 ${payload.agentName}\n\n${summary}\n\n${payload.repo} \u00b7 ${time}`
    replyMarkup = { inline_keyboard: [[{ text: 'View details', callback_data: 'view_noop' }]] }

  } else if (payload.type === 'failed') {
    const summary = payload.summary.length > 200
      ? payload.summary.slice(0, 197) + '\u2026'
      : payload.summary
    text = `\u274c Failed \u2014 ${payload.agentName}\n\n${summary}\n\n${payload.repo} \u00b7 ${time}`
    replyMarkup = {
      inline_keyboard: [[
        { text: 'Retry', callback_data: `retry:${payload.agentId}` },
        { text: 'Dismiss', callback_data: 'dismiss' }
      ]]
    }

  } else if (payload.type === 'awaiting_approval') {
    const action = (payload.proposedAction || '').length > 300
      ? (payload.proposedAction || '').slice(0, 297) + '\u2026'
      : (payload.proposedAction || '')
    text = `\u23f8 Approval needed \u2014 ${payload.agentName}\n\n${action}\n\n${payload.repo} \u00b7 ${time}`
    const requestId = payload.requestId || payload.agentId
    replyMarkup = {
      inline_keyboard: [[
        { text: '\u2713 Approve', callback_data: `approve:${requestId}` },
        { text: '\u2717 Deny', callback_data: `deny:${requestId}` }
      ]]
    }
    // Set approval timeout (30 min)
    const timerId = setTimeout(async () => {
      pendingApprovals.delete(requestId)
      await sendMessage(allowedChatId, `\u23f0 Approval expired \u2014 ${payload.agentName}\n\nGo to AgentHub to see status and decide what to do next.`)
    }, 30 * 60 * 1000)
    pendingApprovals.set(requestId, { chatId: allowedChatId, timerId })

  } else if (payload.type === 'needs_input') {
    const q = (payload.question || '').length > 200
      ? (payload.question || '').slice(0, 197) + '\u2026'
      : (payload.question || '')
    const choices = extractChoices(q)
    if (choices) {
      text = `\ud83d\udcac Question \u2014 ${payload.agentName}\n\n${formatChoiceBody(choices)}\n\n${payload.repo} \u00b7 ${time}`
      replyMarkup = buildChoiceMarkup(choices, payload.agentId)
    } else {
      text = `\ud83d\udcac Question \u2014 ${payload.agentName}\n\n${q}\n\n${payload.repo} \u00b7 ${time}\n\u21b3 Reply to answer`
      replyMarkup = { force_reply: true, selective: true }
    }

  } else if (payload.type === 'silent_lock') {
    const body = (payload.message || payload.summary || '').length > 500
      ? (payload.message || payload.summary || '').slice(0, 497) + '\u2026'
      : (payload.message || payload.summary || '')
    const choices = extractChoices(body)
    if (choices) {
      text = `\u23f8 Waiting \u2014 ${payload.agentName}\n\n${formatChoiceBody(choices)}\n\n${payload.repo} \u00b7 ${time}`
      replyMarkup = buildChoiceMarkup(choices, payload.agentId)
    } else {
      text = `\u23f8 Waiting \u2014 ${payload.agentName}\n\n${body}\n\n${payload.repo} \u00b7 ${time}\n\u21b3 Reply to respond`
      replyMarkup = { force_reply: true, selective: true }
    }

  } else if (payload.type === 'agent_message') {
    const format = payload.format || 'status'
    const emoji = format === 'error' ? '\u274c'
      : format === 'question' ? '\ud83d\udcac'
      : '\u2705'
    const msg = (payload.message || '').length > 4000
      ? (payload.message || '').slice(0, 3997) + '\u2026'
      : (payload.message || '')
    const choices = format === 'question' ? extractChoices(msg) : null
    if (choices) {
      text = `${emoji} ${payload.agentName}\n\n${formatChoiceBody(choices)}\n\n${payload.repo} \u00b7 ${time}`
      replyMarkup = buildChoiceMarkup(choices, payload.agentId)
    } else {
      text = `${emoji} ${payload.agentName}\n\n${msg}\n\n${payload.repo} \u00b7 ${time}`
      if (text.length > 4000) text = text.slice(0, 3997) + '\u2026'
      if (format === 'question') {
        replyMarkup = { force_reply: true, selective: true }
      }
    }
  }

  if (!text) return
  notifyQueue.push({ text, replyMarkup })
  scheduleFlush()
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(async () => {
    flushTimer = null
    if (!notifyQueue.length || !allowedChatId) return

    if (notifyQueue.length > 5) {
      // Batch
      const items = notifyQueue.splice(0, notifyQueue.length)
      const lines = items.map(i => {
        const firstLine = i.text.split('\n')[0]
        return `  ${firstLine}`
      }).join('\n')
      await sendMessage(allowedChatId, `\ud83d\udcca ${items.length} agents finished recently:\n\n${lines}\n\nType /status for details.`)
    } else {
      const item = notifyQueue.shift()
      await sendMessage(allowedChatId, item.text, item.replyMarkup)
      if (notifyQueue.length) {
        setTimeout(() => { flushTimer = null; scheduleFlush() }, 1000)
      }
    }
  }, 100)
}

// ── Help text ──────────────────────────────────────────────────────────────────
function helpText() {
  return `Here's what I can do for you:

\ud83d\udccb Check what's happening
/status \u2014 See all your active agents and what they're doing

\ud83d\udce9 Send instructions
/send [agent name] [message]
Example: /send frontend-agent Fix the login button

  If you don't include an agent name and only one is running,
  I'll send it there. If several are running, I'll show you a list.

\ud83d\ude80 Start a new agent
/start_agent \u2014 I'll walk you through it step by step

\u23f8 Pause / resume
/pause [agent name] \u2014 Put an agent on hold
/resume [agent name] \u2014 Wake it back up

\u26d4 Stop an agent
/stop [agent name] \u2014 Stops and closes that agent

\ud83d\udd15 Quiet mode
/mute \u2014 Stop all notifications for 1 hour
/unmute \u2014 Turn notifications back on

Need help? Just type what you want to do and I'll try to help.`
}

// ── stdin reader (messages from parent) ───────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async (line) => {
  if (!line.trim()) return
  let msg
  try { msg = JSON.parse(line) } catch { return }

  switch (msg.type) {
    case 'config':
      botToken = msg.botToken
      sendToParent({ type: 'ready' })
      telegramPost('setMyCommands', {
        commands: [
          { command: 'status',      description: 'See all active agents' },
          { command: 'send',        description: 'Send a message to an agent' },
          { command: 'start_agent', description: 'Launch a new agent' },
          { command: 'pause',       description: 'Pause an agent' },
          { command: 'resume',      description: 'Resume a paused agent' },
          { command: 'stop',        description: 'Stop an agent' },
          { command: 'mute',        description: 'Mute notifications for 1 hour' },
          { command: 'unmute',      description: 'Turn notifications back on' },
          { command: 'help',        description: 'Show all commands' },
        ]
      }).catch(() => {}) // non-blocking
      schedulePoll()
      break

    case 'set_user':
      allowedUserId = msg.telegramUserId
      allowedChatId = msg.chatId
      break

    case 'notify':
      await sendNotification(msg.payload)
      break

    case 'approval_result':
      // Desktop app handled it — cancel our Telegram timeout if pending
      {
        const pending = pendingApprovals.get(msg.requestId)
        if (pending) {
          clearTimeout(pending.timerId)
          pendingApprovals.delete(msg.requestId)
        }
      }
      break

    case 'agent_list':
      agentCache.clear()
      for (const a of msg.agents) {
        agentCache.set(a.name.toLowerCase(), a)
      }
      break

    case 'repo_list':
      repoCache = msg.repos
      break

    case 'shutdown':
      isShuttingDown = true
      process.exit(0)
      break
  }
})

process.on('SIGTERM', () => { isShuttingDown = true; process.exit(0) })
process.on('SIGINT', () => { isShuttingDown = true; process.exit(0) })
