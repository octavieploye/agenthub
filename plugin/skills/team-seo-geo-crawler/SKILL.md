---
name: team-seo-geo-crawler
description: SEO/GEO Crawler Team Orchestrator — crawls any URL as Google + AI bots, runs Google SEO + GEO parallel analysis, then live SEMrush/SimilarWeb keyword research. Outputs full audit report + keyword strategy doc with vocabulary alternatives for non-tech buyers.
category: marketing
---

# SEO/GEO Crawler Team

Crawls a live URL the way Google and AI search engines do, audits all visibility gaps across both Google and AI search (GEO), then runs live keyword research to find the exact vocabulary your non-technical target buyers actually use — including vocabulary alternatives for category terms that carry wrong connotations (e.g. "AI workflows" = automation to most people, even when the product is structured reasoning).

## When to Use

- You need a full SEO + AI search (GEO) visibility audit on any URL
- You want to know what Googlebot and AI bots (Perplexity, ChatGPT Search, Claude Search) would extract from your site
- You need keyword research targeting non-technical buyers — not developers
- You want to find better vocabulary for your product category (a term that triggers the right mental model in non-tech users)
- You want to benchmark who currently owns the queries you are targeting
- You need both a technical audit AND a content + keyword strategy in one run

## What You Need Before Starting

- A live URL (e.g. `https://opeidos.com`)
- Optional: one-paragraph description of what the product does and who the target buyer is
- Optional: competitor URLs to benchmark against
- Optional: vocabulary terms you want to avoid or replace (and why)

## Agent Sequence

```
Phase 1 — seo-bot-crawler
  Crawls URL as Google + AI bot. Extracts metadata, JSON-LD, FAQ,
  headings, robots.txt, sitemap, llms.txt, OG tags.
  → outputs: structured crawl report

Phase 2 — seo-google-expert + seo-geo-engineer (parallel)
  seo-google-expert reads crawl report → Google SEO audit + 3-phase action plan
  seo-geo-engineer reads crawl report → AI/GEO visibility audit + citation strategy

Phase 3 — seo-keyword-researcher
  Runs LIVE web searches. Maps competitive keyword landscape.
  Brainstorms vocabulary alternatives. Produces content brief.
  → outputs: keyword map + vocabulary strategy

Phase 4 — seo-crawler-lead
  Synthesizes all outputs → seo-geo-report-{date}.md + keyword-strategy-{date}.md
```

## What This Team Produces

**File 1: `seo-geo-report-{YYYY-MM-DD}.md`**
- Executive summary (5 bullets)
- Bot crawl findings (what Google + AI bots see)
- Google SEO audit + 3-phase action plan (quick wins, structural, authority)
- AI/GEO visibility score + citation strategy per AI engine
- Competitor landscape
- Prioritised action plan: CRITICAL / HIGH / MEDIUM / LOW

**File 2: `keyword-strategy-{YYYY-MM-DD}.md`**
- Keyword map: target queries, competition level, who owns them today
- Vocabulary analysis: current terms and why they misfire with non-tech buyers
- 15–20 vocabulary alternatives with rationale + live search evidence
- Top 3 content pieces to publish first
- Non-tech buyer intent map: what they actually search when they want what you sell

## Key Rules

- seo-bot-crawler runs FIRST — no analysis before the crawl report is complete
- seo-google-expert and seo-geo-engineer run IN PARALLEL (2 active, within the 3-agent cap)
- seo-keyword-researcher uses LIVE WebSearch — never substitute with training knowledge alone
- Vocabulary brainstorm must be grounded in what non-tech users actually search (live search evidence required)
- Never more than 3 agents active simultaneously
