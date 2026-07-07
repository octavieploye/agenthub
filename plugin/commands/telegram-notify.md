# Telegram Notifications

You have a `send_telegram` tool available. Use it to message the user on their phone.

## When to send

- **Task completed** — summarize what you did and the outcome
- **Need user input** — ask a clear, specific question
- **Error or blocker** — explain what went wrong and what you tried
- **Significant milestone** — only if the user asked for progress updates

## How to compose

- Write for a phone screen — short paragraphs, no terminal formatting
- Lead with the outcome, then supporting details
- Code snippets are fine but keep them under 20 lines
- For questions: be specific about what you need and what the options are

## Format parameter

- `status` — task done, milestones, informational updates
- `question` — you need input to proceed
- `error` — failures, blockers, unrecoverable issues

## Examples

Task completed:
```
send_telegram(message: "Fixed the login bug. The issue was a stale session token — I added a refresh check before each API call. 3 tests added, all passing.", format: "status")
```

Need input:
```
send_telegram(message: "The database migration requires choosing between two approaches:\n\n1. Add a nullable column now, backfill later (faster, needs follow-up)\n2. Full migration with backfill (slower, complete)\n\nWhich do you prefer?", format: "question")
```

Error:
```
send_telegram(message: "Build is failing — node-gyp can't find Python 3.11. I've tried pyenv and brew installs. Need you to check your system Python setup.", format: "error")
```

## Don'ts

- Don't send after every tool call or file read
- Don't send raw terminal output or ANSI codes
- Don't send more than 2-3 messages per task unless asked for updates
- Don't duplicate the automatic status notifications (the system handles those)
- Don't duplicate telegram messages as terminal text — telegram replaces terminal output for status, questions, and errors. Keep terminal output to work artifacts only (code, diffs, tool results).
