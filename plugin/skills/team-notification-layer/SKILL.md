---
name: team-notification-layer
description: Notification Layer Team Orchestrator — diagnoses and fixes sound alerts (Howler.js), color/glow animations (CSS + useSettledStatus), and TTS voice (Piper + AudioContext). Knows the two-path architecture and every related commit.
category: dev-teams
---

# Notification Layer Team

Diagnose and fix the three notification subsystems in AgentHub: sound alerts, color/glow animations, and TTS voice.

## When to Use

- Sound alerts stopped working (except spawn sound)
- Agent card glow/shimmer/color not showing on status changes
- TTS voice not speaking or speaking garbled output
- Need to audit the notification pipeline after code changes
- Evaluating TTS for deprecation

## What You Need Before Starting

- Confirmed repo: `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub`
- Bug description: which notification layer(s) are broken and what still works
- Whether the issue is in the main window, breakout windows, or both

## What This Team Produces

1. **Diagnosis report**: Which specific gate, wiring, or CSS rule is causing the failure
2. **Fix plan**: Minimal targeted changes per subsystem, in priority order
3. **Verification steps**: Specific multi-agent scenarios to confirm each fix
4. **Regression document** (optional): Full git commit timeline and architecture map

## Agent Sequence

1. **lead-notification** — Receives the bug report, runs the triage decision tree, identifies affected subsystem(s)
2. **Dispatch 1-2 specialists in parallel** (max 3 active total):
   - **sound-specialist** — If sounds don't play: traces Path A vs Path B, checks triage gates, Howler.js errors, volume settings
   - **glow-specialist** — If glow/color broken: checks isRead flag, useSettledStatus debounce, CSS classes, getGlowConfig logic
   - **tts-specialist** — If TTS silent: checks voiceEnabled toggle, AudioContext state, Piper binary, TtsTrigger priming
3. **Lead aggregates** findings and presents unified fix plan to user

## Key Architecture Knowledge

### Two Sound Paths
- **Path A (Direct)**: `agentStatusChange` IPC → direct `playAgentSound('agent_spawned')` — bypasses triage
- **Path B (Triage)**: `emitTriageResult()` → `routeNotification()` → `NOTIFICATIONS.TRIAGED` IPC → App.tsx handler

### Key Commits
| System | Last Working | Breaking Commit |
|---|---|---|
| Sound | `c3f0712` (2026-07-07) | `e262b94` (2026-07-23, major rewire) |
| Glow | `71bd76f` (2026-07-07) | `e94b903` (2026-07-23, settle 1000→100ms) |
| TTS | `c373d9d` (2026-07-21) | `6e4545f` (2026-07-11, sandbox:true) |

### Regression Report
Full investigation: `docs/superpowers/2026-07-24-sound-color-tts-regression-report.md`

## Key Rules

- Fix priority: glow first → sound second → TTS last
- Never change `auto-triage.ts` rules without user approval
- Never touch files outside your subsystem (specialists are scoped)
- Always test with multi-agent setup (glow only shows on non-selected agents)
- `ttsVolume` is master volume for ALL sounds — check it before debugging Howler.js
- `voiceEnabled` defaults to FALSE — TTS requires explicit opt-in

## Common Mistakes

| Mistake | Fix |
|---|---|
| Testing glow with one selected agent | Glow only shows on non-selected agents — spawn 2+, select one, observe the other |
| Debugging sound when ttsVolume is 0 | Check `localStorage.getItem('agenthub:ttsVolume')` first |
| Fixing TTS before checking voiceEnabled | `voiceEnabled` defaults FALSE — must be explicitly enabled |
| Editing getGlowConfig in one file only | Logic is duplicated in AgentMiniCard.tsx AND AgentSidebar.tsx — fix both |
| Assuming triage events reach renderer | The agentTriaged handler uses a type cast — add console.log to verify |
