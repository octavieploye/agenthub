---
name: notion-skills-tree
description: Notion workspace orchestrator — organizes all project, business, and entity data in Notion via MCP bridge. On-demand only. CEO/manager-level communication.
category: business-intelligence
---

# Notion Skills Tree

Autonomous Notion workspace management for the Optimaeus ecosystem. Reads `.llm/notion/` memory files, verifies against code and git, organizes everything in Notion at CEO/manager communication level.

## When to Use

- After a long task completes (sprint, research, architecture change)
- After a significant tech change (e.g., Clerk → Better Auth)
- After business, marketing, or financial research completes
- After a deployment or production status change
- When a new repo/project is discovered
- On manual request from the user
- Lead agent triggers after completing major work

## What You Need Before Starting

1. **Bridge**: Run `~/.local/ollama-mcp-bridge/start.sh` — starts Notion MCP bridge on port 11435
2. **Token**: `NOTION_API_KEY` must be set in `agenthub/.env`
3. **Memory files**: Read all `.llm/notion/*-notion-memory.md` files in agenthub
4. **Model**: Use Ollama Cloud via bridge (`localhost:11435`)

## LLM Selection

### Active mode (AgentHub running, user present)

Primary models (both proven, use either or both in parallel):
- `glm-5.2:cloud` — proven tool calling, fast
- `gemma4:31b-cloud` — strong reasoning + tool calling

Fallback: `gemma4:cloud` — lighter cloud option if both primaries fail.

### Parallel requests

When multiple Notion operations are needed (e.g., update 3 pages), send them in parallel using BOTH models:
- Request 1 → `glm-5.2:cloud`
- Request 2 → `gemma4:31b-cloud`
- Request 3 → `glm-5.2:cloud`

The bridge handles concurrent requests. Each request is independent.

### Background mode (user out, test when ready)

Priority order:
1. `gemma4:12b-mlx` — Apple Silicon optimized, test pending
2. `gemma4:e4b-mlx` — smaller MLX variant, test pending
3. `qwen3:8b` — downloaded, test pending

### Context strategy (tested 2026-08-08)

Always send **full context** — the skill tree overhead is only ~3,800 tokens on top of the 22K tool definitions base. This enables the model to work **autonomously**: compose CEO-level content, follow the workspace blueprint, apply modification protocol, and verify its own work.

System message must include:
1. SKILL.md (this file)
2. The relevant category file(s) for the task
3. workspace-blueprint.md (if creating/reorganizing pages)

The model handles multi-step workflows in one request: search → compose → create/update → verify → report.

### Failure rules

- If model fails tool calling once → retry with same model
- If fails twice → switch to the other primary model
- After both primaries fail → try `gemma4:cloud`
- After 3 model failures → stop, report to user, do NOT keep retrying

## Bridge Lifecycle

```
1. Start:  ~/.local/ollama-mcp-bridge/start.sh
2. Work:   All Notion operations via localhost:11435
3. Stop:   ~/.local/ollama-mcp-bridge/stop.sh
```

Bridge is on-demand. Never leave running after work is done. The start script reads the token from `.env` at launch — token never persists in config files.

## How to Call the Bridge

The lead agent (Claude) orchestrates Notion work by sending HTTP requests to the bridge. The bridge injects 24 Notion MCP tools and routes to the selected Ollama Cloud model, which performs the actual tool calling.

### Basic pattern (single request)

```bash
curl -s http://localhost:11435/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "glm-5.2:cloud",
    "messages": [
      {"role": "system", "content": "You are a Notion workspace organizer. Use the Notion MCP tools provided."},
      {"role": "user", "content": "Search for page titled X using API-post-search"}
    ],
    "stream": false
  }'
```

### For content with special characters (use Python for safe JSON)

```bash
python3 -c "
import json, subprocess
payload = {
    'model': 'glm-5.2:cloud',
    'messages': [
        {'role': 'system', 'content': 'You are a Notion workspace organizer. Use API-update-page-markdown to replace page content.'},
        {'role': 'user', 'content': 'Replace content of page PAGE_ID with this markdown:\n\n# Title\n\nContent here'}
    ],
    'stream': False
}
result = subprocess.run(
    ['curl', '-s', 'http://localhost:11435/api/chat', '-H', 'Content-Type: application/json', '-d', json.dumps(payload)],
    capture_output=True, text=True, timeout=90
)
r = json.loads(result.stdout)
print(r['message']['content'][:2000])
"
```

### Key Notion tools available (24 total)

| Tool | Use for |
|---|---|
| `API-post-search` | Find existing pages by title |
| `API-post-page` | Create new pages |
| `API-patch-page` | Update page properties |
| `API-retrieve-page-markdown` | Read page content |
| `API-update-page-markdown` | Replace page content with markdown |
| `API-retrieve-a-page` | Get page metadata |
| `API-create-a-comment` | Add comments to pages |
| `API-query-data-source` | Query databases |
| `API-create-a-data-source` | Create databases |

### Fallback chain

If `glm-5.2:cloud` fails tool calling (returns error or ignores tools):
1. Retry once with same model
2. Switch to `gemma4:31b-cloud`
3. If that also fails, switch to `gemma4:cloud`
4. After 3 model failures → stop, report to user, do NOT keep retrying

### Reading the response

The bridge returns standard Ollama chat format. Parse the model's answer:

```python
r = json.loads(result.stdout)
content = r['message']['content']  # model's text response
# Tool calls are handled internally by the bridge — you get the final result
```

## Workflow

### Phase 1 — Gather

1. Read all `.llm/notion/[repo]-notion-memory.md` files
2. For each entry, verify against actual code and git history (not README/.md — code is truth)
3. Build a task list of what needs to be created or updated in Notion

### Phase 2 — Organize

4. Check current Notion workspace state (search existing pages)
5. Determine what pages/databases exist vs what needs to be created
6. Follow the workspace blueprint (`workspace-blueprint.md`)

### Phase 3 — Execute

7. Create or update pages following category-specific instructions (see category files)
8. Apply the modification protocol for any changes (`modification-protocol.md`)
9. Use CEO/manager-level communication — before rendering any content, ask yourself:
   - What is the goal of this page/section?
   - What is the message?
   - What is relevant for a CEO reading this?
   - Where does it go in the hierarchy?
   - Why does it exist?
   - How should it be rendered (database, table, page, list)?
   - When was this last true? (staleness check)

### Phase 4 — Verify

10. Re-read created/updated pages to confirm accuracy
11. Cross-reference with source data (code, git, memory files)

### Phase 5 — Cleanup

12. Run `~/.local/ollama-mcp-bridge/stop.sh`
13. Report summary of changes to user (or via Telegram if Telegram is ON)

## Output

- Organized Notion workspace following workspace blueprint
- Summary of what was created, updated, or flagged for review

## Constraints

- **NEVER assume** — if unclear, summon the user
- **NEVER call the Notion API directly** — no raw curl/fetch to `api.notion.com`. All Notion operations go through the bridge + cloud model. If all models fail the fallback chain, STOP and report to the user — do not extract API tokens or work around the bridge
- **NEVER use local models in active mode** — `qwen3:8b`, `gemma4:12b-mlx`, etc. are background-only. Active mode requires `glm-5.2:cloud` or `gemma4:31b-cloud` via the bridge
- **Code is truth** — verify stack summaries against actual code, not README or .md plans
- **Check git history** — `git log` tells you what actually happened
- **Modification protocol is mandatory** — see `modification-protocol.md`
- **Deletion requires human approval** — never delete pages autonomously
- **Append-only default** — new content goes at end, existing content untouched unless modification protocol is followed
- **Double-check all data** — cross-reference before writing to Notion
- **No confident external facts** — if stating something about an external tool/service, express uncertainty

## Category Files

Load the relevant category file(s) based on what you are doing:

| Category | File | Use when |
|---|---|---|
| Project sync | `cat-project-sync.md` | Creating/updating project pages, stack summaries |
| Sprint & status | `cat-sprint-status.md` | Sprint reports, deployment, progress |
| Todos & tasks | `cat-todo-tasks.md` | Human vs agent tasks, Future/Present/Now |
| Architecture | `cat-architecture.md` | Tech decisions, stack changes |
| Research intel | `cat-research-intel.md` | Business/marketing/financial analysis |
| Entity map | `cat-entity-map.md` | Neuronal system entities, cross-entity |
| Commercial | `cat-commercial.md` | Commercial products, pricing, offers, revenue |

## Common Mistakes

| Mistake | Fix |
|---|---|
| Trusting README for stack summary | Read actual source code and package.json |
| Writing without checking existing pages | Always search Notion first to avoid duplicates |
| Using developer jargon | Write at CEO/manager level |
| Modifying without the 5-question protocol | Stop, answer WHAT/WHERE/WHY/WHEN/HOW first |
| Leaving bridge running | Always run stop.sh when done |
| Using local models in active mode | Active mode = `glm-5.2:cloud` or `gemma4:31b-cloud` only. Local models are background-only |
| Bypassing bridge with direct API calls | NEVER call api.notion.com directly. If all models fail, STOP and report — do not extract tokens |
| Not following fallback chain | Retry same model → switch to other primary → try `gemma4:cloud` → STOP after 3 failures |
| Guessing when confused | Summon the user — never assume |
