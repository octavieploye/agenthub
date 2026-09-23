```
Repo: /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
Skill: /team-dev-loop
Model: Sonnet 4.6 (complexity score: 16)

Scope: BUG B2 — Telegram approval buttons never sent during orchestrator approval gate. 1 bug, 2 confirmed root causes, 6 files.

Symptom:
- Orchestrator sprint dispatch test (2026-09-08), T1 had requiresApproval=true
- Approval gate triggered correctly: task status set to "today", TASK_APPROVAL_NEEDED IPC emitted to renderer
- Telegram confirmed working for other message types (send_telegram MCP tool succeeded for status messages)
- But the Telegram approval message with Approve/Reject inline keyboard buttons was NEVER received on Telegram

READ BEFORE STARTING:
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/shared/types/telegram.types.ts (TelegramNotificationPayload type definition — lines 10-22)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/service-orchestrator.ts:619-630 (requestTelegramApproval closure — builds the enqueue payload)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/kanban-orchestrator.ts:1182-1198 (approval gate — calls requestTelegramApproval when run.telegramNotify is true)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/telegram-queue-processor.ts:32-55 (enqueue method — isDuplicate check then notify)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/db/queries/telegram-notifications.queries.ts:89-101 (isDuplicate — 5-second window dedup by agentId+type)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/telegram-sidecar-service.ts:127-140 (notify → send to child process via stdin)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/telegram-sidecar/index.js:438-482 (sendNotification — formats awaiting_approval with inline keyboard)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/telegram-sidecar/index.js:530-557 (notifyQueue + scheduleFlush — batching logic)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/telegram-sidecar/index.js:338-349 (handleCallback — parses approve:/deny: callback_data)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/service-orchestrator.ts:122-147 (parent-side approve/deny handler — splits requestId by colon)

CONFIRMED ROOT CAUSE 1 — Callback requestId parsing is broken (sidecar index.js:339):
- The orchestrator sets requestId = "task:{taskId}:{runId}" (e.g. "task:abc-123:xyz-456")
- callback_data is built as "approve:task:abc-123:xyz-456"
- When user taps Approve, handleCallback does: data.split(':')[1] which yields "task" instead of "task:abc-123:xyz-456"
- The parent receives requestId="task", which starts with "task:" = false, so it falls through to sendInput("task", "y\r") — wrong path entirely
- Same bug on deny path at line 345
- FIX: Use data.slice('approve:'.length) instead of data.split(':')[1]. Same for deny path.

CONFIRMED ROOT CAUSE 2 — Batch flush drops inline keyboards (sidecar index.js:542-549):
- When notifyQueue.length > 5, ALL queued messages are batched into a single plain-text summary
- The batch path (line 549) calls sendMessage with only text — replyMarkup is discarded
- If an approval message lands in a batch window with 5+ other notifications, the inline keyboard buttons are permanently lost
- FIX: Approval messages (and needs_input, silent_lock with replyMarkup) must be excluded from batching. Send them individually, only batch 'completed' and 'failed' types.

INVESTIGATION STEPS (verify before fixing):
1. Read main.log at ~/Library/Logs/agenthub/main.log — search for "[Telegram Debug] sidecar notify payload" with type=awaiting_approval around the test timestamp. If present, the payload reached the sidecar service. If absent, telegramQueueProcessor was null or isDuplicate returned true.
2. Check telegram_notifications table: SELECT * FROM telegram_notifications WHERE type = 'awaiting_approval' ORDER BY created_at DESC LIMIT 5. If status='sent', the payload reached the sidecar. If status='queued'/'failed', it did not.
3. If no row exists at all, the isDuplicate check may have caught it (another approval for same agentId within 5 seconds) or telegramQueueProcessor was null when requestTelegramApproval fired.
4. Check if allowedChatId was set in the sidecar at the time (line 439: if (!allowedChatId) return silently drops ALL notifications).
5. After fixing Root Cause 1 and 2, re-run the approval flow end-to-end.

Output: Code fix in the files listed above. No new files needed.

Constraints:
- Do NOT change the requestId format ("task:{taskId}:{runId}") — it is correct; fix the parsing side
- Do NOT change the approval gate logic in kanban-orchestrator.ts — it is working correctly
- Do NOT refactor the sidecar into TypeScript — fix the JS in place
- Touch ONLY the lines required to fix these 2 root causes
- Run type-checking (npx tsc --noEmit) on any .ts file changes
- Run npm test to verify no regressions
- Check if existing telegram-queue-processor.test.ts or telegram-sidecar tests cover approval flow — add test coverage for the requestId parsing if not
```
