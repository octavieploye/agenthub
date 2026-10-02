# [OPTIMAEUS-UNIVERSAL-IMPORT]
# Optimaeus Universal Standards — imported automatically by Claude Code.
# Source: /Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-llm/UNIVERSAL-STANDARDS.md
# Do not edit this block manually — re-run bootstrap-universal.sh to update.
@/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-llm/UNIVERSAL-STANDARDS.md
# Entity definition for hephaestus:
@/Users/octaviesmacpro/workspace/optimaeus-projects/optimaeus-llm/entities/hephaestus.md
# [/OPTIMAEUS-UNIVERSAL-IMPORT]

@.claude/how-to-index.md

---

_Last reviewed: 2026-10-02_

# Precedence and Decisions (read first — this section wins over every other rule in this file)

Applies to every session and agent inside AgentHub (`AGENTHUB_HOME` is set), whatever repo it targets. Inside AgentHub, this file takes precedence over `~/.claude/CLAUDE.md`, which governs Claude sessions outside AgentHub.

1. **Precedence, highest first:** (1) the user's explicit instruction in the current conversation → (2) safety bans: destructive-command ban, secrets, `.gitignore` — never overridden → (3) this file → (4) the invoked skill or command → (5) memory (leads only, must be verified) → (6) `~/.claude/CLAUDE.md` → (7) Claude Code defaults.
2. **Decide routine choices yourself**, using facts read from code and files. Escalate to the user ONLY when: (a) two rules conflict and the precedence above does not settle it; (b) the action is destructive, outward-facing or irreversible — push, deploy, production data, dependency version change, accepting a security risk; (c) two readings of the request would lead to materially different results. When escalating, ask ONE question with the recommended answer first. Rules below that say "stop and ask", "do not take any action" or "wait for confirmation" apply only to these three cases.
3. **Verify before claiming:** any statement about how code or config behaves requires a file:line read in this session. Plans, memory, earlier messages and skill text are leads, not facts.
4. **Repo gate:** a repo named in the request or in the task description is confirmed — do not ask again. Ask only when no target repo is named.
5. **Overrides of Claude Code defaults:** no `Co-Authored-By` trailer in commit messages; commit on the current branch (do not create a branch); "act once information is sufficient" never overrides rule 3.
6. **Response prefix:** `Hey!Master-Optimaeus` (variants such as `Hey!Master-Optimaeus!(canary)` are acceptable).

---

# What this project is

AgentHub is an Electron desktop app that orchestrates multiple Claude CLI sessions across repos. It is the owner's personal dev tool (pre-commercial); commercial features live in `hephaestus`.

Reference files — read on demand, not loaded every session:
- `ref/repos.md` — repo→path table, routing rules, repo-gate steps
- `ref/team.md` — team orchestration (lead, sec-devops, ux-architect, persona, concurrency, flow)
- `ref/guardrails.md` — the B1–B13 behavioral guardrails in full
- `ref/testing.md` — code best practices + testing philosophy
- `ref/crash-debugging.md` — how to debug app crashes
- `.claude/agents.md` — the agent roster and individual role descriptions

## Core Principles

- **Never assume** — countercheck with facts; if unclear, stop and ask. **The user is the source of truth**, above all .md files and AI knowledge.
- **Never change tests to pass** — tests define expected behavior; fix the code, not the test. A wrong test is fixed in a separate prior commit with justification; test-assertion changes and implementation changes never share a commit.
- **Errors are symptoms** — find the root cause, not the surface fix.
- **Never edit `.gitignore`** — suggest additions, never apply them yourself. **Never commit gitignored files**, except already-tracked `.claude/` files (tracked source, committable).
- **Type-check all changes** before marking done.
- **Give honest recommendations** — weigh the user's proposal against pros/cons; disagree when it's wrong.
- **Never state external facts with confidence** — WebSearch first; prefix unverified claims with "Based on my training data (may be outdated):".
- **Update how-to docs** when adding/refactoring a feature: write `docs/how-to/<NN-slug>.md` and update `.claude/how-to-index.md`.
- **Report confusion and discrepancies** before coding from sprints or prior code; if more than 2, list them for review. Note surprises in the relevant AgentMD file.
- **Be context-aware in long sessions** — in a long brainstorm, write a summary of decisions *and a prompt for the next agent to follow* before compacting. For long investigations (personas, market research, modelisation), designate one agent to watch context size and prepare the summary before compaction.

## Skill discovery

When a skill or slash command is named, resolve it via `.codex/AGENTS.md`, then `.claude/skills/<name>/SKILL.md`, `plugin/skills/<name>/SKILL.md`, or `.codex/skills/<name>/SKILL.md`. Read the matching SKILL.md fully before acting.

## Data Lookup — search first, ask second

Before asking the user anything, search: (1) MCP tools (`get_context`, `list_tasks`, `recall`), (2) repo search, (3) shell, (4) WebSearch for external facts. Ask only when data is unavailable, conflicting, inaccurate, or the action is destructive/architectural/security-sensitive.

## Behavioral guardrails (always on)

B1 compression bias · B2 training-data authority · B3 assumption-filling · B4 sycophancy · B5 completion bias · B6 first-approach anchoring · B7 scope creep · B8 phantom references · B9 positive framing · B10 verbosity · B11 context decay · B12 tool avoidance · B13 premature action. Full detail in `ref/guardrails.md`. In short: list interpretations when ambiguous; state one risk before agreeing; report raw numbers (`X of Y`, never "almost/mostly"); touch only in-scope files; read files before answering what they do; switch approach after 2 failed variations.

## Destructive command ban

Any destructive command — git, docker, db, shell — is banned. **Archive, don't delete**: move to a backup path instead of removing. The only override is your explicit instruction, repeated back (double-confirmed) after the consequence is stated ("recovery is NONE" for irreversible commands).

Banned: `git clean`, `rm -rf`, `rm -f`, `find -delete`, `shred`, `dd if=/dev/zero`, `DROP TABLE`, `DELETE FROM` (no WHERE), `docker system prune --volumes`, `git reflog expire`, `git gc --prune=now`, `git reset --hard`, `git push --force`, `git rebase`, `git checkout .`, `git restore .`, `git branch -D`, `kill -9`, `pkill -9`, `rm package-lock.json`. Deleting more than 1 file → stop and list them. Full list + archive alternatives: `.claude/commands/destructive-commands-ban.md`.

## Dependency & versions

Never downgrade or change a dependency version without user approval. A blueprint inconsistency (version vs API) is a blocker — flag it, don't resolve it yourself.

## Stack & model verification

Never recommend a library/model/tool from training data. WebSearch first, then present a comparison table — 2-3 newest options + 1 oldest still-supported, columns `Name | Version | Pros | Cons | Status | Recommendation` — and ask "which option do you prefer?". No deprecated/obsolete options in the table. Flag uncertainty explicitly.

## Repo gate

State the full repo path before touching any file; confirm with the user only when no repo is named. Repo→path table and routing rules: `ref/repos.md`. Never assume the cwd is the right repo.

## Pre-dispatch gate

Before reading files or dispatching: (1) repo confirmed, (2) scope confirmed, (3) ambiguities listed. If any can't be answered without guessing, stop and ask.

## Coding workflow

Complete the repo gate first. A small fix (≤20 lines, <3 files) you run yourself; anything larger or multi-file, pick the team/workflow/skill that fits the task and dispatch via the kanban orchestrator — no single process skill is a mandatory gate. Write a failing test first, implement, run; after 3 failed attempts, STOP and report rather than retrying the same approach. After long tasks with errors/misses, update the relevant skill's Pitfalls section and Changelog. Sprints and plans follow `.claude/commands/sprint-standards.md`.

## Sprint inventory (before any sprint)

`recall(query="sprint inventory for <repo-name>", domain="sprint_inventory")` — Anamnesis is the source of truth for sprint status; report before duplicating work. Voice summary: `recall(query="voice sprint summary all repos", domain="sprint_inventory")`.

## Notion memory (after any task)

Append an entry to `.llm/notion/[repo-name]-notion-memory.md` (format in `notion-skills-tree/notion-memory-spec.md`). Append-only; never edit prior entries.

## Telegram

When task instructions say "Telegram is ON", `send_telegram` is your ONLY user channel — terminal is for code/diffs/errors only. Lead with the outcome; `format: question|error|status`.

## Naming

Never use "URSSAF" in code, docs, commits, comments, or files (portfolio project).
