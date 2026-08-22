# Project-Local Skills Index

Skills specific to the agenthub codebase. Machine-readable registry: [index.json](index.json)

Format: `- [skill-name](<name>/SKILL.md) — one-line description of when to use it`

## Frontend Engineering

- [team-frontend](../../plugin/skills/team-frontend/SKILL.md) — **Full pipeline**: audit → triage → TDD gate → dev-stack fix → architect + sr-frontend review → test integrity → final log + recommendations
- [frontend-code-review](../../plugin/skills/frontend-code-review/SKILL.md) — Senior frontend review for any stack (React/Vue/Angular/Svelte/vanilla JS) — framework patterns, TS strict, dead UI, wiring, test gaps — adapts to detected stack
- [frontend-wire-verifier](../../plugin/skills/frontend-wire-verifier/SKILL.md) — Verifies frontend↔backend wiring across REST, GraphQL, WebSocket, IPC, Tauri, gRPC, SSE — missing handlers, type mismatches, unguarded calls
- [test-first-enforcer](../../plugin/skills/test-first-enforcer/SKILL.md) — TDD gate for any language/runner — forces red test before any implementation, gates: understand → red → implement → full suite → refactor
- [chaos-modeling](../../plugin/skills/chaos-modeling/SKILL.md) — Chaos engineering for any project type — 8-domain failure scenarios + real outcome logging + resilience hardening plan

## DevOps

- [team-backend-hardening](team-backend-hardening/SKILL.md) — Meta-orchestrator: sequences full-code-review → production-readiness → sec-devops → threat-defense → insider-threat, with dev-loop fix cycles + architect/sr-backend validation gates + human approval between each phase — outputs Production-Ready Clearance Report
- [team-production-readiness](team-production-readiness/SKILL.md) — Full production readiness audit: DB architecture, auth security, infra/DevOps, payments, scale performance (0→10k users) — outputs Production Readiness Report with CRITICAL/HIGH/MEDIUM/LOW findings + P0/P1/P2 remediation plan
- [full-code-review](full-code-review/SKILL.md) — Full multi-agent codebase audit + fix + verify cycle
- [sec-insider-threat](sec-insider-threat/SKILL.md) — Insider threat & IP protection audit — unauthorized access, IP exfiltration, AI prompt injection, reverse-engineering. Outputs prevention report + hardening policy.
- [team-threat-defense](team-threat-defense/SKILL.md) — Threat Defense: outside attacks, stealth/AI threats, injection vectors, secrets exposure, high-speed anomalies — outputs TIP + Hardening Plan
- [sec-devops](.claude/commands/sec-devops.md) — Multi-mode security and DevOps auditor: OWASP Top 10, data leakage, dependency risks, infrastructure conflicts — outputs per-scan report + security-log update

## Anamnesis Memory

- [anamnesis-write](anamnesis-write/SKILL.md) — Write findings to Anamnesis memory system: auto-detects important discoveries, evaluates via memory-write-gate, surfaces to user, POSTs to Anamnesis API on approval. Never deletes, only archives.
- [anamnesis-expert](anamnesis-expert/SKILL.md) — Anamnesis system oracle: DB schemas, memory layers, API contracts, entity connections, build state, competitive positioning, integration status
- [memory-write-gate](memory-write-gate/SKILL.md) — Quality gate for Anamnesis entries: 5W1H evaluation, substantiveness scoring, trust scoring, security screening. Called by anamnesis-write before every write.

## Dev Skills

- [app-scenario-modeler](app-scenario-modeler/SKILL.md) — Model all scenarios for a software feature or app: discovery, classification, cascade analysis, constraints, risk/probability, CORE optimisation, EDGE cost decisions — outputs 6 docs per feature to optimaeus-architecture/docs/app-modeler/
- [skill-creator](skill-creator/SKILL.md) — Create new skills, teams, workflows, commands — reverse-engineer tasks into reusable artifacts
- [test-integrity-review](test-integrity-review/SKILL.md) — Check code changes for "test changed to pass" patterns during review or before commits
- [team-dev-loop](team-dev-loop/SKILL.md) — Agentic coding loop: review → fix → test, iterates until tests pass and frontend/backend are wired. Stall detection + configurable max iterations (default 5).
- [brainstorm-to-sprint](brainstorm-to-sprint/SKILL.md) — Post-brainstorm meta-orchestrator: sprint planning → dev loop → senior review gate (architect + sr-frontend + sr-backend) with fix loop until clean
- [team-impl-review](team-impl-review/SKILL.md) — Post-sprint audit: plan vs git vs code vs integration. Codebase is ground truth. DONE/PARTIAL/MISSING/CONFLICT verdicts with file:line evidence. Loops with team-dev-loop for fixes.
- [team-command-tester](../../plugin/skills/team-command-tester/SKILL.md) — Stress-test and validate output quality of any skill, team, or workflow: real SkillsService integration tests, headless xterm capture, token measurement (TES), LLM-as-judge scoring (OQS), rendering stress (RRS). 6 modes: QUICK/FULL/STRESS/COMPARE/TIERED/BATCH. Reports to Notion + Anamnesis.
- [token-optimizer](token-optimizer/SKILL.md) — Audit AI instruction files for token waste and rewrite safely via 5-gate pipeline
- [google-oauth-expert](google-oauth-expert/SKILL.md) — Google OAuth 2.0 implementation + security hardening for web server and desktop/installed apps (PKCE, scopes, token lifecycle, production readiness)
- [apple-oauth-expert](apple-oauth-expert/SKILL.md) — Apple OAuth & Authentication expert: Sign in with Apple (native + web JS SDK + portal config), private email relay, ASWebAuthenticationSession, MDM Account-Driven Enrollment OAuth2, Platform SSO

## Notion Integration

- [notion-skills-tree](notion-skills-tree/SKILL.md) — Notion workspace orchestrator: organizes projects, business intel, entity status via MCP bridge. On-demand, CEO-level, autonomous with strict modification protocol.

## Voice & Articulation

- [language-articulation](language-articulation/SKILL.md) — Pragmatic structuralist voice profile: structural framing, concrete numbers, named actors, sovereignty as leverage — for drafting content, responding to questions, or articulating positions

## Business Analysis

- [external-source-to-strategy](external-source-to-strategy/SKILL.md) — Turn a transcript, article, or framework into a competitive brief, priority todos, and memory reference scoped to AgentHub/Optimaeus
- [trustworthy-sources](trustworthy-sources/SKILL.md) — Evaluate whether a source is credible enough to cite as evidence for a factual, design, or business decision (5-source convergence rule, corporate ≠ trustworthy)
- [ai-act-deployer-checklist](ai-act-deployer-checklist/SKILL.md) — EU AI Act self-classification: scope check, role ID, prohibited practice screen, risk classification, obligation mapping, timeline/deadlines, SME provisions, modification rules, compliance action plan

## Business Venture

- [vibe-marketing-validation](vibe-marketing-validation/SKILL.md) — Run the L7V 9-prompt AI validation playbook: niche discovery, product spec, mockups, landing page, Meta ads, and self-improving loop — before building anything
- [price-proof](price-proof/SKILL.md) — Stress-test your price before you quote it — ANALYZE → PLAN → COUNTERCHECK → TEST → ACT, outputs pricing position + 3 scenarios + go/adjust/hold verdict
- [proposal-proof](proposal-proof/SKILL.md) — Stress-test your proposal before you send it — reads as the client would, surfaces objections + gaps + highest-leverage reframe, outputs send/revise verdict
- [pitch-proof](pitch-proof/SKILL.md) — Stress-test your pitch before the meeting — champion + skeptic simulation, readiness score 1-10, top 3 changes, go/prep-more verdict
- [team-before-the-meeting](team-before-the-meeting/SKILL.md) — Sequential bundle: Price Proof → Proposal Proof → Pitch Proof → Synthesis — each step feeds into the next, produces single Meeting Readiness Brief with go/fix/hold verdict

## Business Strategy Destructuring

- [destructuring-full](../commands/destructuring-full.md) — Run the full destructuring pipeline: competitor (micro) → business (internal) → market entry → dynamics → patterns synthesis
- [destructuring-business](../commands/destructuring-business.md) — Destructure business strategy: positioning, pricing, acquisition, monetization. Phase 5 of market-sim pipeline
- [destructuring-competitor](../commands/destructuring-competitor.md) — Destructure closest competitors by geography and segment — micro scale
- [destructuring-market](../commands/destructuring-market.md) — Destructure market entry strategy: segments, channels, positioning, go-to-market vectors
- [destructuring-dynamics](../commands/destructuring-dynamics.md) — Destructure market dynamics: forces, barriers, power structures, trends
- [destructuring-patterns](../commands/destructuring-patterns.md) — Extract good and bad patterns from multiple destructuring runs

## Workflows

- [market-modeling](../workflow-team-library/market-modeling/manifest.md) — Five-tradition market intelligence: harvest → five-lens analysis → shadow review → synthesis
- [upgrade-sprint](../../plugin/workflows/upgrade-sprint/manifest.md) — Safe major dependency upgrade: audit (scout-frontend) → upgrade + fix (dev-frontend) → visual regression (tester-frontend) → senior validation (sr-frontend)
- [ux-challenge](../workflow-team-library/ux-challenge/manifest.md) — Adversarial UX↔UI design workflow: WEBSITE | APPLICATION modes, 8 stages from research to sprint handoff

## Team Orchestrators

- [team-design-research](team-design-research/SKILL.md) — Landing page trends, emotional UX patterns, Tailwind animations, event-triggered interactions — outputs Design Research Brief
- [team-ui-builder](team-ui-builder/SKILL.md) — End-to-end UI build: UX architecture + emotional design + Tailwind/CSS implementation + micro-interactions + non-tech validation — outputs UI Build Summary + code
- [team-ux-challenge](team-ux-challenge/SKILL.md) — Adversarial UX↔UI brainstorm + 4-persona critique + least-friction convergence — outputs converged design + plan handed to sprint planner
- [team-business](team-business/SKILL.md) — Market research, strategy, competitive intelligence — FORWARD/REVERSE/LOOP research modes
- [team-marketing](team-marketing/SKILL.md) — Persona, channel strategy, messaging, campaign planning — requires business team output first
- [team-brain](team-brain/SKILL.md) — Cross-project meta-intelligence: ecosystem orientation, project status, strategy context, memory surface
- [team-brainstorm](team-brainstorm/SKILL.md) — General ideation across any domain — concept → challenge → synthesis → Idea Brief
- [team-data](team-data/SKILL.md) — Archives session outputs, cross-session opportunity and risk analysis
- [team-ai-expert](team-ai-expert/SKILL.md) — Audits, optimizes, and scaffolds .claude/ configs — report/propose mode, no silent changes
- [team-stats](team-stats/SKILL.md) — Statistical analysis, risk modeling, behavioral research, decision framing — external reference only
- [team-tech-brainstorm](team-tech-brainstorm/SKILL.md) — From approved Idea Brief to approved Feature Brief — requires Idea Brief to start
- [team-ceo-coaching](team-ceo-coaching/SKILL.md) — CEO coaching: intake profiling, inner/outer game coaching, session synthesis
- [graphic-identity-team](graphic-identity-team/SKILL.md) — Zero to complete brand system: Golden Circle strategy, anti-AI-modeling protocol, 7 linear phases, brand-conscience gate after every phase
- [team-geo-optimizer](team-geo-optimizer/SKILL.md) — AI search visibility + Google SEO/Ads/GSC + robots.txt AI directives + marketplace GEO + DataFast measurement — outputs 90-Day GEO Action Plan
- [team-seo-geo-crawler](team-seo-geo-crawler/SKILL.md) — Bot crawl (Google + AI bots) → parallel Google SEO + GEO audit → live keyword research (SEMrush/SimilarWeb style) + vocabulary alternatives for non-tech buyers — outputs full audit report + keyword strategy
- [team-app-icon-builder](team-app-icon-builder/SKILL.md) — Converts SVG logo to all OS icon formats (macOS icns, Windows ico, Android/iOS/Linux png sets) — researches specs, builds, verifies, self-updates knowledge base
- [team-landing-lab](team-landing-lab/SKILL.md) — Product research, buyer pain mapping (Four U's), value prop (Define-Evaluate-Build), landing page copy, pain-oriented articles, onboarding copy, conversion review — 6 sequential phases, user confirmation gate after Phase 0
- [team-legal-guardian](team-legal-guardian/SKILL.md) — Legal scan (7 domains), risk classification CRITICAL→INFO with financial exposure + insurance mapping, policy/contract drafting, adversarial counter-review for litigation triggers — user approval gate before drafting
- [team-jailbreak-red-team](team-jailbreak-red-team/SKILL.md) — Generates, classifies, validates, and logs adversarial deception scenarios (T1–T7) across 8 protected assets — per-run log + master jailbreak log for LLM safety grounding
- [team-onboarding-engine](team-onboarding-engine/SKILL.md) — Apple-style onboarding for marketplace clients, affiliates, and creators — experience architecture, Stripe Connect deferred payments, automation blueprint, risk assessment, copy pack, full Onboarding Playbook
- [team-impl-lead](team-impl-lead/SKILL.md) — Full project audit from scratch: stack, product, content, legal, processes — discovery report + prioritized implementation plan + conformance check
- [team-sprint-planner](team-sprint-planner/SKILL.md) — Intake → codebase mapping → sprint design with full ownership matrix → 6-gate orchestration validation → approved sprint plan ready for implementation team
- [voice-pipeline-coordinator](voice-pipeline-coordinator/SKILL.md) — Orchestrates OPTimaeus voice pipeline build across 6 sprints (S0-S5) with TDD gates, security reviews, and parallel execution — dispatches team-dev-loop, sec-devops, git-ops
- [team-notification-layer](team-notification-layer/SKILL.md) — Sound alerts (Howler.js) + color/glow (CSS + useSettledStatus) + TTS voice (Piper + AudioContext) — two-path architecture specialist team
- [team-ecosystem-status](team-ecosystem-status/SKILL.md) — Full project oversight: AgentHub + OPTimaeus + LLM packages + Opeidos — 3-phase investigation + PDF-ready status report with risk register and action plan
- [team-conversion-architect](team-conversion-architect/SKILL.md) — Bounce psychology + CIA page teardown + AI resistance mapping + 0.1% conversion blueprint — transforms Opeidos from 0 to 1M-trajectory conversion architecture
- [team-content-engine](team-content-engine/SKILL.md) — Full content marketing pipeline: product audit → competitive/SEO research → audience study → 5 personas (V/I/S buyer psychology) → objection modeling → content strategy → multi-channel creation (LinkedIn, YouTube, X, website) → conditional paid ads/outreach
- [team-integrity-status](team-integrity-status/SKILL.md) — Full-stack integrity audit: migrations, schema drift, backend, API contracts, frontend, CI/CD — cross-layer architectural assessment with priority-ranked findings
- [team-competitive-landscape](team-competitive-landscape/SKILL.md) — Competitive Landscape: parallel competitor audits (8 dimensions), ecosystem analysis, cross-competitor synthesis, Notion publish via ollama-cloud bridge
- [team-architecture-triage](team-architecture-triage/SKILL.md) — Architecture Triage: inventories blueprint repo, cross-references live repos, categorizes files (CURRENT/IMPLEMENTED/OUTDATED/RESEARCH/ABANDONED/FUTURE), produces triage report, executes user-approved archival
- [team-project-status-report](team-project-status-report/SKILL.md) — Project Status Report: 6 agents in 3 phases — expert trio (product, package, risk) → investigation pair (features, readiness) → lead synthesis — PDF-ready status report with exec summary, product matrix, dependency map, risk register, action plan
- [team-pricing-strategy](../../plugin/skills/team-pricing-strategy/SKILL.md) — Comparable product research → willingness-to-pay analysis → revenue scenarios → pricing ladder recommendation with rationale
- [team-hiring-brief](../../plugin/skills/team-hiring-brief/SKILL.md) — Business need mapping → candidate profile → sourcing channels by geography → job description + evaluation rubric
- [team-email-audience](../../plugin/skills/team-email-audience/SKILL.md) — Audience & niche map → content pillar framework → 6-month content calendar → 5-email welcome sequence → conversion review
- [team-offer-packaging](../../plugin/skills/team-offer-packaging/SKILL.md) — Sprint: pain mapping → offer anatomy (scope, deliverables, name, price) → copy-paste-ready Offer Sheet
- [team-financial-model](../../plugin/skills/team-financial-model/SKILL.md) — Assumptions intake → 12-month revenue model × 3 scenarios → break-even analysis → plain-English executive narrative

## Display Registry

When creating, renaming, or removing any skill, command, workflow, or team,
update `.claude/skills/display-registry.json` with the display name and category.
This file drives the AgentHub UI skills dropdown. Format:

```json
"skill-id": { "displayName": "Human Readable Name", "category": "category-key" }
```

Category keys: `code-quality`, `ai-config`, `market-intel`, `competitor-analysis`, `content-voice`, `workflows`, `teams`, `utilities`.
