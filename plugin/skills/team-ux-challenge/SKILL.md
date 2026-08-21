---
name: team-ux-challenge
description: UX Challenge Team Orchestrator — full-site audit + per-page adversarial UX↔UI brainstorm + 4-persona critique + least-friction convergence + gap analysis, producing sprint plans for every page
category: dev-skills
---

# UX Challenge Team

End-to-end adversarial design team that audits the **entire website**, then processes each page through competitor research, a tight brief, an adversarial UX↔UI pair, six concurrent critics, least-friction convergence, and a sprint plan — page by page until the full site is covered, including a gap analysis for missing pages.

## When to Use

- "Design a website/marketplace for [category]" or "redesign the [X] site"
- You want a design that survives adversarial critique before any code is written
- You need the 4 emotional buyer personas (Technical, Sceptical, Time-to-Think, ROI) addressed without conflict
- You want a converged design — not a pile of competing opinions — before implementation
- You want the **full website** reviewed and improved, not just the homepage

Do NOT use for:
- Pure research (use `team-design-research` instead — it produces a brief, not a converged design)
- Backend-only features
- Quick one-file component tweaks (just use `dev-frontend` directly)
- Implementation (this team hands off to `/team-sprint-planner`, which spawns `team-dev-loop` + `frontend-design` + `frontend-wire-verifier`)

## What You Need Before Starting

- Target category (e.g. "SaaS analytics dashboard", "handmade goods marketplace")
- Whether the output is a WEBSITE or an APPLICATION (drives the workflow mode)
- Any existing design brief — if present and < 30 days old, Stage 1 research is skipped
- Optional: brand constraints (colors, fonts, voice) — if left empty, `ui-designer` selects them post-brainstorm

## What This Team Produces

All outputs are written to `docs/ux-challenge/new-ux/` in the target repo:

- `new-ux/00-site-audit.md` — full site inventory: every page, route, section, component, footer, legal pages, auth flows, payment flows (Stage 0A)
- `new-ux/00-trend-brief.md` — competitor teardown + trend extraction (Stage 1, run once for entire site)
- `new-ux/[NN]-[page-slug]-tight-brief.md` — tight brief per page (Stage 2)
- `new-ux/[NN]-[page-slug]-converged-design.md` — converged design per page: layout spec, interaction spec, component mapping, accessibility checklist, friction audit, plain-language labels, copy direction (Stages 3–5)
- `new-ux/[NN]-[page-slug]-sprint.md` — sprint plan per page, handed to `/team-sprint-planner` (Stages 6–7)
- `new-ux/XX-gap-analysis.md` — missing pages/sections report + sprint plans for additions (Stage 8)

Page numbering: `01-homepage`, `02-marketplace-browse`, `03-pack-detail`, etc. — ordered by the priority set during site audit.

## Agent Sequence

### Phase A: Site Audit + Trend Research (run ONCE)

1. **[Stage 0A]** lead-ux-challenge — **Full Site Audit**: confirm category, WEBSITE vs APPLICATION mode, brand constraints, repo target. Then launch `repo-mapper` to extract every route, page, section, component, footer link, legal page, auth flow, and payment flow from the target repo. Sources: app router structure, sitemap.xml/ts, nav components, footer components, middleware redirects. Output: `new-ux/00-site-audit.md` — a numbered, prioritized page inventory. Present to user for confirmation before proceeding. (1 active)

2. **[Stage 1]** competitor-trend-researcher — websearch same-category sites + chrome-devtools MCP trend extraction (awwwards, i-designaward, land-book, mobbin, refero). Produces trend brief. This runs ONCE for the entire site — not repeated per page. Output: `new-ux/00-trend-brief.md` (1 active)

### Phase B: Per-Page Design Loop (repeats for EACH page in the audit)

The lead picks the next page from the audit inventory (in priority order) and runs Stages 2–7 for that page. When Stage 7 completes, loop back to Stage 2 for the next page.

3. **[Stage 2]** lead-ux-challenge — compresses the trend brief + page-specific context into a tight brief for THIS page (positioning, audience, emotional arc, constraints)

4. **[Stage 3]** ux-architect + ui-designer — adversarial UX↔UI pair for THIS page. Dynamic brainstorm rounds until the objection log is empty or two consecutive rounds produce identical objections (stall). (2 active)

5. **[Stage 4]** 6 critics in two waves of 3 — wave 1: technical-critic + sceptical-critic + time-to-think-critic; wave 2: roi-critic + emotional-onboarding + content-layout-expert. Each produces a severity-ranked concern list for THIS page. (3 active per wave)

6. **[Stage 5]** lead-ux-challenge — least-friction convergence for THIS page: resolve objections, tie-break on least-friction rule, escalate genuinely-equal trade-offs to the user

7. **[Stage 6]** lead-ux-challenge — lock the design for THIS page, write the implementation plan

8. **[Stage 7]** lead-ux-challenge — invoke `/team-sprint-planner` for THIS page (spawns `team-dev-loop` as builder + `frontend-design` + `frontend-wire-verifier` as supervisors). Sprint output goes to `new-ux/[NN]-[page-slug]-sprint.md`

9. **[LOOP]** If more pages remain in the audit inventory → return to Stage 2 for the next page. If all pages are done → proceed to Stage 8.

### Phase C: Gap Analysis (run ONCE, after all pages processed)

10. **[Stage 8]** lead-ux-challenge — **Gap Analysis**: review the full site audit against the completed designs. Identify missing pages or sections that should exist but don't (e.g., about us, blog, changelog, status page). For each missing page: describe what it should contain, where it should link from (nav, footer, etc.), and its priority. Present findings to user. If user approves new pages, run Stages 2–7 for each. Output: `new-ux/XX-gap-analysis.md`

## Site Audit Checklist (Stage 0A)

The site audit MUST cover all of these categories:

| Category | What to Extract |
|---|---|
| **Routes** | Every page route from app router (static + dynamic `[slug]` routes) |
| **Sitemap** | Parse `sitemap.xml` or `sitemap.ts` for all public URLs |
| **Navigation** | Every link in navbar, mobile drawer, dropdowns |
| **Footer** | Every footer link, column structure, legal links |
| **Legal pages** | Privacy, terms, refunds, cookies, GDPR, affiliate terms |
| **Auth flows** | Sign up, sign in, password reset, email verification, onboarding |
| **Payment flows** | Checkout, subscription management, upgrade/downgrade, invoices |
| **Product pages** | Individual product/pack detail pages (dynamic routes) |
| **Role/audience pages** | /for-consultants, /for-developers, etc. |
| **Marketing pages** | Pricing, affiliate program, contact, about |
| **API/docs pages** | API documentation, help center, FAQ, changelog |
| **Error pages** | 404, 500, maintenance |
| **Mobile responsiveness** | Flag for audit across all discovered pages |

## Key Rules

- Max 3 agents active at once (project rule)
- Stages never overlap (Stage 3 complete before Stage 4 starts)
- Stage 0A site audit MUST complete and receive user confirmation before any design work begins
- Stage 1 trend research runs ONCE — never repeated per page
- Stage 3 brainstorm runs dynamic rounds — never a fixed count; terminate on empty objection log or stall
- Stage 4 critics run in waves of 3, never all 6 at once
- Stage 5 convergence applies least-friction tie-break; genuinely-equal trade-offs escalate to the user, never self-resolved
- Stage 7 is non-negotiable — `/team-sprint-planner` is ALWAYS invoked per page, never skipped
- The per-page loop (Stages 2–7) continues until ALL pages in the audit are processed — never stop after the homepage
- Stage 8 gap analysis is mandatory — always check for missing pages after all existing pages are done
- All outputs go to `docs/ux-challenge/new-ux/` — one folder for the entire site redesign
- No commit without user approval of each page's converged design

## Common Mistakes

| Mistake | Fix |
|---|---|
| Only designing the homepage | The site audit (Stage 0A) lists ALL pages — the loop processes every one |
| Skipping the site audit | Stage 0A is mandatory — you cannot design pages you haven't inventoried |
| Re-running trend research per page | Stage 1 runs ONCE. Pages reuse the same trend brief |
| Starting Stage 4 before Stage 3 brainstorm terminates | Lead must confirm the objection log is empty or stalled first |
| Running all 6 critics at once | Strictly enforce two waves of 3 (wave 1: technical + sceptical + time-to-think; wave 2: roi + emotional-onboarding + content-layout-expert) |
| Self-resolving a genuinely-equal trade-off in Stage 5 | Escalate to the user — least-friction only breaks ties, it does not override user preference |
| Skipping `/team-sprint-planner` for a page | The handoff is mandatory per page — this team produces designs, not code |
| Letting ui-designer and ux-architect agree too early | The pair is adversarial by design; agreement without challenge is a failure mode |
| Using design-research team when you need this team | design-research = research brief only. ux-challenge = converged design + plan |
| Skipping gap analysis (Stage 8) | Always check for missing pages — about us, blog, changelog are commonly missing |
| Writing sprint plans outside `new-ux/` folder | ALL outputs go to `docs/ux-challenge/new-ux/` in the target repo |
| Not numbering pages in priority order | Pages are numbered `01-`, `02-`, etc. in the order set during site audit |
