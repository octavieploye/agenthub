# Ollama Cloud Model Integration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Register all known Ollama models (cloud and local) in the shared model catalog so they are always presented and invoked correctly in SpawnDialog, with provider automatically derived from the model ID.

**Architecture:** Add an `OLLAMA_MODELS` catalog constant mirroring `CLAUDE_MODELS`; tag each entry as `ollama-cloud` or `ollama-local`; derive provider automatically from the `:cloud` suffix so no manual provider selection is needed; move the model reference file to `.claude/models/` so it is committed, distributed via GitHub, and present in every worktree.

**Tech Stack:** TypeScript, `src/shared/constants/model-catalog.ts`, `src/shared/types/model.types.ts`, `src/main/services/model-dispatcher.ts`

---

## Pre-Work: File Relocation (no code change)

**Action required from user (not the agent):**

Move `docs/ollama-cloud-path.md` → `.claude/models/ollama-models.md`

**Why this location:**
- `.claude/` is always committed to git → goes to GitHub
- Every worktree inherits `.claude/` on creation
- `docs/` is also committed but is for user-facing documentation, not dev tooling reference
- Agents scaffolded in any worktree will have the model list at a consistent, predictable path

Once moved, the path is `.claude/models/ollama-models.md` — reference this in `CLAUDE.md` so all agents know to look there.

---

## Chunk 1: Model Type Extension + Catalog

### Task 1: Add `requiresCloud` field to `ModelCatalogEntry`

**Files:**
- Modify: `src/shared/types/model.types.ts`

- [ ] **Step 1: Read current type**

Read `src/shared/types/model.types.ts` to understand existing shape.

- [ ] **Step 2: Add `requiresCloud` optional boolean field**

Add to `ModelCatalogEntry`:
```ts
requiresCloud?: boolean   // true = needs Ollama cloud proxy (model id ends in :cloud)
```

- [ ] **Step 3: Write failing type-check test**

Verify via `tsc --noEmit` that the field is recognized.

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/model.types.ts
git commit -m "feat(models): add requiresCloud field to ModelCatalogEntry"
```

---

### Task 2: Add `OLLAMA_MODELS` catalog constant

**Files:**
- Modify: `src/shared/constants/model-catalog.ts`

- [ ] **Step 1: Add cloud models (require Ollama cloud proxy)**

Append to `model-catalog.ts`:
```ts
export const OLLAMA_CLOUD_MODELS: ModelCatalogEntry[] = [
  { id: 'kimi-k2-thinking:cloud',    name: 'Kimi K2 Thinking',     provider: 'ollama-cloud', category: 'thinking', contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'kimi-k2.5:cloud',           name: 'Kimi K2.5',            provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'kimi-k2:1t-cloud',          name: 'Kimi K2 1T',           provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'mistral-large-3:675b-cloud',name: 'Mistral Large 3 675B', provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'minimax-m2.5:cloud',        name: 'MiniMax M2.5',         provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'glm-5:cloud',               name: 'GLM-5',                provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'glm-4.7:cloud',             name: 'GLM-4.7',              provider: 'ollama-cloud', category: 'mixed',    contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
  { id: 'deepseek-v3.2:cloud',       name: 'DeepSeek V3.2',        provider: 'ollama-cloud', category: 'coding',   contextWindow: 128000, available: true, requiresCloud: true, supportsEffort: false },
]
```

- [ ] **Step 2: Add local Ollama models**

```ts
export const OLLAMA_LOCAL_MODELS: ModelCatalogEntry[] = [
  { id: 'devstral-2',        name: 'Devstral 2',         provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'ministral-3',       name: 'Ministral 3',        provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'gpt-oss',           name: 'GPT OSS',            provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'qwen3-coder',       name: 'Qwen3 Coder',        provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'qwen3-coder-next',  name: 'Qwen3 Coder Next',   provider: 'ollama-local', category: 'coding', contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'qwen3-vl',          name: 'Qwen3 VL',           provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'qwen3.5',           name: 'Qwen3.5',            provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
  { id: 'nemotron-3-super',  name: 'Nemotron 3 Super',   provider: 'ollama-local', category: 'mixed',  contextWindow: 64000, available: true, requiresCloud: false, supportsEffort: false },
]
```

- [ ] **Step 3: Export combined constant**

```ts
export const ALL_OLLAMA_MODELS: ModelCatalogEntry[] = [
  ...OLLAMA_CLOUD_MODELS,
  ...OLLAMA_LOCAL_MODELS
]
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants/model-catalog.ts
git commit -m "feat(models): add OLLAMA_CLOUD_MODELS and OLLAMA_LOCAL_MODELS to catalog"
```

---

## Chunk 2: Provider Auto-Derivation

### Task 3: Add `deriveProvider` helper in model-dispatcher

**Files:**
- Modify: `src/main/services/model-dispatcher.ts`
- Modify: `src/main/services/model-dispatcher.test.ts`

**Context:** Currently `buildSpawnEnv` accepts `provider` as an explicit argument. The risk is that a caller passes `ollama-local` for a `:cloud` model (or vice versa) and the env is still set up correctly (both route to localhost:11434) but semantics are wrong. We want a single source of truth: model ID drives the provider label.

- [ ] **Step 1: Write failing test**

In `model-dispatcher.test.ts`, add:
```ts
import { deriveProvider } from './model-dispatcher'

describe('deriveProvider', () => {
  it('returns ollama-cloud for model ids ending in :cloud', () => {
    expect(deriveProvider('kimi-k2-thinking:cloud')).toBe('ollama-cloud')
    expect(deriveProvider('deepseek-v3.2:cloud')).toBe('ollama-cloud')
  })

  it('returns ollama-local for model ids without :cloud', () => {
    expect(deriveProvider('devstral-2')).toBe('ollama-local')
    expect(deriveProvider('qwen3-coder')).toBe('ollama-local')
  })

  it('returns anthropic for claude model ids', () => {
    expect(deriveProvider('claude-sonnet-4-6')).toBe('anthropic')
    expect(deriveProvider('claude-opus-4-20250514')).toBe('anthropic')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run src/main/services/model-dispatcher.test.ts`
Expected: FAIL — `deriveProvider` not exported

- [ ] **Step 3: Implement `deriveProvider`**

Add to `model-dispatcher.ts`:
```ts
export function deriveProvider(modelId: string): ModelProvider {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (modelId.endsWith(':cloud')) return 'ollama-cloud'
  return 'ollama-local'
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx vitest run src/main/services/model-dispatcher.test.ts`
Expected: PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/main/services/model-dispatcher.ts src/main/services/model-dispatcher.test.ts
git commit -m "feat(dispatcher): add deriveProvider to auto-detect provider from model id"
```

---

### Task 4: Use `deriveProvider` in agent spawn path

**Files:**
- Modify: `src/main/services/agent-manager.ts`

**Context:** When an agent is spawned, find where `buildSpawnEnv` is called with the model and provider. Add a call to `deriveProvider(model)` before `buildSpawnEnv` to guarantee the provider is always consistent with the model ID, regardless of what the caller passed.

- [ ] **Step 1: Read the spawn function in agent-manager.ts**

Read `src/main/services/agent-manager.ts` — find the `spawnAgent` function and where `buildSpawnEnv` is called.

- [ ] **Step 2: Insert `deriveProvider` call**

Before `buildSpawnEnv(model, provider)`, add:
```ts
const resolvedProvider = deriveProvider(model)
```

Replace the `provider` argument in `buildSpawnEnv` with `resolvedProvider`. Also store `resolvedProvider` in the agent state so the UI shows the correct badge.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/main/services/agent-manager.ts
git commit -m "fix(spawn): resolve provider from model id at spawn time to prevent mismatch"
```

---

## Chunk 3: SpawnDialog Model Pool Integration

### Task 5: Include Ollama models in SpawnDialog

**Files:**
- Modify: `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx`

**Context:** `SpawnDialog` currently initializes `availableModels` from `CLAUDE_MODELS.map(catalogToModelInfo)`. We need to include ollama models. The dynamic `loadingModels` path fetches running ollama models via IPC — ollama catalog entries marked `available: false` when ollama is not running. For now, surface all catalog entries and let the existing availability flag do the work.

- [ ] **Step 1: Import `ALL_OLLAMA_MODELS`**

In `SpawnDialog.tsx`, import:
```ts
import { CLAUDE_MODELS, ALL_OLLAMA_MODELS, EFFORT_LEVELS, EFFORT_LABELS } from '@shared/constants/model-catalog'
```

- [ ] **Step 2: Merge into initial state**

Change:
```ts
const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
  CLAUDE_MODELS.map(catalogToModelInfo)
)
```

To:
```ts
const [availableModels, setAvailableModels] = useState<ModelInfo[]>(
  [...CLAUDE_MODELS, ...ALL_OLLAMA_MODELS].map(catalogToModelInfo)
)
```

- [ ] **Step 3: Ensure `requiresCloud` is passed through `catalogToModelInfo`**

In `catalogToModelInfo`, add:
```ts
requiresCloud: entry.requiresCloud
```

And add `requiresCloud?: boolean` to the `ModelInfo` type in `ModelPool.tsx`.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx
git add src/renderer/src/widgets/model-pool/ModelPool.tsx
git commit -m "feat(spawn-dialog): include ollama cloud and local models in model pool"
```

---

## Chunk 4: Reference File + CLAUDE.md Update

### Task 6: Move and update the model reference file

**Action — user performs the file move:**

```bash
mkdir -p .claude/models
mv docs/ollama-cloud-path.md .claude/models/ollama-models.md
```

- [ ] **Step 1: Reformat `.claude/models/ollama-models.md`**

Update the file content to clearly mark cloud vs local:

```markdown
# Ollama Models Reference

> This file is the source of truth for available Ollama models.
> Location: `.claude/models/ollama-models.md`
> Distributed via git — present in every worktree.

## Cloud Models (require Ollama cloud proxy — model id ends in `:cloud`)

These models are fetched remotely by the local Ollama server. Internet access required.

| Model ID                     | Name                  |
|------------------------------|-----------------------|
| kimi-k2-thinking:cloud       | Kimi K2 Thinking      |
| kimi-k2.5:cloud              | Kimi K2.5             |
| kimi-k2:1t-cloud             | Kimi K2 1T            |
| mistral-large-3:675b-cloud   | Mistral Large 3 675B  |
| minimax-m2.5:cloud           | MiniMax M2.5          |
| glm-5:cloud                  | GLM-5                 |
| glm-4.7:cloud                | GLM-4.7               |
| deepseek-v3.2:cloud          | DeepSeek V3.2         |

## Local Models (run entirely on local Ollama — no cloud call)

| Model ID           | Name              |
|--------------------|-------------------|
| devstral-2         | Devstral 2        |
| ministral-3        | Ministral 3       |
| gpt-oss            | GPT OSS           |
| qwen3-coder        | Qwen3 Coder       |
| qwen3-coder-next   | Qwen3 Coder Next  |
| qwen3-vl           | Qwen3 VL          |
| qwen3.5            | Qwen3.5           |
| nemotron-3-super   | Nemotron 3 Super  |

## How Ollama Cloud Works in AgentHub

Both cloud and local Ollama models are invoked the same way at the env level:
- `ANTHROPIC_BASE_URL=http://localhost:11434`
- `ANTHROPIC_AUTH_TOKEN=ollama`
- `--model <model-id>`

The Ollama server at localhost:11434 detects the `:cloud` suffix and proxies to the remote provider automatically.
Provider is auto-derived in code via `deriveProvider()` in `model-dispatcher.ts` — never set manually.
```

- [ ] **Step 2: Update `CLAUDE.md` Key Files section**

Add a line:
```
- `.claude/models/ollama-models.md` — Ollama model reference (cloud vs local), present in every worktree
```

- [ ] **Step 3: Commit**

```bash
git add .claude/models/ollama-models.md .claude/CLAUDE.md
git commit -m "docs(models): move ollama model reference to .claude/models for worktree distribution"
```

---

## Summary: What Changed and Why

| Layer | Change | Reason |
|---|---|---|
| `docs/ollama-cloud-path.md` | Moved to `.claude/models/ollama-models.md` | Worktree distribution via git |
| `model.types.ts` | Added `requiresCloud?: boolean` | Semantic tagging per model |
| `model-catalog.ts` | Added `OLLAMA_CLOUD_MODELS`, `OLLAMA_LOCAL_MODELS`, `ALL_OLLAMA_MODELS` | Single source of truth for all models |
| `model-dispatcher.ts` | Added `deriveProvider(modelId)` | Auto-derive provider from model ID — prevents mismatch |
| `agent-manager.ts` | Use `deriveProvider` at spawn time | Guarantee correctness regardless of caller |
| `SpawnDialog.tsx` | Merge ollama models into initial pool | UI shows full model list |

**No new files needed beyond the model reference move. No spawn command format changes — `buildSpawnEnv` already works correctly for both cloud and local ollama.**
