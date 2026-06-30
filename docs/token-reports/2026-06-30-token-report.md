# Token Optimizer Report — 2026-06-30

Generated: 2026-06-30 15:50

=== TOKEN OPTIMIZER REPORT ===

## Session Trend

  2026-06-30 15:09  →  412818 tokens
  2026-06-30 15:14  →  412837 tokens
  2026-06-30 15:20  →  412856 tokens
  2026-06-30 15:25  →  412875 tokens
  2026-06-30 15:44  →  380383 tokens
  2026-06-30 15:46  →  380383 tokens

  Net change: -32435 tokens across logged sessions
  Token count is SHRINKING — optimizations are working

## Top 15 Largest Files

  Tokens | Class     | File
  -------|-----------|-----
   22367 | context   | .claude/workflow-team-library/business/brainstorm/Addressing-All-15-Gaps-Core-Operating-Rule.md
   15646 | rules     | .claude/workflow-team-library/business/brainstorm/Modular-System-Brainstorm .md
   10559 | rules     | .claude/agents.md
   10415 | rules     | .claude/workflow-team-library/business/brainstorm/5-layers-Real-Signal-Infrastructure.md
   10342 | rules     | .claude/workflow-team-library/business/brainstorm/Modular-Geo-Tracks.md
    9236 | rules     | packages/market-sim-pkg/.claude/market-sim-prep/phase-6-simulation.md
    9236 | rules     | .claude/workflow-team-library/market-sim-prep/phase-6-simulation.md
    6730 | context   | .claude/workflow-team-library/business/brainstorm/5-Layer-Research-Methodology-Brainstorm.md
    5159 | rules     | .claude/workflow-team-library/business/brainstorm/addressing-gaps.md
    4333 | rules     | .claude/workflow-team-library/brain/knowledge/reference/time-management-full-research.md
    4277 | rules     | .claude/CLAUDE.md
    4173 | rules     | .claude/commands/sec-devops.md
    3557 | workflow  | .claude/workflow-team-library/business/brainstorm/NEW-BUSINESS-TEAMS.md
    3255 | rules     | .claude/workflow-team-library/brain/knowledge/reference/original-hormozi-time-investment-transcription.md
    3221 | rules     | .claude/workflow-team-library/brain/knowledge/philosophy.md

## Token Distribution by Class

  Class     | Files | Tokens  | % of Total | CR Target | Potential Savings
  ----------|-------|---------|------------|-----------|------------------
  rules     |   221 |  316618 |      83.2% |      1.5x | 105539 tokens
  context   |    13 |   39094 |      10.3% |      1.5x | 13031 tokens
  workflow  |    24 |   24671 |       6.5% |      1.5x | 8223 tokens
  ----------|-------|---------|------------|-----------|------------------
  TOTAL     |   258 |  380383 |      100% |           | ~126794 tokens saveable

## What To Do

  [MODERATE] 380383 tokens — room for optimization.
         Focus on the top 5 files above.

  To start optimizing: token-audit.sh --dry-run
  To check gate status: token-audit.sh --status
