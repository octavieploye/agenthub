---
name: team-hiring-brief
description: Hiring Brief Team — maps the business need, profiles the ideal candidate, selects sourcing channels by geography, and produces a job description and evaluation rubric
category: ceo-advisory
---

# Team Hiring Brief

4-phase team that turns a "we need to hire someone" signal into a complete hiring package: a role definition grounded in business need, a candidate profile with must-have vs. nice-to-have attributes, a sourcing strategy by geography and platform, a job description written to attract the right person and repel the wrong one, and an evaluation rubric for screening and interviews.

## When to Use

- You need to hire a VA, developer, copywriter, marketer, sales rep, or any team member
- Your job posts attract the wrong candidates and you do not know why
- You are hiring for the first time and do not have a template or process
- You need to know where to find candidates (platforms, communities, geography)
- Use AFTER `team-business` if the role is strategic and depends on a validated business model

## What You Need Before Starting

- The business problem you are trying to solve by hiring (not the job title — the problem)
- The stage of your business (solo / small team / scaling)
- Geography or remote preference (if any)
- Budget range (even rough: hourly / monthly / annual)

## What This Team Produces

1. **Role Definition Brief** — the business problem the hire solves, the deliverables the role owns, and why this role now (not later)
2. **Candidate Profile** — must-have attributes (3–5), nice-to-have attributes (3–5), red flags (3–5), and one-paragraph description of the ideal person
3. **Sourcing Strategy** — 3–5 platforms or communities ranked by fit for this role and geography, with outreach approach for each
4. **Job Description** — full-length posting: hook headline, role summary, deliverables, requirements, what to expect, how to apply (written to attract the right person and repel mismatches)
5. **Evaluation Rubric** — 5–7 screening questions with what a strong vs. weak answer looks like, and a structured scoring grid for final candidates

## Agent Sequence

1. `business-analyst` — Phase 1: maps the business need, outputs the Role Definition Brief (user-confirmed before Phase 2)
2. `persona-profiler` — Phase 2: profiles the ideal candidate using the same depth as a buyer persona — attributes, motivations, red flags
3. `channel-strategist` — Phase 3: sourcing platforms, communities, and outreach approach by geography and role type
4. `clarity-writer` — Phase 4: writes the job description and evaluation rubric from Phases 1–3 output (blocked until all prior phases deliver)

Max 3 agents active at once. Phase 2 and 3 may run in parallel. Phase 4 is blocked until both complete.

## Key Rules

- Phase 1 requires user confirmation before Phase 2 begins — the role definition is the foundation of everything else
- Candidate attributes must be grounded in the business need, not generic HR templates
- Red flags must be specific and behavioral — not personality judgements
- Job description must lead with outcome, not duties — what the right person will achieve, not what they will do
- Sourcing channels must be specific (e.g., "Toptal for senior developers in EU timezone" not "LinkedIn")
- If budget is below market rate for the role defined, flag it — do not write a job posting for a role that cannot be filled at that price

## How to Invoke

Tell lead-hiring-brief the business problem you are solving by hiring and your stage. Lead will run Phase 1 and present the Role Definition Brief before any profiling or job description work begins.
