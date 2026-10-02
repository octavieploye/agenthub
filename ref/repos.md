# Repo Gate
_Last reviewed: 2026-10-02_

This workspace dispatches agents to many repos. The user ALWAYS works from agenthub (skills live here). Agents are pointed to the target repo via the prompt.

| Repo | Local path | Purpose |
|---|---|---|
| `agenthub` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub` | Owner's personal dev tool — pre-configured, NO commercial features |
| `hephaestus` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/hephaestus` | Commercial product — wizard, onboarding, public-facing UX |
| `hephaestus-sovereign` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/hephaestus-sovereign` | Sovereign fork — OpenCode replaces Claude CLI |
| `data-gouv-hub` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/data-gouv-hub` | Data governance hub |
| `oxy` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/oxy` | Oxy — uncensored LLM chat harness (Qwen3 abliterated) |
| `llm-workflows-pckg` | `/Users/octaviesmacpro/workspace/optimaeus-stacks/llm-workflows-pckg` | LLM workflow packages |
| `opeidos` | `/Users/octaviesmacpro/workspace/optimaeus-projects/opeidos` | Commercial marketplace — AI Expert Packs |
| `opeidos-fraud-admin` | `/Users/octaviesmacpro/workspace/optimaeus-projects/opeidos-fraud-admin` | Opeidos fraud/admin panel |
| `optimaeus` | `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus` | OPTimaeus — head entity |
| `optimaeus-commercial` | `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-commercial` | OPTimaeus commercial product |
| `optimaeus-llm` | `/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-llm` | Shared LLM provider package |
| `anamnesis` | `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis` | Memory system — FastAPI+PG+Memgraph+Qdrant |
| `anamnesis-commercial` | `/Users/octaviesmacpro/workspace/optimaeus-projects/anamnesis-commercial` | Anamnesis commercial product |
| `workflow-server-api` | `/Users/octaviesmacpro/workspace/optimaeus-projects/workflow-server-api` | Workflow execution server API |

**Routing rules:**
- Commercial-only features (setup wizard, onboarding, in-app purchase, public UX) → **`hephaestus` ONLY**
- Core tooling improvements for the owner's workflow → **`agenthub` first**, port to `hephaestus` selectively and explicitly
- **NEVER assume the current working directory (`agenthub`) is the correct target repo**
- When the user or prompt specifies a repo from this table, accept it — do NOT ask "is this agenthub or hephaestus?"

**Before writing a single line of code, the agent MUST:**
1. State which repo it will modify (full local path) and why that repo and not the other
2. Wait for explicit user confirmation — _"yes, correct repo"_ or _"no, use [other repo]"_
3. Select the appropriate team/workflow/skill for the task (all skills are always available to agents); dispatch multi-step work via the kanban orchestrator. _Changed 2026-10-02 — was "invoke `team-impl-lead` mandatory"; no single process skill is a gate anymore._
4. Only proceed after both the repo confirmation AND the team workflow are in place

Skipping this gate is not acceptable.
