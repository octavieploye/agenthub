# KNOWLEDGE: Claude Enterprise — Pricing, Features & Decision Guide
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Anthropic official docs, Claude Help Center, web research (June 2026)

---

## PURPOSE

Complete guide to Claude's plan tiers with pricing, features, and decision
framework for choosing the right plan. Includes model pricing and real-world
cost estimates.

---

## ALL PLANS COMPARED

| | Free | Pro | Max | Team | Enterprise |
|---|---|---|---|---|---|
| Price | $0 | $20/mo | $100-200/mo | $25/seat/mo | $20/seat + usage |
| Min seats | 1 | 1 | 1 | 5 | 70 |
| Max seats | 1 | 1 | 1 | 150 | Unlimited |
| Billing | — | Monthly | Monthly | Monthly/Annual | Annual (12-month contract) |
| Data training | Yes (default) | Yes (opt-out) | Yes (opt-out) | Never | Never |
| SSO | No | No | No | Google/MS only | SAML 2.0 + OIDC |
| SCIM | No | No | No | No | Yes |
| Audit logs | No | No | No | Basic | Full + Compliance API |
| Data retention | Default | Default | Default | 30-day default | Configurable + ZDR |
| DPA | No | No | No | Yes | Yes |
| HIPAA / BAA | No | No | No | No | Yes |
| Shared Projects | No | No | No | Yes | Yes |
| Role-based access | No | No | No | Basic | Fine-grained + groups |
| Spend controls | No | No | No | No | Per-user + per-org |
| Managed policies | No | No | No | No | Yes (users cannot override) |
| Includes | Chat | Chat | Chat + priority | Chat + Code + Cowork | Chat + Code + Cowork |

---

## MODEL PRICING (API rates, as of mid-2026)

| Model | Input (per 1M tokens) | Output (per 1M tokens) | Context window | Max output |
|---|---|---|---|---|
| Haiku 4.5 | $1 | $5 | 200k | 64k |
| Sonnet 4.6 | $3 | $15 | 1M | 64k |
| Opus 4.7 | $5 | $25 | 1M | 128k |
| Opus 4.8 | $5 | $25 | 1M | 128k |
| Fable 5 | TBD | TBD | 1M | 128k |

### Model selection guidance:
- **Sonnet 4.6** — default for most work. Fast, capable, cost-efficient.
- **Opus 4.7/4.8** — deep reasoning: large refactors, hard debugging, architecture.
- **Haiku 4.5** — quick lookups, simple edits, high-volume scripted runs.

---

## REAL-WORLD COST PER USER (Enterprise)

The $20/seat fee is the floor. Real cost depends on usage.

| Usage profile | Seat fee | Usage/mo | Total per user/mo |
|---|---|---|---|
| Light (chat, simple Q&A) | $20 | $10-30 | $30-50 |
| Moderate (docs, writing, analysis) | $20 | $50-100 | $70-120 |
| Heavy (coding, large context) | $20 | $100-250 | $120-270 |
| Power user (Claude Code, multi-agent) | $20 | $250-500+ | $270-520+ |

### Minimum annual commitment:
70 seats × $20/seat × 12 months = $16,800/year (seats only) + usage.
Total minimum ~$50k/year with moderate usage.

---

## ENTERPRISE-ONLY FEATURES (what Team does NOT have)

| Feature | What it does |
|---|---|
| SAML SSO | Connect any identity provider (Okta, Entra ID, etc.) |
| SCIM provisioning | Auto-sync users from identity provider |
| Compliance API | Programmatically query user activity, conversations, admin changes |
| Configurable retention | Set custom retention periods (not just 30-day default) |
| Zero Data Retention (ZDR) | Data deleted immediately after processing (minutes) |
| Fine-grained roles + user groups | Role-based access with SCIM-managed groups |
| Per-user spend caps | Limit how much each user can consume |
| Managed policies | Org-wide settings users cannot override (MCP, tools, etc.) |
| HIPAA / BAA | Business Associate Agreement for healthcare |
| BYOK | Bring Your Own Key — manage encryption keys directly (H1 2026) |

---

## DATA PRIVACY BY PLAN

| Plan | Training on your data | Retention | Legal protection |
|---|---|---|---|
| Free | Yes (default) | Standard (up to 5 years if training) | Terms of Service only |
| Pro | Yes (opt-out available) | Standard | Terms of Service |
| Max | Yes (opt-out available) | Standard | Terms of Service |
| Team | Never | 30-day default | DPA + Commercial Terms |
| Enterprise | Never | Configurable + ZDR option | DPA + Enterprise Terms + BAA option |

### Key distinction:
- Consumer plans: opt-OUT of training (you must take action)
- Business plans: training is contractually prohibited (no action needed)

---

## DECISION TREE — WHICH PLAN

```
1. Solo user, personal use?
   YES → Free (casual) or Pro ($20/mo) or Max ($100-200/mo for power users)

2. Team of 2-5?
   YES → Team plan ($25/seat)

3. Team of 5-70?
   YES → Team plan ($25/seat) — Enterprise min is 70 seats

4. Team of 70+?
   → Do you need SAML SSO / SCIM?        → Enterprise
   → Do you need Compliance API?          → Enterprise
   → Do you need HIPAA / BAA?             → Enterprise
   → Do you need ZDR?                     → Enterprise
   → Do you need managed policies?        → Enterprise
   → None of the above?                   → Team is sufficient

5. Regulated industry (healthcare, finance, legal)?
   YES → Enterprise (ZDR + BAA + Compliance API + Audit)
```

---

## SOVEREIGNTY ASSESSMENT

| Capability | Sovereignty impact |
|---|---|
| No training on data | Good — your data stays yours |
| ZDR | Good — not stored after processing |
| DPA | Good — legal protection |
| BYOK | Good — encryption key control |
| US-incorporated | Risk — subject to CLOUD Act |
| Data transits US infrastructure | Risk — not architecturally sovereign |

### Verdict:
Claude Enterprise is appropriate for INTERNAL classified data.
NOT sufficient for CONFIDENTIAL data requiring full sovereignty.
See data-sovereignty-governance.md for the full access matrix.

---

## ANTI-PATTERNS

1. Choosing Enterprise for <70 users — you cannot, minimum is 70 seats
2. Assuming $20/seat is the total cost — real cost is $70-500+/user with usage
3. Using consumer Claude (Free/Pro) for business data — training is ON by default
4. Assuming Enterprise = sovereign — legally defensible, not architecturally sovereign
5. Not enabling ZDR when handling sensitive data — data retained by default
6. Choosing Team when you need Compliance API — it is Enterprise-only
7. Not setting per-user spend caps — one power user can consume the entire budget
