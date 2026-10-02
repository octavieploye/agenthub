---
name: notion-skills-tree
description: Notion workspace orchestrator — organizes all project, business, and entity data in Notion via MCP bridge. On-demand only. CEO/manager-level communication.
category: business-intelligence
---

# Notion Skills Tree

Autonomous Notion workspace management for the Optimaeus ecosystem. Reads `.llm/notion/` memory files, verifies against code and git, organizes everything in Notion at CEO/manager communication level.

## Role Boundary — NON-NEGOTIABLE

**Claude (you) = DISPATCHER.** You gather raw facts, assemble context, send ONE request to the bridge, and review the result.

**Bridge model (glm-5.2:cloud / gemma4:31b-cloud) = AUTHOR.** It composes CEO-level content, creates/updates Notion pages, verifies its own work.

**Claude MUST NOT:**
- Compose page content (markdown, prose, tables, headers)
- Pre-write what should appear on a Notion page
- Dictate which Notion tool to call or in what order
- Split a workflow into multiple bridge requests

**Claude MUST:**
- Gather raw facts (bullet points, key decisions, dates, names)
- Assemble full context (SKILL.md + category file + blueprint + modification protocol)
- Send ONE outcome-oriented request describing the GOAL, not the steps
- Review the bridge model's output for accuracy

**Self-check before EVERY bridge request:** Scan your outgoing user message. If it contains markdown headers (#, ##), rendered tables, paragraph-length prose, or content that could be pasted directly into a Notion page — you are authoring, not dispatching. STOP and restructure as raw facts.

---

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
3. **Memory files**: MUST read all `.llm/notion/*-notion-memory.md` files in agenthub. Skipping this is a RULE VIOLATION.
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

The bridge model works AUTONOMOUSLY. You describe the goal. The model decides which tools to call and in what order. You do NOT dictate tool sequences or pre-write content.

### Pre-Request Gate — MANDATORY before every bridge call

Before sending ANY request to the bridge, verify ALL of the following:

1. **System message includes full context?** SKILL.md + category file + workspace-blueprint.md + modification-protocol.md. If the system message is under 3,000 tokens, you have NOT included full context. STOP and re-assemble.
2. **User message contains raw facts only?** No markdown headers, no rendered tables, no paragraph prose. Facts only: bullet points, key decisions, dates, names.
3. **Request is outcome-oriented?** You describe WHAT you want achieved, not HOW to achieve it. The bridge model decides the tool sequence.
4. **It is a SINGLE request?** The entire workflow (search → compose → create/update → verify) happens in ONE request. NEVER split into multiple bridge calls. Each bridge request costs ~22K tokens for tool definitions — splitting 1 workflow into 4 requests wastes 66K tokens.

If ANY of these is NO, do NOT send the request. Fix it first.

### Correct pattern — outcome-oriented dispatch with full context

Write the system context to a temp file (it's too large for inline curl). Use Python for safe JSON handling.

```python
# Step 1 — Claude reads and assembles the context files
# (read SKILL.md, category file, workspace-blueprint.md, modification-protocol.md)

# Step 2 — Claude sends ONE outcome-oriented request
import json, subprocess

system_context = skill_md + "\n\n" + category_md + "\n\n" + blueprint_md + "\n\n" + mod_protocol_md

payload = {
    "model": "glm-5.2:cloud",
    "messages": [
        {"role": "system", "content": system_context},
        {"role": "user", "content": (
            "Goal: Create a new page titled 'Lemon Squeezy' under the Opeidos page (Commercial Products).\n\n"
            "Raw facts to include:\n"
            "- LS account created 2026-08-09, France, personal name for KYC\n"
            "- Store name: opeidos, URL: opeidos.lemonsqueezy.com\n"
            "- Decision: stay with LS over Stripe Managed Payments\n"
            "- Reason: LS has digital delivery, affiliates, email, storefront built in\n"
            "- Stripe MP now offers MoR but lacks delivery/affiliates/email/storefront\n"
            "- Affiliate plan: 20% commission, 30-day window, manual approval\n"
            "- Affiliate activation sequence: create product first, then enable, then recruit\n"
            "- JS snippet exists but should NOT be added until products are live\n\n"
            "Search for the Opeidos page, create the sub-page, compose CEO-level content "
            "from these facts, and verify the page was created correctly."
        )}
    ],
    "stream": False
}

result = subprocess.run(
    ["curl", "-s", "http://localhost:11435/api/chat",
     "-H", "Content-Type: application/json",
     "-d", json.dumps(payload)],
    capture_output=True, text=True, timeout=120
)
r = json.loads(result.stdout)
print(r["message"]["content"][:3000])
```

### WRONG pattern — DO NOT USE

```python
# WRONG: Claude composes the content and tells the model to paste it
payload = {
    "messages": [
        {"role": "system", "content": "You are a Notion workspace organizer."},  # WRONG: no full context
        {"role": "user", "content": "Create page and set content to:\n\n# Lemon Squeezy\n\n## Account Setup\n\n- **Store name:** opeidos\n..."}  # WRONG: Claude authored the content
    ]
}
# This violates: role boundary, context injection, and content authorship rules
```

### Key Notion tools available to the bridge model (24 total)

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

## Workflow — Sequential Phases with Gates

Each phase produces a named output. The next phase MUST NOT begin until the previous phase's output exists. Starting Phase N+1 without Phase N output is a RULE VIOLATION.

### Phase 1 — Gather `[Claude]`

**Output: GATHERED_FACTS** (bullet list of raw facts verified against code)

1. Read all `.llm/notion/[repo]-notion-memory.md` files
2. For each entry, verify against actual code and git history (not README/.md — code is truth)
3. Build a bullet list of verified facts to send to the bridge model

Phase 1 is NON-NEGOTIABLE. Even if you believe you already know the project state from conversation context, you MUST read the memory files and verify against code. Conversation context is not a substitute for fresh data. Skipping Phase 1 has caused stale data to propagate to Notion.

**GATE: State "PHASE 1 COMPLETE — GATHERED_FACTS ready" before proceeding.**

### Phase 2 — Organize `[Claude]`

**Output: TASK_PLAN** (list of Notion pages to create/update)

4. Assemble full context: read SKILL.md + relevant category file(s) + workspace-blueprint.md + modification-protocol.md
5. Determine what pages/databases need to be created or updated based on GATHERED_FACTS
6. For each page: note parent page, category, and whether it's new or an update

**GATE: State "PHASE 2 COMPLETE — TASK_PLAN ready, N pages to create/update" before proceeding.**

### Phase 3 — Execute `[Bridge Model — autonomous]`

**Output: EXECUTION_LOG** (list of bridge requests sent and responses received)

7. Send ONE outcome-oriented request per distinct page/task to the bridge model
8. The bridge model autonomously: searches Notion, composes CEO-level content from your raw facts, creates/updates pages, applies the modification protocol, and verifies its own work
9. Claude does NOT compose content, does NOT dictate tool sequences

**Remember:** You describe the goal and provide raw facts. The bridge model does the rest.

**GATE: State "PHASE 3 COMPLETE — N pages created/updated" before proceeding.**

### Phase 4 — Verify `[Claude via Bridge Model]`

**Output: VERIFICATION_REPORT**

10. Send a verification request to the bridge model: "Read page [ID] and confirm it contains [expected facts]"
11. Cross-reference the bridge model's report with your GATHERED_FACTS

**GATE: State "PHASE 4 COMPLETE — all pages verified" before proceeding.**

### Phase 5 — Cleanup `[Claude]`

**Output: CLEANUP_CONFIRMATION**

12. Run `~/.local/ollama-mcp-bridge/stop.sh`
13. Report summary of changes to user (or via Telegram if Telegram is ON)

## Output

- Organized Notion workspace following workspace blueprint
- Summary of what was created, updated, or flagged for review

## Constraints

- **NEVER assume** — if unclear, summon the user
- **NEVER call the Notion API directly** — no raw curl/fetch to `api.notion.com`. All Notion operations go through the bridge + cloud model. If all models fail the fallback chain, STOP and report to the user — do not extract API tokens or work around the bridge
- **NEVER use local models in active mode** — `qwen3:8b`, `gemma4:12b-mlx`, etc. are background-only. Active mode requires `glm-5.2:cloud` or `gemma4:31b-cloud` via the bridge
- **NEVER compose Notion page content** — Claude gathers, verifies, dispatches. The bridge model composes. If you catch yourself writing markdown that looks like a finished Notion page, STOP.
- **NEVER split workflows into multiple bridge requests** — one goal = one request. The bridge model handles the tool chain internally.
- **NEVER send a bridge request without full context** — system message must include SKILL.md + category file + blueprint + modification protocol. If your system message is under 3,000 tokens, it is incomplete.
- **NEVER skip Phase 1** — memory files must be read and facts verified against code before any Notion work begins.
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
| **Claude composing page content** | You are the DISPATCHER, not the author. Send raw facts only. If your user message has markdown headers or prose, you are authoring. STOP. |
| **Sending minimal system message** | System message MUST include SKILL.md + category file + blueprint + modification protocol. Under 3,000 tokens = incomplete. |
| **Splitting workflow into multiple requests** | ONE goal = ONE request. The bridge model handles search → compose → create → verify internally. |
| **Skipping Phase 1 (memory file gathering)** | Phase 1 is non-negotiable. Read .llm/notion/ files and verify against code BEFORE any Notion work. |
| Trusting README for stack summary | Read actual source code and package.json |
| Writing without checking existing pages | Always search Notion first to avoid duplicates |
| Using developer jargon | The bridge model writes at CEO/manager level — ensure your raw facts are clear enough for it to do so |
| Modifying without the 5-question protocol | Stop, answer WHAT/WHERE/WHY/WHEN/HOW first |
| Leaving bridge running | Always run stop.sh when done |
| Using local models in active mode | Active mode = `glm-5.2:cloud` or `gemma4:31b-cloud` only. Local models are background-only |
| Bypassing bridge with direct API calls | NEVER call api.notion.com directly. If all models fail, STOP and report — do not extract tokens |
| Not following fallback chain | Retry same model → switch to other primary → try `gemma4:cloud` → STOP after 3 failures |
| Guessing when confused | Summon the user — never assume |
