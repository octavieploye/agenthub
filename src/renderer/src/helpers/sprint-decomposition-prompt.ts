export interface SprintPromptInput {
  docPath: string
  projectName: string
  repoId: string
  outputPath: string
  projectPath: string
  draftFilename: string
}

export function buildSprintDecompositionPrompt(input: SprintPromptInput): string {
  const { docPath, projectName, repoId, outputPath, projectPath, draftFilename } = input
  return `You are a sprint decomposition agent for the project "${projectName}".

## Your task

1. Read the document at: ${docPath}
2. Write a human-readable summary to: ${projectPath}/sprint.md
   Plain markdown. No special format. Team members should be able to read and understand it.
3. Write the structured JSON to: ${outputPath}/${draftFilename}
   This file is read by AgentHub to create Kanban tasks.

**Write sprint.md FIRST. Write ${draftFilename} SECOND and LAST.**

## Rules for decomposition

- Group tasks under epics (themes or feature areas).
- Assign priority: 1 (High), 2 (Medium), 3 (Low) based on complexity and risk.
- If one task must be completed before another can start, set dependsOn with the earlier task's localId.
- Adapt the number of tasks to the actual complexity — do not pad with trivial tasks.
- Each task must be implementable independently (after its dependencies are done).
- Keep task titles short (< 80 chars). Put details in description.

## JSON schema for ${draftFilename}

Write ONLY valid JSON matching this exact structure. No markdown fences, no extra keys.

{
  "sprintName": "Sprint N — <short descriptor>",
  "repoId": "${repoId}",
  "projectName": "${projectName}",
  "epics": [
    {
      "name": "<epic name>",
      "targetDate": "<YYYY-MM-DD or omit>",
      "tasks": [
        {
          "localId": "t1",
          "title": "<short imperative title>",
          "description": "<1-2 sentences explaining the implementation>",
          "priority": 1,
          "category": "<backend|frontend|design|refactor|infra|security — pick one>",
          "skills": ["<skill-name>"],
          "modelOverride": "<claude-sonnet-4-6|claude-opus-4-6 — omit if default>",
          "dependsOn": []
        },
        {
          "localId": "t2",
          "title": "<short imperative title>",
          "description": "<1-2 sentences>",
          "priority": 2,
          "category": "<backend|frontend|design|refactor|infra|security>",
          "skills": ["<skill-name>"],
          "dependsOn": ["t1"]
        }
      ]
    }
  ]
}

## Field guidance for category, skills, modelOverride

**category** — required on every task. Pick exactly one:
- \`backend\` — API, services, DB queries, migrations
- \`frontend\` — UI components, state, routing
- \`design\` — visual, UX, layout (skips security phase in orchestrator)
- \`refactor\` — code cleanup, restructuring (no loop-back on security findings)
- \`infra\` — DevOps, CI, Docker, infrastructure
- \`security\` — dedicated security hardening tasks

**skills** — one or more skill names that the agent should invoke. Full catalog:

Implementation teams (pick the primary one for the task):
- \`team-dev-loop\` — standard agentic implementation loop (scout → impl → test → review)
- \`team-impl-lead\` — multi-file scoping gate before implementation (use when scope is uncertain)
- \`dev-backend\` — direct backend implementation agent
- \`dev-frontend\` — direct frontend implementation agent
- \`sr-backend\` — senior backend validator (review + harden existing code)
- \`sr-frontend\` — senior frontend validator (review + harden existing code)

Security agents (see mandatory rule below):
- \`sec-devops\` — security scan: OWASP, data leakage, dependency risk, DevOps/infra hardening
- \`team-threat-defense\` — threat modeling + attack surface analysis (use for auth, user input, external API exposure)
- \`sec-insider-threat\` — insider threat + IP protection audit

Design teams:
- \`team-ui-builder\` — UI component build: layout, visual, interaction patterns
- \`team-design-research\` — UX research, user flow, interaction design before implementation
- \`graphic-identity-team\` — brand identity, graphic assets, visual system
- \`ux-architect\` — UX architecture: component specs, design system, accessibility

Quality and integrity:
- \`full-code-review\` — deep multi-agent code review (use for large refactors or high-risk merges)
- \`team-integrity-status\` — cross-system integrity check: contract verification, type safety, API alignment
- \`team-production-readiness\` — pre-release gate: observability, error handling, rollback, load behaviour
- \`team-backend-hardening\` — backend security hardening: rate limiting, input validation, secrets management

Ops:
- \`git-commit\` — commit-only tasks (git-ops agent, no implementation)

## Mandatory security rule

**Every coding task must include a security skill unless it is a pure single-element visual task.**

A task qualifies as pure visual ONLY when ALL of the following are true:
- It changes appearance only (color, font, spacing, icon, copy)
- It introduces no event handler, no state change, no API call, no routing change, no data write
- It touches a single isolated element with no downstream wiring

Examples that DO require \`sec-devops\` even though they look simple:
- "Add a button that triggers confetti" → has a JS event handler → include \`sec-devops\`
- "Wire form submit to API" → data write → include \`sec-devops\`
- "Add search input" → user input → include \`team-threat-defense\`
- "Refactor auth middleware" → security-critical → include \`sec-devops\` + \`team-threat-defense\`

Examples that do NOT require security:
- "Change primary button color from blue to teal"
- "Update hero section font size"
- "Replace placeholder image with final asset"

When in doubt, include \`sec-devops\`. The cost of a false positive is zero. The cost of a false negative is a vulnerability in production.

**modelOverride** — omit for standard tasks. Set to \`claude-opus-4-6\` only for tasks the document explicitly marks as high-complexity, architectural decisions, or security-critical.

## localId rules

- localId values must be unique strings within this JSON (e.g. "t1", "t2", "auth-1").
- dependsOn references must match existing localId values in the same JSON.
- localId is only used for wiring dependencies — it is NOT stored in the database.

## After writing both files

Print exactly this and nothing else after:
SPRINT_FILES_WRITTEN: sprint.md and ${draftFilename}

Begin by reading ${docPath}.`
}
