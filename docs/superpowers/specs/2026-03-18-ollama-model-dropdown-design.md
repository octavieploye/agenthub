# Ollama Model Dropdown — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Problem

The model dropdown mixes hardcoded local models with dynamic data, showing models that may not exist on the machine. The dropdown needs three clean categories with accurate data sources.

## Design

### Three Model Categories

| Category | Source | Data |
|----------|--------|------|
| OLLAMA CLOUD | Static catalog (`model-catalog.ts`) | 24 cloud models, always shown |
| OLLAMA LOCAL | Ollama API (`GET localhost:11434/api/tags`) | Only models actually downloaded on the machine |
| CLAUDE | Static catalog (`model-catalog.ts`) | 3 Anthropic models, always shown |

### Display Order

1. OLLAMA CLOUD (cyan header, grouped by family)
2. OLLAMA LOCAL (teal header, grouped by family)
3. CLAUDE (amber header)

### Key Decisions

- **No filesystem scanning.** Ollama is the single source of truth for local models.
- **No user-configured model paths.** No settings UI for model directories.
- **No auto-import of GGUFs.** Users manage local models through Ollama directly (`ollama pull`, `ollama create`).
- **Drop the static `OLLAMA_LOCAL_MODELS` array.** It hardcodes 8 models that may not exist. Replace with dynamic-only fetch from Ollama API.
- **Keep the static `OLLAMA_CLOUD_MODELS` array.** Cloud models are known and fixed; no API fetch needed.
- **Refresh on dialog open.** `listAllModels()` fetches local models each time the SpawnDialog or GeneralTab opens. This catches models pulled mid-session. No polling.

## Changes Required

### 1. `src/shared/constants/model-catalog.ts`

- Remove `OLLAMA_LOCAL_MODELS` array
- Remove `ALL_OLLAMA_MODELS` (no longer needed)
- Keep `OLLAMA_CLOUD_MODELS` and `CLAUDE_MODELS` unchanged

### 2. `src/main/services/model-service.ts`

- `listAllModels()` returns `[...OLLAMA_CLOUD_MODELS, ...fetchOllamaLocalModels(), ...CLAUDE_MODELS]`
- `fetchOllamaLocalModels()` stays as-is — hits `localhost:11434/api/tags`, parses response
- Fix `parseOllamaModels()`: model IDs should use raw Ollama name (e.g., `phi3:latest`), not prefixed with `ollama-local:` — the prefix breaks invocation since `buildSpawnEnv()` passes the ID as `modelFlag` directly to the CLI
- Remove dead `fetchOllamaCloudModels()` function — cloud models come from static catalog, this function is never called

### 3. `src/renderer/src/widgets/model-pool/ModelPool.tsx`

- Already split into 3 sections (done in previous commit)
- No additional changes needed

### 4. `src/renderer/src/widgets/agent-detail/GeneralTab.tsx`

- Already split into 3 optgroups (done in previous commit)
- Remove import of `OLLAMA_LOCAL_MODELS` if present in fallback state
- Default `availableModels` should be `CLAUDE_MODELS` only (no fake local models)

### 5. `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx`

- Remove any reference to `ALL_OLLAMA_MODELS` or `OLLAMA_LOCAL_MODELS`
- Default model list should be `CLAUDE_MODELS` until async fetch completes

## Data Flow

```
SpawnDialog or GeneralTab opens
    ├── OLLAMA_CLOUD_MODELS (static, instant)
    ├── fetch localhost:11434/api/tags (async, ~100ms)
    │   └── parse → ModelCatalogEntry[] with provider='ollama-local'
    └── CLAUDE_MODELS (static, instant)

    → Merged array returned to renderer
    → UI splits by provider into 3 sections
```

## Error Handling

- If Ollama is not running: OLLAMA LOCAL section is empty, no error shown
- If Ollama returns unexpected data: graceful fallback to empty local list
- Cloud and Claude sections always appear regardless of Ollama status

## What This Does NOT Cover

- Live model switching between providers on running agents (pre-existing limitation)
- Ollama binary path detection (hardcoded to macOS, pre-existing)
- Pre-flight validation that Ollama daemon is running before spawn
