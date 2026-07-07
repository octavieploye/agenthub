# Project-Local Skills Index

Skills specific to the agenthub codebase. Machine-readable registry: [index.json](index.json)

Format: `- [skill-name](<name>/SKILL.md) — one-line description of when to use it`

## Dev Skills

- [skill-creator](skill-creator/SKILL.md) — Create new skills, teams, workflows, commands — reverse-engineer tasks into reusable artifacts
- [test-integrity-review](test-integrity-review/SKILL.md) — Check code changes for "test changed to pass" patterns during review or before commits
- [full-code-review](full-code-review/SKILL.md) — Full multi-agent codebase audit + fix + verify cycle
- [token-optimizer](token-optimizer/SKILL.md) — Audit AI instruction files for token waste and rewrite safely via 5-gate pipeline

## Voice & Articulation

- [language-articulation](language-articulation/SKILL.md) — Pragmatic structuralist voice profile: structural framing, concrete numbers, named actors, sovereignty as leverage — for drafting content, responding to questions, or articulating positions

## Business Analysis

- [external-source-to-strategy](external-source-to-strategy/SKILL.md) — Turn a transcript, article, or framework into a competitive brief, priority todos, and memory reference scoped to AgentHub/Optimaeus
- [trustworthy-sources](trustworthy-sources/SKILL.md) — Evaluate whether a source is credible enough to cite as evidence for a factual, design, or business decision (5-source convergence rule, corporate ≠ trustworthy)

## Business Venture

- [vibe-marketing-validation](vibe-marketing-validation/SKILL.md) — Run the L7V 9-prompt AI validation playbook: niche discovery, product spec, mockups, landing page, Meta ads, and self-improving loop — before building anything

## Business Strategy Destructuring

- [destructuring-full](../commands/destructuring-full.md) — Run the full destructuring pipeline: competitor (micro) → business (internal) → market entry → dynamics → patterns synthesis
- [destructuring-business](../commands/destructuring-business.md) — Destructure business strategy: positioning, pricing, acquisition, monetization. Phase 5 of market-sim pipeline
- [destructuring-competitor](../commands/destructuring-competitor.md) — Destructure closest competitors by geography and segment — micro scale
- [destructuring-market](../commands/destructuring-market.md) — Destructure market entry strategy: segments, channels, positioning, go-to-market vectors
- [destructuring-dynamics](../commands/destructuring-dynamics.md) — Destructure market dynamics: forces, barriers, power structures, trends
- [destructuring-patterns](../commands/destructuring-patterns.md) — Extract good and bad patterns from multiple destructuring runs

## Workflows

- [market-modeling](../workflows/market-modeling/manifest.md) — Five-tradition market intelligence: harvest → five-lens analysis → shadow review → synthesis

## Team Orchestrators

- [team-business](team-business/SKILL.md) — Market research, strategy, competitive intelligence — FORWARD/REVERSE/LOOP research modes
- [team-marketing](team-marketing/SKILL.md) — Persona, channel strategy, messaging, campaign planning — requires business team output first
- [team-brain](team-brain/SKILL.md) — Cross-project meta-intelligence: ecosystem orientation, project status, strategy context, memory surface
- [team-brainstorm](team-brainstorm/SKILL.md) — General ideation across any domain — concept → challenge → synthesis → Idea Brief
- [team-data](team-data/SKILL.md) — Archives session outputs, cross-session opportunity and risk analysis
- [team-ai-expert](team-ai-expert/SKILL.md) — Audits, optimizes, and scaffolds .claude/ configs — report/propose mode, no silent changes
- [team-stats](team-stats/SKILL.md) — Statistical analysis, risk modeling, behavioral research, decision framing — external reference only
- [team-tech-brainstorm](team-tech-brainstorm/SKILL.md) — From approved Idea Brief to approved Feature Brief — requires Idea Brief to start
- [team-ceo-coaching](team-ceo-coaching/SKILL.md) — CEO coaching: intake profiling, inner/outer game coaching, session synthesis

## Display Registry

When creating, renaming, or removing any skill, command, workflow, or team,
update `.claude/skills/display-registry.json` with the display name and category.
This file drives the AgentHub UI skills dropdown. Format:

```json
"skill-id": { "displayName": "Human Readable Name", "category": "category-key" }
```

Category keys: `code-quality`, `ai-config`, `market-intel`, `competitor-analysis`, `content-voice`, `workflows`, `teams`, `utilities`.
