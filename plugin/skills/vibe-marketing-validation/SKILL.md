---
name: vibe-marketing-validation
description: Use when the user wants to validate a product idea, find a monetizable niche, or run a pre-sell campaign before building. Also use when launching a new blue ocean opportunity, setting up a Meta validation campaign, or running the L7V 9-prompt playbook.
category: business-venture
---

# Vibe Marketing — AI Validation Playbook

Validate a niche and pre-sell a product idea with 9 prompts before writing a line of code. Source: L7V Venture Studio playbook. Full prompts always at **l7v.com/ai**.

Full workflow reference: `docs/marketing/vibe-marketing-validation-workflow.md`
Marketing team session (team context): `.claude/workflow-team-library/marketing/ops/validation-sprint.md`

## Core Principle

**Validate before building.** Set a dollar budget you can afford to lose, run ads to a pre-sell landing page, and count email signups before committing to product development.

---

## The 9-Prompt Workflow

```
AppMagic research (manual, 15 min)
    ↓
Prompt 1 — Blue ocean brief (Claude)
    ↓
Prompt 2 — Product spec (Claude)
    ↓
Prompt 3 — Mockups + visual assets (Higsfield MCP + GPT Image 2)
    ↓                              ↓ parallel
Prompt 4 — Landing page build      Meta Ads Manager setup (manual)
    ↓
Prompt 5 — Meta pixel install (Meta Ads MCP)
    ↓
Prompt 6 — Ad creative generation (Higsfield Marketing Studio + Seed Dance 2.0)
    ↓                              ↓ parallel
Prompt 7 — Vercel deploy           ← run in new Claude session
    ↓
Prompt 8 — Upload ads + set up Meta campaigns
    ↓
Prompt 9 — Self-improving loop (run every 1–3 days)
```

---

## Required MCPs (add in Claude Settings → Connectors)

| MCP | Where to get it |
|---|---|
| Higsfield | higsfield.ai → MCP and CLI |
| Meta Ads | Google "Meta Ads MCP" |
| Vercel | Google "Vercel MCP" |

---

## Phase 1 — Niche Discovery (Manual)

1. Open **appmagic.rocks** (free tier)
2. Filter: App Store → category → US → Top Grossing → this month
3. Find an app ranked #2–#10 that is growing (moved up spots = momentum)
4. Revenue signal: $1M+/month lifetime = proven market
5. Do NOT build a direct competitor — find the adjacent gap

**Blue Ocean Filter (apply before Prompt 1):**
- Sub-niche the main app ignores?
- Adjacent emotion it doesn't address?
- Does it produce a before/after visual moment? (highest viral format)

---

## Execution Steps

### Step 1 — Run Prompt 1 (Blue Ocean Research)
- Go to l7v.com/ai → copy Prompt 1
- Paste into Claude with the AppMagic URL appended
- Output: market size, competitive map, 5 blue ocean ideas
- **Pick one**: highest viral potential + clear before/after moment + one-sentence explainer

### Step 2 — Run Prompt 2 (Product Spec)
- Copy Prompt 2 from l7v.com/ai, fill in your idea number
- Output: one-liner, strategy, users, look/feel, core features, viral highlights
- Read the spec. Edit anything that feels wrong. This document drives everything downstream.

### Step 3 — Run Prompt 3 (Mockups — Higsfield MCP)
- Copy Prompt 3 from l7v.com/ai
- Confirm Higsfield MCP is connected, model = GPT Image 2
- Output: product screenshot suite + before/after images
- Reject hallucinated images, give feedback to regenerate

### Step 4 — Run Prompt 4 (Landing Page) + Set Up Meta in Parallel
- Copy Prompt 4 from l7v.com/ai → start building landing page
- **While it runs**: go to Meta Events Manager → Connect Data → Web → create pixel → note pixel ID
- Landing page output: quiz flow → email capture → admin dashboard
- **Remove all fake social proof before launching**

### Step 5 — Run Prompt 5 (Meta Pixel)
- Copy Prompt 5 from l7v.com/ai, paste your pixel ID
- Output: pixel installed, fires only on email submission, validated via Meta MCP

### Step 6 — Run Prompt 6 (Ad Creatives — Higsfield Marketing Studio)
- Copy Prompt 6 from l7v.com/ai, set quantity = 5 for first run
- Formats: UGC, before/after reveal, comparison table, lifestyle, video (Seed Dance 2.0)
- Saved to `/marketing-assets/` subfolder

### Step 7 — Run Prompt 7 (Vercel Deploy — new session)
- Open a **new Claude session** (run in parallel with Step 6)
- Create Vercel token: vercel.com → Tokens → 1-day expiry → copy
- Copy Prompt 7, paste token
- Output: live Vercel.app URL — share this URL in Prompt 8

### Step 8 — Run Prompt 8 (Launch Meta Campaigns)
- Return to original session
- Copy Prompt 8 from l7v.com/ai, paste live Vercel URL
- Output: ads uploaded to Meta, campaigns created, Claude links you to Ads Manager
- **Human approves and publishes** — never auto-publish

### Step 9 — Run Prompt 9 (Self-Improving Loop — repeat every 1–3 days)
- Copy Prompt 9 from l7v.com/ai
- Output: pulls best-performing ads from Meta, generates new variations via Higsfield, uploads new tests
- Run this every 1–3 days for 14 days — cost per conversion falls as Meta's algorithm learns

---

## Validation Decision Gate

| Signal | What it means | Action |
|---|---|---|
| <$2 cost/signup after 3 days | Real demand signal | Increase budget |
| $2–$5 cost/signup | Normal, keep running | Continue 7 days |
| >$10 cost/signup after 3 days | Bad targeting or offer | Kill, rewrite headline |
| 50+ signups in 7 days | Validated | Start building |
| <10 signups in 7 days | Not validated | Pivot niche or offer |

**Budget recommendation:** $10–$30/day for 7 days = $70–$210 total test cost.

---

## Niche Opportunity Quick Reference

**Hot categories with proven viral mechanics:**
- Home/garden transformation → before/after rooms and gardens
- Body/fitness → before/after physique reveal
- Learning → "I learned X in 30 days" progress reveal
- Finance → dashboard reveal ("I saved $X this month")
- Creative tools → output reveal (art, music, generated content)
- Parenting → milestone and progress sharing

**Monetization model sequence:**
1. Validate with landing page + Meta test
2. Email list → one-time offer ($47–$97) → immediate revenue
3. Productize as monthly subscription → recurring
4. Add community → retention
5. Scale with self-improving ad loop

---

## AgentHub Integration

This playbook runs best with **3 concurrent AgentHub agents**:
- Agent 1 (research): Prompts 1–2
- Agent 2 (creative): Prompts 3 + 6
- Agent 3 (dev + deploy): Prompts 4 + 5 + 7

Parallel execution collapses the 2-hour sequential timeline to ~45 minutes.

Each of the 9 prompts is a candidate AgentHub Skill for the Business mode Validation Sprint feature.

---

## Key Constraints

- Never add fake social proof, fake waitlist counts, or fabricated testimonials
- Never publish ads without human review in Meta Ads Manager
- Vercel token: 1-day expiry, regenerate per deployment
- Run ads minimum 7 days before deciding — Meta needs 30–50 conversions to lock the algorithm
- Do not start building until 50+ email signups validate demand
