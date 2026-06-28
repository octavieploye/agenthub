# Telegram Message Completeness Fix

**Date:** 2026-06-28
**Status:** Approved
**Problem:** Telegram notifications from agents contain incomplete/truncated content instead of the full response.

## Root Cause

Three compounding issues:

1. **Triple truncation pipeline**: Agent response passes through `filterTtsResponse` (strips everything except spoken prose) -> `.slice(-120)` (hard cap) -> sidecar truncates to 120/100 chars again. A full response of thousands of chars becomes a 120-char tail fragment.

2. **Buffer race condition**: `cleanTextBuffer` is cleared by TTS callbacks (`onEmit`, `onBufferReset`) before the 3-second delayed Telegram send reads it. The delayed re-filter finds an empty buffer.

3. **HeadlessTerminalBuffer wired but never read**: `headlessTerminal.write(data)` receives every PTY chunk, but `extractText()` is never called in the notification path. This was built to solve this exact problem but the wiring was never completed.

## Design

### Architecture: Shared Core + Adapter Pattern

```
PTY output --> HeadlessTerminalBuffer (shared core, never cleared by consumers)
                |-- TTS adapter: filterTtsResponse() -> spoken prose (unchanged)
                |-- Telegram adapter: filterTelegramResponse() -> rich message (new)
```

Each consumer reads from the same immutable source with its own filter. No race condition, no shared mutable buffer.

### Component 1: `src/main/utils/telegram-response-filter.ts` (new file)

Lighter filter than TTS. Purpose: produce a readable Telegram message, not spoken audio.

**Keeps:**
- Prose paragraphs
- Fenced code blocks (``` delimited)
- Tool call summary lines (lines starting with `●`) — provides context about what the agent did
- Markdown formatting (headers, lists, bold, italic)

**Strips:**
- ANSI escape residue
- Braille/decorative spinners
- Thinking/processing indicators
- Shell prompts and command echoes
- Keyboard hint lines (Esc to interrupt, etc.)
- Banner/startup chrome
- Block element characters
- oh-my-zsh noise
- Permission prompt lines
- Update available banners

**Does NOT strip (unlike TTS filter):**
- Tool continuation lines (`⎿├└`) — these show results
- Tool status lines (`✓✗`) — these show outcomes
- Indented tool result blocks — these contain useful output

### Component 2: `agent-manager.ts` delayed send path changes

In the 3-second delayed `setTimeout` (currently lines 210-250):

**Before:**
```typescript
const refiltered = filterTtsResponse(managed.cleanTextBuffer.trim()).trim()
// ...
payload.summary = freshProse.slice(-120)
```

**After:**
```typescript
managed.headlessTerminal.flush(() => {
  const extracted = managed.headlessTerminal.extractText()
  const filtered = filterTelegramResponse(extracted)
  const summary = filtered.slice(-2000)  // generous limit, not 120
  // ... build and send payload
})
```

Key changes:
- Use `flush()` callback to ensure all queued Terminal.write() calls complete
- Use `extractText()` for clean text (xterm.js handles cursor positioning correctly)
- Use `filterTelegramResponse()` instead of `filterTtsResponse()`
- Cap at 2000 chars (leaves room for message chrome within Telegram's 4096 limit)
- Remove the `.slice(-120)` hard cap

### Component 3: Sidecar truncation limits

In `telegram-sidecar/index.js` `sendNotification()`:

| Payload type | Field | Old limit | New limit |
|---|---|---|---|
| completed | summary | 120 chars | 2000 chars |
| failed | summary | 100 chars | 1000 chars |
| needs_input | question | 300 chars | 2000 chars |
| awaiting_approval | proposedAction | 300 chars | 300 chars (unchanged) |

If any message exceeds Telegram's 4096 char limit after adding chrome (header, footer, project info), truncate with ellipsis at 4000 chars.

### What stays unchanged

- `cleanTextBuffer` lifecycle (still used by TTS)
- `lastFilteredProse` (still set by TTS, no longer read by Telegram)
- `filterTtsResponse()` (untouched)
- `HeadlessTerminalBuffer` API (already correct)
- Sidecar JSON-RPC protocol
- Notification routing/triage system
- TTS trigger and buffer reset logic

## Testing

- Unit tests for `filterTelegramResponse()` covering all kept/stripped categories
- Comparison tests: Telegram filter is strictly more permissive than TTS filter for the same input
- Integration: verify the flush → extract → filter → send pipeline produces complete messages
- Regression: TTS path produces identical output to before (no changes to TTS code)

## Files Changed

| File | Change |
|---|---|
| `src/main/utils/telegram-response-filter.ts` | New file |
| `src/main/utils/telegram-response-filter.test.ts` | New file |
| `src/main/services/agent-manager.ts` | Delayed send path uses headless terminal + new filter |
| `src/main/telegram-sidecar/index.js` | Increased truncation limits |
