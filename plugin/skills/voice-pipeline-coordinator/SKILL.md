---
name: voice-pipeline-coordinator
description: Voice Pipeline Coordinator — orchestrates OPTimaeus voice layer build across 6 sprints (S0-S5) with VoxCPM2 TTS, TDD gates, security reviews. Dispatches team-dev-loop, sec-devops, git-ops.
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
- **Sprint plan:** `docs/sprints/voice-pipeline-voxcpm2-sprint-plan.md`
- **Orchestration check:** `docs/sprints/voice-pipeline-voxcpm2-orchestration-check.md`
- **Canonical spec:** `docs/superpowers/specs/2026-07-01-voice-pipeline-design.md`
- **Build plan (legacy, XTTS sections superseded):** `refactor/voice/sprint.md`
- **Voice references:**
  - `voice/optimaeus-voice-reference.wav` (64.9s, 16kHz mono, AI-generated Irish accent)
  - `voice/kate-winslet-voice-ref.wav` (28s, 16kHz mono, Demucs-extracted)

## TTS Model

- **Model:** VoxCPM2 2B, 8-bit quantized
- **Package:** `mlx-audio>=0.4.4` (MLX-native, NO torch dependency for TTS)
- **Model ID:** `mlx-community/VoxCPM2-8bit` (3.22 GB)
- **Output:** 48kHz (built-in super-resolution from 16kHz reference input)
- **License:** Apache 2.0
- **Offline:** `HF_HUB_OFFLINE=1` works after one-time download
- **Note:** `torch` is still required for `silero-vad` only

## Sprint Dependency Graph

```
Sprint 0 (VoxCPM2 Setup + Voice Refs)
    |
    v
Sprint 1 (Voice Daemon Foundation)
    |
    v
Sprint 2 (Backend Voice Service) — SECURITY GATE
    |
    v
Sprint 3 (VoxCPM2 TTS Engine) — COMPLETE REWRITE
    |
    v
Sprint 4 (Electron Integration) — SECURITY GATE
    |
    v
Sprint 5 (E2E + Sovereignty) — SECURITY GATE
```

All sprints are SEQUENTIAL. S2 and S3 were originally parallel but share the same executor (dev-backend), so they run sequentially. S2 first (defines WS protocol), then S3 (wires TTS into daemon).

## Sprint Dispatch Sequence

### Sprint 0 — VoxCPM2 Model Setup + Voice Reference Verification

**Owner:** User + Lead
**What:** Replace coqui-tts with mlx-audio, download VoxCPM2-8bit, rewrite test script, verify both voice references, deploy Kate Winslet reference
**Gate:** User confirms voice quality via manual listening test (`python voice/test_tts.py --listen`)
**Code Reviewer:** Architect (lightweight — `test_tts.py` and `meta.json` structure)
**Commit:** `feat(voice): S0 — VoxCPM2 model setup + voice reference verification`

Steps:
1. Update `voice/requirements-voice.txt`: remove `coqui-tts`, `transformers`, `torchaudio`; add `mlx-audio>=0.4.4`
2. Reinstall `.venv-voice`, verify mlx-audio loads and coqui-tts is absent
3. Download VoxCPM2-8bit model (~3.22 GB)
4. Rename `~/models/voice/tts/xtts-v2/` → `voxcpm2/`
5. Deploy Kate Winslet reference to `~/models/voice/references/` with meta.json
6. Update `optimaeus-voice-reference.meta.json` target_model → VoxCPM2
7. TDD: Write `voice/test_tts.py` (replaces `test_xtts.py`) — VoxCPM2 API, 48kHz assertions, `--ref optimaeus` and `--ref kate` flags
8. Run automated gate with both references
9. User runs `--listen` manual quality gate
10. Delete `voice/test_xtts.py`
11. Verify `HF_HUB_OFFLINE=1` works
12. `git-ops` commits

### Sprint 1 — Voice Daemon Foundation (team-dev-loop)

**Owner:** Lead
**What:** 6 new Python files in `/voice_daemon/`
**TDD first:** `test_config.py`, `test_wake_detector.py`, `test_stt_engine.py`
**Commit:** `feat(voice): S1 — voice daemon foundation`

Steps:
1. Write failing tests (pytest) — config validation, wake word detection, STT transcription, WebSocket state machine
2. Dispatch `team-dev-loop` (dev-backend): implement config (tts_model_id, tts_sample_rate=48000), wake_detector, stt_engine, audio_bridge (sampleRate: 48000), voice_daemon (TTS placeholder for S3)
3. `tester-backend` reviews test coverage
4. `architect` reviews daemon architecture and state machine
5. `git-ops` commits

### Sprint 2 — Backend Voice Service (team-dev-loop) — SECURITY GATE

**Owner:** Lead
**What:** FastAPI WS endpoint + voice session + auth + streaming
**TDD first:** `test_voice_service.py`
**Migration:** `0036_voice_sessions.py` (NOT 0015)
**Security:** `sec-devops` MANDATORY before git-ops
**Commit:** `feat(voice): S2 — backend voice service + WS streaming`

Steps:
1. Write failing tests (pytest)
2. Dispatch `team-dev-loop` (dev-backend): auth, models, migration 0036, session, router, config additions, agent_service.run_stream(), prompt_compiler voice mode
3. `tester-backend` reviews
4. `architect` reviews WS protocol (48kHz sample rate declaration) and tier enforcement
5. **`sec-devops` security scan** — WS auth, key leakage, unauthorized LLM access, local-only enforcement
6. Resolve any CRITICAL findings
7. `git-ops` commits

### Sprint 3 — VoxCPM2 TTS Engine (team-dev-loop) — COMPLETE REWRITE

**Owner:** Lead
**What:** New TTS engine using mlx-audio VoxCPM2, sentence-boundary streaming, speakability rules
**TDD first:** `test_tts_engine.py`, `test_speakability.py`, `test_sentence_splitter.py`
**Commit:** `feat(voice): S3 — VoxCPM2 TTS engine + sentence-boundary streaming`

Steps:
1. Write failing tests (pytest) — model loading, 48kHz output, streaming iterator, voice reference swap, speakability filter, sentence splitting
2. Dispatch `team-dev-loop` (dev-backend): tts_engine.py (mlx_audio.tts.utils.load, model.generate iterator), speakability.py, sentence_splitter.py, SET_REFERENCE handler, macOS say fallback
3. Wire TTS + sentence-boundary coordinator into voice_daemon.py
4. `tester-backend` reviews edge cases (empty text, long sentences, unicode)
5. `architect` reviews streaming architecture and memory pressure
6. `git-ops` commits

### Sprint 4 — Electron Integration (team-dev-loop) — SECURITY GATE

**Owner:** Lead
**What:** Daemon spawn, mic capture, 48kHz audio playback, VoiceIndicator UI
**Prerequisites:** Sprint 2 AND Sprint 3 BOTH complete
**TDD first:** `tester-frontend` writes failing tests BEFORE dev-frontend implements
**Security:** `sec-devops` MANDATORY before git-ops
**Commit:** `feat(voice): S4 — Electron integration + 48kHz audio playback`

Steps:
1. **GATE CHECK:** Verify Sprint 2 AND Sprint 3 are both committed
2. `tester-frontend` writes failing tests (vitest) for VoiceIndicator, voiceStore, voicePlayback
3. Dispatch `team-dev-loop` (dev-frontend + dev-integration): voice-daemon-launcher.ts, voice.ipc.ts, preload.ts updates, voiceStore (Zustand), voiceCapture (16kHz), voicePlayback (48kHz AudioContext), VoiceIndicator, voice.d.ts, main.ts updates, NSMicrophoneUsageDescription
4. `tester-frontend` reviews UI state transitions
5. `architect` reviews IPC contract and daemon lifecycle
6. **`sec-devops` security scan** — daemon spawn env, mic access, IPC injection, localhost-only WS
7. Resolve any CRITICAL findings
8. `git-ops` commits

### Sprint 5 — E2E + Sovereignty Verification (Manual + team-dev-loop) — SECURITY GATE

**Owner:** User + Lead
**What:** Full pipeline validation, sovereignty audit, latency profiling
**TDD first:** `test_e2e.py`
**Security:** `sec-devops` MANDATORY — full sovereignty audit
**Commit:** `feat(voice): S5 — E2E integration + sovereignty verification`

Steps:
1. Write E2E test (pytest) — pre-recorded WAV through pipeline
2. Dispatch `team-dev-loop`: implement E2E test
3. User runs manual tests: E2E flow, interruption, false positive (10 min), context injection
4. User measures latency with `powermetrics`
5. **`sec-devops` full sovereignty audit** — all components Tier 1, HF_HUB_OFFLINE=1, no cloud fallback, audit trail, no raw audio on disk
6. Write Anamnesis decision record
7. `git-ops` commits

## Key Rules

- **TDD enforced:** Failing tests BEFORE implementation in every sprint
- **Security gate:** `sec-devops` MUST run before `git-ops` in Sprints 2, 4, 5
- **Sovereignty:** Voice mode enforces `tier_constraint="local_only"` — no cloud LLM fallback ever
- **TTS model:** VoxCPM2-8bit via mlx-audio — NOT XTTS v2 (dead company)
- **Output sample rate:** 48kHz throughout pipeline (capture remains 16kHz)
- **Migration:** Use `0036` (not `0015` from old specs)
- **Sequential sprints:** S0 → S1 → S2 → S3 → S4 → S5 (no parallel execution)
- **3-agent concurrency:** Max 3 agents active at once (per project rules)
- **Sprint 4 blocked until S2 + S3 both done**
- **Voice quality:** User is sole authority — 5 standardized test phrases, manual listening test
- **No scope creep:** Only what's in the sprint plan — do not add features

## Output

- Per-sprint: committed code with passing tests + security clearance (where required)
- Final: fully functional voice pipeline validated E2E with sovereignty audit

## Constraints

- Never skip TDD gate — tests first, always
- Never skip security gate on Sprints 2, 4, 5
- Never start Sprint 4 until both S2 and S3 are committed
- Never allow cloud LLM fallback for voice mode
- Never store raw audio to disk — transcripts only
- Never modify existing brain_core, audit_service interface, or existing schemas
- Never use XTTS v2 / Coqui TTS — company is dead, model abandoned

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using XTTS v2 / coqui-tts | Use VoxCPM2 via mlx-audio — Coqui is dead |
| Using migration 0015 from old specs | Use 0036 — latest migration is 0035 |
| Setting sample rate to 24000 | VoxCPM2 outputs 48kHz — update all pipeline references |
| Importing torch for TTS | mlx-audio is MLX-only, no torch needed for TTS |
| Running S2 and S3 in parallel | Sequential — both use dev-backend executor |
| Hardcoding model names (e.g. `qwen3:8b`) | Use family-based runtime discovery (spec §10A-1) |
| Starting Sprint 4 before S2 or S3 done | Gate check: both must be committed |
| Mocking voice daemon internals in tests | Use real WebSocket connections, real audio buffers |
| Skipping sec-devops on Sprint 2 | WS auth is a security surface — mandatory review |
| Using old sprint plan references | Use `docs/sprints/voice-pipeline-voxcpm2-sprint-plan.md` |
