---
name: team-competitive-landscape
description: Competitive Landscape Team Orchestrator — parallel competitor audits, ecosystem analysis, business synthesis, Notion publish via ollama-cloud bridge
category: business-analysis
---

# Competitive Landscape Team

Full competitive intelligence pipeline: research → ecosystem → synthesis → Notion publish.

## When to Use

- User wants competitive intelligence on a product or market
- User names competitors to audit (URLs, product names, GitHub repos)
- User says "competitive analysis", "market landscape", "competitor audit"
- After a new competitor is discovered and needs deep research
- Periodic competitive refresh (quarterly recommended)

## What You Need Before Starting

1. **Competitor list** — URLs, product names, or GitHub repos to audit
2. **Our product repo** — path to the repo being compared against (for baseline)
3. **Target audience** — who are we comparing for? (developers, CEOs, enterprises)
4. **Notion access** — ollama-cloud bridge must be startable (`~/.local/ollama-mcp-bridge/start.sh`)

## What This Team Produces

1. Per-competitor deep audit reports (8 dimensions each)
2. Ecosystem landscape analysis (non-product entities)
3. Cross-competitor synthesis (comparison matrix, moats, gaps, pricing, distribution)
4. Notion pages updated via ollama-cloud bridge
5. Agent memory entries saved for future reference
6. `.llm/notion/` memory entries for Notion agent consumption

## Agent Sequence

### Phase 1 — Competitive Research (parallel, max 3 concurrent)

**Agent: competitor-auditor** (spawned once per competitor)

For each competitor, audit 8 dimensions:
1. Company & ownership (founders, entity, funding, team size)
2. Product & architecture (stack, databases, AI/LLM models, APIs)
3. Pricing & revenue (tiers, MRR/ARR estimates, payment processor)
4. Traffic & SEO (SimilarWeb/SEMrush, keywords, domain authority)
5. Marketing & channels (social, ads, content strategy, messaging)
6. Audience (target users, use cases, testimonials)
7. Strengths to reproduce (what they do well, UX patterns)
8. Country AI tech adaptation (EU AI Act, GDPR, data residency)

Sources: WebSearch, WebFetch, ProductHunt, Crunchbase, Companies House, Meta Ad Library, LinkedIn Ad Library. Label all third-party estimates as T3.

**Parallel**: Read our product repo for comparison baseline.

### Phase 2 — Ecosystem Landscape

**Agent: ecosystem-analyst**

Analyze non-product entities (frameworks, thought leadership, SDK docs):
- What they say about the problem space
- What patterns/architectures they recommend
- What gaps they identify
- How their perspective validates or challenges our approach
- Distribution channels they reveal (SDK adapter listings, directories)

### Phase 3 — Business Synthesis

**Agent: competitive-synthesizer**

From all Phase 1 + Phase 2 outputs, produce:
- Competitive comparison matrix (all dimensions)
- Unique moats identification (what no competitor has)
- Pricing gap analysis (cliff points, underserved tiers)
- Delivery model positioning (SaaS vs self-hosted vs enterprise)
- What to reproduce from each competitor
- Distribution channels identified
- P0 blockers before launch
- Action items (CEO-readable)

### Phase 4 — Publish (lead-only)

**For all Notion operations in this phase, follow LLM selection and fallback rules from `notion-skills-tree/SKILL.md`.**
Models: `glm-5.2:cloud` (primary), `gemma4:31b-cloud` (primary), `gemma4:cloud` (fallback).
Never use local models (qwen3:8b, gemma4:12b-mlx) in active mode. Never bypass the bridge with direct API calls to api.notion.com.

1. Start ollama-cloud bridge: `~/.local/ollama-mcp-bridge/start.sh`
2. Search Notion for existing pages (Competitive Intelligence, product commercial page)
3. Push synthesis to Competitive Intelligence page (`API-update-page-markdown`)
4. Append competitive update to product commercial page (`API-patch-block-children`)
5. Stop bridge: `~/.local/ollama-mcp-bridge/stop.sh`
6. Save agent memory entries (reference files in memory/)
7. Append entry to `.llm/notion/{repo}-notion-memory.md`

## Key Rules

- **Max 3 agents active at once** — Phase 1 batches competitors in groups of 3
- **All estimates labeled T3** — never present third-party data as exact
- **Lead synthesizes, auditors research** — auditors do NOT cross-compare
- **Notion push requires bridge + cloud models** — start before, stop after, never leave running. Follow `notion-skills-tree/SKILL.md` for model selection and fallback chain
- **User approves before Notion push** — unless running in autonomous mode
- **Code is truth for our product** — read actual repo, not README summaries
- **No assumptions** — if competitor data conflicts, surface both versions

## Constraints

- Never run more than 3 competitor-auditors simultaneously
- Never push to Notion without starting the bridge first
- Never leave the bridge running after Phase 4
- Never present T3 estimates without the T3 label
- Never skip the ecosystem phase — non-product context validates positioning
- Always save findings to both agent memory AND .llm/notion/ memory
