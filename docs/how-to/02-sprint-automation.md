# Sprint Automation

Sprint automation turns a plain document into a full set of Kanban tasks using an AI decomposition agent.

## Full Flow

```
Brief doc → Launch Agent → sprint.md + draft JSON
                                     ↓
                       "Sprint ↑  · draft ready" in Kanban header
                                     ↓
                       Click Sprint ↑ → Preview → Import
                                     ↓
                       Tasks appear in Backlog (epics, priorities, deps)
```

## Step-by-Step

**1.** Select the project in the Kanban header dropdown.

**2.** Click **Sprint ↑** (ghost button). The Sprint Intake modal opens.

**3.** Fill in:
- **Document path** — absolute path to your brief (e.g. `/Users/you/projects/myapp/brief.md`)
- **Project** — the project this sprint belongs to
- **Repo** — the codebase the tasks target

If the project has no folder set, click **Set folder** when prompted.

**4.** Click **Launch Agent**. The agent reads your doc, writes `sprint.md` to the project folder, and creates a draft JSON.

**5.** Wait 1–3 minutes. When done, the header shows: **Sprint ↑  · draft ready** (button turns blue).

**6.** Click **Sprint ↑** (blue). The Sprint Preview modal shows: sprint name, epic count, task count, dependencies.

**7.** Click **Import to Kanban**. All tasks land in **Backlog** grouped by epic.

## What Makes a Good Brief

- Plain text or Markdown (`.md` or `.txt`)
- Headers for feature areas → become epics
- Bullet points → become tasks
- Include implementation notes — the agent uses them to fill task descriptions
- Be explicit about dependencies: "X must be done before Y" → agent sets `dependsOn`
- Keep under a few thousand words

## Draft Persistence

If you close AgentHub before importing, the "· draft ready" indicator returns on next launch. Drafts expire after 30 minutes of app runtime — re-run intake to regenerate.

## Sprint and Epic Naming

- Sprint: `Sprint N — <short descriptor>` — e.g. `Sprint 4 — Payments & Webhooks`
- Epics: noun phrases — `Authentication`, `Database Layer`, `Admin Dashboard`
- Add a target date to an epic to get a progress bar and due date indicator on cards
