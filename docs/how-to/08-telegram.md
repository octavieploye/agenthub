# How to Use Telegram Alerts

Get notified on your phone and send instructions to your agents from anywhere — even when your computer is locked.

---

## What it does

- Sends you a message when an agent finishes, fails, needs approval, or needs your input
- Lets you type `/status`, `/send`, `/pause`, `/stop`, `/approve`, `/deny`, `/mute`, `/unmute` from your phone
- Uses your own private Telegram bot — your data never touches a third-party server

---

## Step 1 — Create your private bot (one time)

1. Open Telegram on your phone or desktop
2. Search for **@BotFather** and tap **Start**
3. Type `/newbot` and follow the prompts
   - Choose any name (e.g. "My AgentHub")
   - Choose any username ending in `bot` (e.g. `myagenthub_bot`)
4. BotFather gives you a **connection code** — a long string starting with numbers, like `1234567890:AAFaKe...`
5. Copy it — you will paste it in AgentHub

---

## Step 2 — Connect in AgentHub

1. Open AgentHub and click the **gear icon** (Settings)
2. Go to the **Telegram** tab
3. Click **Set up Telegram alerts**
4. Step 1 of the wizard: confirms you have your connection code — click **I have my code**
5. Step 2: paste your connection code and click **Connect**
6. Step 3: open Telegram, find your bot (search by the username you chose), tap **Start** or send any message
7. AgentHub detects your first message and links your account — the tab switches to **Connected**

---

## Step 3 — Choose which alerts to receive

In the connected state, toggle on/off:

- **Agent finished** — notified when any agent completes a task
- **Agent failed** — notified on error or crash
- **Agent needs approval** — notified when a task is waiting for your go-ahead
- **Agent needs your input** — notified when an agent is blocked and needs you to reply

All four are on by default. Use **Send a test message** to confirm your bot is working.

---

## Commands you can send from Telegram

| Command | What it does |
|---|---|
| `/status` | List all running agents and their state |
| `/send` | Send a message or instruction to a running agent |
| `/start_agent` | Start a new agent (bot will walk you through repo + task) |
| `/pause` | Pause a running agent |
| `/stop` | Stop a running agent |
| `/approve` | Approve a pending task (30-minute window) |
| `/deny` | Deny a pending task |
| `/mute` | Silence alerts temporarily |
| `/unmute` | Re-enable alerts |

---

## Disconnect

Settings → Telegram → **Disconnect** → confirm. This clears your connection code and unlinks your account. Your bot still exists in Telegram — you can reconnect later with the same code.

---

## Troubleshooting

**"I pasted my code but it says connection failed"**
- Double-check the code — it starts with 8-10 digits, a colon, then `AA` followed by 35 characters
- Make sure you copied the whole thing from BotFather (no spaces at start or end)
- Try disconnecting and reconnecting

**"I clicked Connect but step 3 is stuck on 'Waiting for your first message'"**
- Find your bot in Telegram and send it any message or tap Start
- If the bot doesn't respond to Start, search by the exact username you set with BotFather
- AgentHub must be running and in the foreground when you send the first message

**"I'm not getting any alerts"**
- Go to Settings → Telegram and check which alert types are toggled on
- Click **Send a test message** — if you receive it, alerts are working and the trigger level may not have been reached yet
- Alerts only fire for agents that have been running long enough to reach a notification state (failed, completed, needs approval, needs input)

**"I get alerts but the buttons don't work"**
- Make sure you are only using your bot from the Telegram account you linked in step 3
- Messages from other accounts are silently blocked (this is intentional — your bot is private)

**"I see 'unknown command' from the bot"**
- Only the commands listed above are supported in Phase 1
- Free-form text to the bot (outside of prompted flows like `/start_agent`) is not yet handled

---

## Privacy notes

- Your connection code is encrypted using your operating system's secure storage (Keychain on Mac, Credential Vault on Windows) — it is never written to disk in plain text and never leaves your machine
- Only you can talk to your bot — any other Telegram account that messages it gets silently blocked
- No agent output (code, terminal text, file contents) is ever sent to Telegram — only notification summaries

---

## Known limitations (Phase 1)

- The bot connection does not persist across app restarts yet — you may need to re-enter your connection code after restarting AgentHub (Phase 2 fix)
- Very long repo names or task descriptions may be truncated in button callbacks
- Approval timeout is 30 minutes — after that the task continues without your input
