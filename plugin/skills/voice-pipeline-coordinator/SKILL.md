---
name: voice-pipeline-coordinator
description: Voice Pipeline Coordinator — orchestrates OPTimaeus voice layer build across 6 sprints (S0-S5) with TDD gates, security reviews, and parallel execution. Dispatches team-dev-loop, sec-devops, git-ops.
category: dev-teams
---

# Voice Pipeline Coordinator

Orchestrate the OPTimaeus voice pipeline implementation across 6 sprints (Sprint 0-5). Owns the entire build lifecycle: dependency tracking, sprint dispatching, security gates, and progress validation.

## When to Use

- Starting or resuming voice pipeline implementation on OPTimaeus
- User says "start voice sprint", "voice pipeline", "next voice sprint"
- Checking voice pipeline progress or unblocking a stuck sprint

## What You Need Before Starting

- **Target repo confirmed:** `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus`
- **Sprint plan:** `docs/superpowers/plans/2026-08-22-voice-pipeline-sprint-plan.md`
- **Canonical spec:** `docs/superpowers/specs/2026-07-01-voice-pipeline-design.md`
- **Build plan:** `refactor/voice/sprint.md`
- **Voice reference:** `voice/optimaeus-voice-reference.wav` (64.9s, 16kHz mono, AI-generated Irish accent) — already converted

## Sprint Dependency Graph

```
Sprint 0 (Models + Voice Reference)
    |
    v
Sprint 1 (Voice Daemon Foundation)
    |
    +-----+-----+
    |           |
    v           v
Sprint 2    Sprint 3
(Backend)   (TTS Engine)
    |           |
    +-----+-----+
          |
          v
    Sprint 4 (Electron Integration)
          |
          v
    Sprint 5 (E2E + Sovereignty)
```

Sprint 2 and Sprint 3 can run in PARALLEL (different directories, zero shared files).

## Sprint Dispatch Sequence

### Sprint 0 — Models + Voice Reference (Manual + team-dev-loop)

**Owner:** User
**What:** Model downloads, wake word training, XTTS quality check
**Gate:** User confirms voice quality via manual listening test
**Code Reviewer:** Architect (lightweight — `test_xtts.py` and `meta.json` structure)
**Commit:** `feat(voice): S0 — model storage layout + XTTS verification script`

### Sprint 1 — Voice Daemon Foundation (team-dev-loop)

**Owner:** Lead
**What:** 6 new Python files in `/voice_daemon/`
**TDD first:** `test_wake_detector.py`, `test_stt_engine.py`, `test_audio_bridge.py`
**Commit:** `feat(voice): S1 — voice daemon foundation (wake + STT + audio bridge)`

### Sprint 2 — Backend Voice Service (team-dev-loop) — SECURITY GATE

**Owner:** Lead
**What:** FastAPI WS endpoint + voice session + auth + streaming
**Migration:** `0036_voice_sessions.py` (NOT 0015)
**Security:** `sec-devops` MANDATORY before git-ops
**Commit:** `feat(voice): S2 — backend voice service (WS router + session + auth + streaming)`
**PARALLEL OK:** Can run simultaneously with Sprint 3

### Sprint 3 — TTS Engine + Voice Cloning (team-dev-loop)

**Owner:** Lead
**What:** XTTS v2 integration, sentence-boundary streaming, speakability rules
**Commit:** `feat(voice): S3 — TTS engine + sentence-boundary streaming + speakability rules`
**PARALLEL OK:** Can run simultaneously with Sprint 2

### Sprint 4 — Electron Integration (team-dev-loop) — SECURITY GATE

**Owner:** Lead
**Prerequisites:** Sprint 2 AND Sprint 3 BOTH complete
**Security:** `sec-devops` MANDATORY before git-ops
**Commit:** `feat(voice): S4 — Electron integration (daemon spawn + mic capture + audio playback + VoiceIndicator)`

### Sprint 5 — E2E + Sovereignty Verification (Manual + team-dev-loop) — SECURITY GATE

**Owner:** User + Lead
**Security:** `sec-devops` MANDATORY — full sovereignty audit
**Commit:** `feat(voice): S5 — end-to-end integration + sovereignty verification`

## Key Rules

- **TDD enforced:** Failing tests BEFORE implementation in every sprint
- **Security gate:** `sec-devops` MUST run before `git-ops` in Sprints 2, 4, 5
- **Sovereignty:** Voice mode enforces `tier_constraint="local_only"` — no cloud LLM fallback ever
- **Migration:** Use `0036` (not `0015` from old specs)
- **Sprint 4 blocked until S2 + S3 both done**
- **Voice quality:** User is sole authority — manual listening test
- **No scope creep:** Only what's in the specs

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using migration 0015 from old specs | Use 0036 — latest migration is 0035 |
| Hardcoding model names (e.g. `qwen3:8b`) | Use family-based runtime discovery (spec §10A-1) |
| Starting Sprint 4 before S2 or S3 done | Gate check: both must be committed |
| Skipping sec-devops on Sprint 2 | WS auth is a security surface — mandatory review |
| Using Jarvis/Iron Man references | Voice is AI-generated Irish accent — no Demucs needed |
