# MODULE: ops/validation-sprint
TYPE:   Operations — Pre-product market validation
OWNER:  readiness-analyst (gate + niche) · campaign-analyst (loop) · content-creator (creatives) · channel-strategist (Meta + deploy)
TOKENS: ~650
TRIGGER: Load when no validated market signal exists for the product — before M1 begins.
         Also load when user says "validate idea", "run validation sprint", or "is there a market for X".

## PURPOSE

Validate a niche and pre-sell an idea BEFORE building anything. Source: L7V Venture Studio
9-prompt playbook. Full prompts always at l7v.com/ai (prompts update; this workflow does not).

**Gate rule:** Do not begin M1 until 50+ email signups validate demand. This sprint produces
that signal or kills the idea cheaply ($70–210 total test cost).

---

## AGENT OWNERSHIP

| Agent | Prompts | Responsibility |
|---|---|---|
| readiness-analyst | Gate + P1 | AppMagic research, 3-filter check, blue ocean brief, go/no-go |
| persona-profiler | P2 | Product spec — one-liner, target users, look/feel, viral hook |
| content-creator | P3 + P6 | Mockups (Higsfield MCP + GPT Image 2) + ad creatives |
| channel-strategist | P7 + P8 | Vercel deploy + Meta campaign upload |
| campaign-analyst | P9 | Self-improving ad loop — runs every 1–3 days for 14 days |
| lead-marketing | Handoff gate | Validates 50+ signups before authorizing M1 to begin |

AgentHub concurrency: P3 (mockups) + P4 (landing page) + Meta manual setup run in parallel
via 3 concurrent agents — collapses 2hr sequential flow to ~45 minutes.

---

## 9-PROMPT FLOW

```
Manual: AppMagic research (appmagic.rocks, ~15 min)
  ↓
P1 — Blue ocean brief (Claude + AppMagic app URL → market size + 5 blue ocean ideas)
  ↓
P2 — Full product spec (chosen idea → one-liner, strategy, users, look/feel, features, viral)
  ↓
P3 — Mockups (Higsfield MCP, GPT Image 2, screenshot suite + before/after images)    ← PARALLEL
P4 — Landing page (quiz flow → email capture → admin dashboard, mobile responsive)    ← PARALLEL
     + Meta Events Manager setup (manual, ~10 min — create pixel, note pixel ID)      ← PARALLEL
  ↓
P5 — Meta pixel install (Meta Ads MCP + pixel ID → fires on email submission only)
  ↓
P6 — Ad creatives (Higsfield Marketing Studio — UGC, before/after, comparison, lifestyle, video)
                                                              ← PARALLEL with P7 (new session)
P7 — Vercel deploy (new Claude session + Vercel token 1-day expiry → live .vercel.app URL)
  ↓
P8 — Upload ads + set Meta campaigns (live URL → campaigns optimized for lowest cost/signup)
  ↓
P9 — Self-improving loop (Meta MCP pulls top ads → Higsfield generates variations → upload)
     Run every 1–3 days. After 14 days: cost per conversion falls 50–80%.
```

Required MCPs (add in Claude Settings → Connectors):
- Higsfield: higsfield.ai → MCP and CLI
- Meta Ads: search "Meta Ads MCP"
- Vercel: search "Vercel MCP"

---

## NICHE OPPORTUNITY FRAMEWORK — 3-Filter Method

Run before P1. If any filter fails, find a different niche before proceeding.

**Filter 1 — Category heat (AppMagic)**
- Is a top-grossing app in this category making $1M+/month?
- Is the category growing year-over-year?
- Are 2–5 competing apps each making real revenue? (Competition = validation, not a problem)

**Filter 2 — Blue ocean gap (P1 output)**
- Sub-niche the top app explicitly ignores? (check 1-star reviews for complaints)
- Adjacent emotion the main app doesn't address? (PictureThis: plant ID → gap: plant *design*)
- Expressible as a before/after visual? (highest viral format)

**Filter 3 — Virality (before launching)**
- Would a user naturally share the result the app produces?
- Does the core value read in 3 seconds on a feed?
- Can you show the value in a 15-second video without explanation?

**Hot categories (proven viral mechanics, 2026):**
Home/garden transformation · Body/fitness · Learning/skill acquisition
Finance/money tracking · Creative tools · Parenting/child milestones

---

## MONETIZING PROPOSITION FRAMEWORK

| Model | Price | Best for | Build signal |
|---|---|---|---|
| App subscription | $5–$15/mo | Recurring value tools | 50+ signups at <$2 CAC |
| One-time digital | $27–$197 | Courses, templates, playbooks | 20+ signups + quiz intent |
| High-ticket | $500–$5K+ | Post-list, quiz-segmented | Highest-intent quiz segment |
| Community + tool | $29–$99/mo | Niche recurring need | Community first, tool second |

**Monetization sequence (AgentHub/Optimaeus context):**
1. Validate niche → landing page + $30/day Meta test (this sprint)
2. Email list → one-time offer ($47–97) → immediate revenue, funds development
3. Productize as monthly subscription → recurring revenue
4. Add community (Discord/Circle) → retention + upsell surface
5. Build AgentHub Validation Sprint Skills → Business mode feature (9 prompts = 9 skills)

---

## DECISION GATE

| Signal | Meaning | Action |
|---|---|---|
| <$2/signup after 3 days | Real demand | Increase budget |
| $2–$5/signup | Normal | Continue 7 days |
| >$10/signup after 3 days | Bad targeting or offer | Kill — rewrite headline |
| 50+ signups in 7 days | Validated | Authorize M1 — begin building |
| <10 signups in 7 days | Not validated | Pivot niche or offer |

Budget: $10–30/day × 7 days = $70–210 total test cost.
Run minimum 7 days — Meta needs 30–50 conversions to lock its algorithm.

---

## CONSTRAINTS — NEVER VIOLATE

- Never add fake social proof (reviews, waitlist counts, fabricated testimonials) — remove before launch
- Never publish ads without human review in Meta Ads Manager
- Vercel token: 1-day expiry — regenerate per deployment, never reuse
- Do NOT begin M1 or build the product until 50+ email signups validate demand
- Set a fixed test budget before starting — commit to it regardless of early signals

---

## REFERENCE

Full step-by-step reference: `docs/marketing/vibe-marketing-validation-workflow.md`
Invocable skill (solo use): `.claude/skills/vibe-marketing-validation/SKILL.md`
