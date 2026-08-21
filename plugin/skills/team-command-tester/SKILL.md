---
name: team-command-tester
description: Command Tester Team Orchestrator — stress-tests and validates output quality of any skill, team, or multi-team workflow via real SkillsService integration tests, headless xterm capture, token measurement, and LLM-as-judge scoring
---

# Team Command Tester

Stress-test and validate the rendering, output quality, and token efficiency of any skill, team, or multi-team workflow.

## When to Use

- Before submitting a workflow to WSA
- After creating or modifying a skill/team/workflow
- Weekly health check across all registered skills (BATCH mode)
- Before/after running token-optimizer on a skill (COMPARE mode)
- When a multi-team orchestration (market-sim, content-engine) needs consistency validation (TIERED mode)
- When a workflow produces document output (PDF/Excel/Word/PPT) requiring rendering proof (STRESS mode)

## What You Need Before Starting

- Target skill ID, team name, or workflow name
- Target must be registered in `plugin/skills/index.json` or `plugin/skills/display-registry.json`
- For STRESS mode: the workflow must produce document output (PDF, Excel, Word, PowerPoint)
- For COMPARE mode: a token-optimizer `--dry-run` must have been run first

## What This Team Produces

- **Test Report**: `docs/superpowers/test-reports/YYYY-MM-DD-<skill-id>-command-test.md`
- **Notion entry**: appended to `.llm/notion/agenthub-notion-memory.md`
- **Anamnesis event**: `WORKFLOW_TEST_COMPLETED` → `/memory/procedural` (via team-knowledge-manager)
- **Notion table row**: added to "Workflow Test Registry" (skill, date, team, tier, OQS/RRS/TES, summary)

## 4-Tier Testing Model

| Tier | Scope | Agents Tested | Token Budget | Primary Model |
|---|---|---|---|---|
| T1 | Single skills | 1 | 8-23K | Devstral (Ollama Cloud) |
| T2 | Small teams | 2 | 22-45K | Devstral + Ministral |
| T3 | Medium teams | 3-4 | 60-120K | Devstral (scouts) + Sonnet (judges) |
| T4 | Full orchestrations | 4-6+ | 120-240K+ | Devstral (harvesters) + Sonnet (synthesis) |

T4 uses **pyramidal testing**: test sub-components at T1 first, then pairs at T2, then full orchestration. This prevents wasting tokens on a workflow whose first agent produces garbage.

## Agent Sequence

### Phase 0 — Plan (1 agent, sequential)

1. **test-planner** — reads target SKILL.md, extracts declared output format/sections/modes/gates. Generates test matrix (scenarios x modes x model tiers). Estimates token budget per tier. Classifies target into T1-T4. Presents pre-run estimate to user.
   - Model: Devstral (Ollama Cloud)
   - Gate: user confirms test matrix before Phase 1

### Phase 1 — Execute (3 agents, parallel)

2. **scenario-runner** — invokes target skill via real SkillsService (true integration test). Captures raw PTY output, exit code, duration, status transitions. Runs in modes: NORMAL (happy path), EDGE (boundary conditions), ADVERSARIAL (oversized payloads, conflicting instructions).
   - Model: target skill's assigned model
3. **output-capturer** — headless xterm.js capture (uses existing `@xterm/headless` + `HeadlessTerminalBuffer`). Records raw bytes + clean text. Validates format compliance: markdown tables, code fences, headings, section completeness. Detects truncation, broken formatting, missing sections.
   - Model: Devstral
4. **token-measurer** — measures token count per component (skill context, scenario prompt, execution, output). Calculates TES = CR x QR. Compares against model-tier CR ceilings (Haiku 1.5x, Sonnet 3x, Opus 5x). Flags skills exceeding context budget.
   - Model: Devstral

### Phase 2 — Judge (3 agents: judge first, then tester + builder parallel)

5. **output-judge** — LLM-as-judge comparing actual vs expected output patterns from test matrix. Scores each scenario: PASS / PARTIAL / FAIL with evidence. Checks completeness, format adherence, behavioral compliance. Detects assumption language ("appears to", "likely", "suggests").
   - Model: Claude Sonnet (judgment requires high capability)
6. **rendering-tester** — headless xterm.js stress tests by default (80%+ of skills). Tests: scrollback overflow (>5K lines), IPC flood (>100 msg/s), special characters (Unicode, zero-width, BEL), parser buffer limits. Chrome DevTools MCP ONLY for STRESS mode (document format verification: PDF/Excel/Word/PPT rendering).
   - Model: Devstral (headless) or Chrome MCP tools (STRESS mode)
7. **report-builder** — aggregates all Phase 1 + Phase 2 outputs. Computes composite scores: OQS (Output Quality Score), RRS (Rendering Resilience Score), TES (Token Efficiency Score). Generates structured test report. Pushes to Notion + .llm/notion/ + triggers team-knowledge-manager for Anamnesis capture.
   - Model: Ministral

## Modes of Operation

| Mode | Purpose | When to Use |
|---|---|---|
| QUICK | Single skill, happy path only, current model | Pre-commit gate, rapid feedback |
| FULL | Single skill, full matrix (modes x scenarios x models) | Before WSA submission, quality certification |
| STRESS | ONLY for workflows producing dedicated output formats (PDF, Excel, Word, PowerPoint) — uses Chrome MCP for document rendering verification | Business intelligence reports, market research decks, modelisation presentations |
| COMPARE | Before/after optimization via token-optimizer — produces delta report | After applying token-optimizer to a skill |
| TIERED | Graduated T1 → T2 → T3 → T4 for multi-team orchestrations — pyramidal testing | market-sim, content-engine, sprint-planner, and similar high-value workflows |
| BATCH | All skills in registry, QUICK mode each — aggregate dashboard | Weekly health check, regression detection |

## Token-Optimizer Integration

- **Pre-test**: measure skill context tokens (SKILL.md + referenced files), flag if above threshold
- **During**: TES scoring per scenario using token-optimizer's formula: `TES = CR x QR` where `QR = 1 - (error_rate + stuck_rate + retry_rate) / 3`
- **Post-test**: optimization recommendations in report ("This skill's context could save N tokens at 1.5x CR")
- **Model-tier CR validation**: verify Devstral handles 1.5x, Ministral 3x, Sonnet 5x compression safely
- **User sees**: pre-run estimate AND post-run actual cost breakdown by agent/model

## Fail-Fast Rules

| Tier | Trigger | Action | Tokens Saved |
|---|---|---|---|
| T1 | QR < 0.8 | Stop, report to user | ~16K |
| T2 | Lead synthesis fails | Return Phase 1 outputs, halt | ~22-45K |
| T3 | User rejects any gate | Archive outputs, halt | ~60-120K |
| T4 | Phase 1 fails gate | Do NOT run Phases 2-4 | ~90-160K |
| T4 | Analyst loops > 2x | Escalate to user, do not auto-retry | ~80K |

## Data Persistence

1. **Test report file**: `docs/superpowers/test-reports/YYYY-MM-DD-<skill-id>-command-test.md`
2. **Notion memory**: append to `.llm/notion/agenthub-notion-memory.md` with `type: sprint`
3. **Anamnesis**: trigger `/team-knowledge-manager` to capture test results as `WORKFLOW_TEST_COMPLETED` event → `POST /memory/procedural`
4. **Notion table**: maintain a "Workflow Test Registry" row: skill name, date tested, team used, tier, OQS/RRS/TES scores, short summary

## Report Template

```markdown
# Command Test Report: {skill-id}
Date: YYYY-MM-DD | Tier: T{1-4} | Model: {model} | Mode: {mode}

## Composite Scores
| Metric | Score | Floor | Verdict |
|--------|-------|-------|---------|
| Output Quality (OQS)      | — | >= 0.90 | — |
| Rendering Resilience (RRS) | — | >= 0.80 | — |
| Token Efficiency (TES)     | — | >= 1.0  | — |

## Token Breakdown
| Component | Tokens | Model | Cost |
|-----------|--------|-------|------|
| Skill context | — | — | — |
| Phase 1 | — | — | — |
| Phase 2 | — | — | — |
| Total | — | — | — |

## Scenario Results
| Scenario | Phase | Exit | Duration | Verdict | Evidence |
|----------|-------|------|----------|---------|----------|

## Rendering Stress
| Test | Method | Result | Notes |
|------|--------|--------|-------|

## Recommendations
```

## Key Rules

- All agents are read-only except report-builder (writes report files and Notion entries)
- Real SkillsService invocation — true integration test, not simulation
- Ollama Cloud models preferred (devstral, ministral, glm-5.2, qwen) — Claude Sonnet reserved for judgment only
- Workflow execution quality always comes first — never compromise quality to save tokens
- STRESS mode is ONLY for document output format verification (PDF/Excel/Word/PPT), not general rendering testing
- Test reports MUST flow through team-knowledge-manager for Anamnesis integration
- Max 3 active agents at any time (standard concurrency rule)
- Never modify the target skill — report findings only

## How to Invoke

```
/team-command-tester QUICK team-business
/team-command-tester FULL market-sim-start
/team-command-tester STRESS team-financial-model
/team-command-tester COMPARE token-optimizer
/team-command-tester TIERED team-content-engine
/team-command-tester BATCH
```
