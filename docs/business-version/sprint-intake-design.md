# Sprint Intake — Business Version Design
**Status:** Parked — for business version of AgentHub (not current dev build)
**Date:** 2026-06-23

---

## Core Concept

Two paths, same two outputs.

**Path A — User loads an existing sprint doc**
```
User has a sprint doc (Word, Notion, PDF, md, anything)
→ "Load Sprint" button in AgentHub
→ User picks the file
→ Agent reads and decomposes it
→ OUTPUT 1: human-readable sprint.md saved to {project.path}/sprint.md
→ OUTPUT 2: structured tasks sent to Kanban Backlog
```

**Path B — User creates sprint inside AgentHub**
```
"Create Sprint" button in AgentHub
→ In-app editor opens with a simple plain-language template
→ User writes the sprint (no technical fields — just natural language)
→ Clicks "Generate Tasks"
→ OUTPUT 1: human-readable sprint.md saved to {project.path}/sprint.md
→ OUTPUT 2: structured tasks sent to Kanban Backlog
```

---

## File Location

```
{project.path}/sprint.md
```

The project folder is the folder the user already linked when setting up their project in AgentHub. `projects.path` already exists in the DB (migration 019) — currently optional, will need to be required or prompted for when this feature is activated.

---

## Key UX Decisions

- The sprint brief is a **living document** — one file per project, not versioned files. Non-tech users think in "the current plan", not versions. History can come via Forgejo when that is built.
- The editor should feel like a **document**, not a form. No rigid fields — plain language with a gentle starting template (prompts that disappear when the user starts typing).
- The "send to Kanban" action should use **non-technical language**: "Create Tasks" or "Build my Sprint" — not "Launch Agent" or "Run intake".
- `sprint.md` is the **human version** — readable by the team, committable to git, Forgejo-compatible.
- The Kanban intake receives the **LLM-structured version** — JSON parsed by the decomposition agent.

---

## Forgejo Compatibility

When Forgejo is implemented, the sprint doc will live in the Forgejo wiki/repo. AgentHub can sync from Forgejo into `{project.path}/sprint.md` automatically — the pipeline (decompose → Kanban intake) stays identical either way. No pipeline changes needed when Forgejo arrives.

---

## Open Questions (to resolve when building business version)

- Should `project.path` be required when activating the sprint feature, or should AgentHub prompt to set it inline?
- Should Path A (load existing file) also copy the original into `{project.path}/sprint.md`, or keep the original in place and only write the structured output?
- Template language for the in-app editor — what prompts work best for non-technical users?
