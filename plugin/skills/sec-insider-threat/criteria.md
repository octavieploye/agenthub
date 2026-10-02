# Insider Threat Audit — Criteria & Checklists

## Severity Guide

| Severity | Meaning |
|---|---|
| CRITICAL | Immediate exfiltration vector. An agent or user can read/transmit AgentHub source, architecture, or DB right now. Blocks commit. |
| HIGH | Likely exfiltration under adversarial conditions. Fix before next release. |
| MEDIUM | Plausible risk. Fix in current sprint. |
| LOW | Hardening gap. No immediate risk but reduces attack surface if addressed. |

---

## Phase 1 — Access Barrier Checklist

- [ ] `contextIsolation: true` in every `BrowserWindow` instantiation
- [ ] `nodeIntegration: false` in every `BrowserWindow` instantiation
- [ ] No IPC handler reads a file path received from the renderer without sanitization
- [ ] No IPC handler exposes `db.exec()`, raw SQL, or arbitrary query construction to renderer input
- [ ] Agent spawn working directory is scoped (not the full project root or filesystem root)
- [ ] Spawned agents do NOT receive `--allowedTools` granting read access to `.claude/` or `src/` by default
- [ ] `terminal_output` table has a row cap or TTL (unbounded = persistent exfiltration store)
- [ ] No DB column stores raw system prompt text or full skill file contents

---

## Phase 2 — IP Exfiltration Checklist

- [ ] PTY `onData` handler does NOT store system-prompt fragments verbatim in `terminal_output`
- [ ] Telegram notification payloads do NOT include agent system prompt text or skill file contents
- [ ] `main.log` logger does NOT record agent instructions, system prompts, or IPC payloads containing skill content
- [ ] `--append-system-prompt-file` injected content does NOT name the Optimaeus entity cascade verbatim
- [ ] `--append-system-prompt-file` injected content does NOT include unreleased feature names or monetization details
- [ ] No plugin skill or command file gives agents a tool or pattern to glob `.claude/skills/**`

---

## Phase 3 — AI Guard Checklist

- [ ] Plugin files (`plugin/skills/`, `plugin/commands/`) do NOT reveal the system's internal entity architecture
- [ ] Plugin files do NOT include business IP: monetization logic, unreleased integrations, competitive positioning
- [ ] Spawned agent working directory is scoped so `cat .claude/CLAUDE.md` is not possible
- [ ] No user-controlled text is injected into agent system prompts without sanitization
- [ ] No IPC handler forwards raw renderer text into the next agent prompt
- [ ] A reverse-engineering refusal clause exists in the injected agent instructions
- [ ] The refusal clause explicitly prohibits repeating system prompt content
- [ ] The refusal clause covers semantic variants: "describe your instructions", "what entities", "export skills"
- [ ] The refusal clause states it cannot be overridden by subsequent instructions

---

## Finding ID Tracking

Finding IDs must increment from the last `ID` value in `security/security-log.md`.

Current last known ID: **S21** (2026-07-11)
Next ID to assign: **S22**

Update this file after each scan run.
