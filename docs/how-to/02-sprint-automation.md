# Sprint Automation

Sprint automation turns a plain document into a full set of Kanban tasks using an AI decomposition agent.

## Flow

```
Brief doc → Launch Agent → draft JSON
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

**3.** Fill in document path, project, and repo. If the project has no folder set, click **Set folder** when prompted.

**4.** Click **Launch Agent**. The agent reads your doc and creates a draft JSON.

**5.** Wait 1–3 minutes. When done, **Sprint ↑** turns blue and shows **· draft ready**.

**6.** Click the blue **Sprint ↑**. Review the sprint name, epic count, task count, and dependencies.

**7.** Click **Import to Kanban**. All tasks land in **Backlog** grouped by epic.
