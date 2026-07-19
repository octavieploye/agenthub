---
name: risk-manager
description: Risk register for the Optimaeus ecosystem — legal risks (celebrity names, licenses, trademarks), technical risks, business risks, and infra risks across all 4 products. Produces actionable risk register with severity and remediation.
category: security
---

# Risk Manager

Produces and maintains the risk register for AgentHub, OPTimaeus, Opeidos, and LLM Workflow Packages. Covers legal, technical, business, and infrastructure risk domains.

## When to Use

- "What are the legal risks before we launch?"
- "Are we using any celebrity names in marketing?"
- "What licenses do we need to fix?"
- "Give me a risk register for the project"
- "What could block us from distributing commercially?"
- Before any public launch, marketing campaign, or commercial distribution

## Risk Domains

| Domain | Examples |
|---|---|
| LEGAL | Real person names in marketing (implied endorsement), trademark misuse, missing LICENSE file, UNLICENSED packages, dependency licenses, EULA/ToS |
| TECHNICAL | Missing code signing, no auto-update server, no E2E tests, native module mismatches, platform-specific gaps |
| BUSINESS | Cold start problem (Opeidos empty at launch), no pricing set, no GTM executed, no affiliate infrastructure |
| INFRA | No npm org, no PyPI account, no obfuscation pipeline, no license key server, no Stripe webhook setup |
| IP | Competitor reverse-engineering, no trade secret protection, public AGPL conflicts |

## Severity Scale

| Level | Meaning |
|---|---|
| CRITICAL | Blocks commercial launch. Must resolve before any public activity. |
| HIGH | Significant legal or commercial exposure. Resolve before marketing. |
| MEDIUM | Real risk, lower urgency. Resolve before scale. |
| LOW | Precautionary. Document and monitor. |

## Known Risks (as of 2026-07-13 — verify before citing)

### CRITICAL
| Risk | Product | Detail |
|---|---|---|
| [source] name used as PMF anchor | AgentHub marketing | Docs in docs/brainstorm/ + docs/marketing/ use his name as brand validation. Right-of-publicity risk. Implied endorsement without consent. |
| [source] (Mistral CEO) used as brand anchor | AgentHub/OPTimaeus marketing | Multiple strategy files use his name and YouTube talk as positioning source. Implied partnership risk. |
| `@optimaeus/destructuring` license: UNLICENSED | LLM Packages | packages/destructuring/package.json declares UNLICENSED. Cannot distribute commercially. |

### HIGH
| Risk | Product | Detail |
|---|---|---|
| LICENSE file missing | AgentHub | No LICENSE at repo root. plugin.json says MIT but no file. Cannot distribute legally. |
| Code signing disabled | AgentHub | notarize: false in electron-builder.yml. macOS Gatekeeper will block unsigned app. |
| No EULA / ToS | AgentHub | No legal terms for commercial distribution. |
| Claude™ trademark use | AgentHub marketing | Extensive use of "Claude" in positioning. Defensible by nominative fair use but needs disclaimer. |
| Mistral brand as trust signal | All products | "Powered by Mistral" implies partnership. Needs formal agreement or depersonalization. |

### MEDIUM
| Risk | Product | Detail |
|---|---|---|
| Dependency license audit gap | AgentHub | No SBOM. No FOSSA audit. No COPYING file. 100+ npm dependencies unaudited for GPL conflicts. |
| Dieter Rams reference (living designer) | OPTimaeus design docs | Living person used as design reference. Needs disclaimer. |
| No auto-update infrastructure | AgentHub | Placeholder URL only. No update server. Required before commercial distribution. |
| No npm org | LLM Packages | @optimaeus scope declared but no npm organization registered. |
| No PyPI account | LLM Packages | No PyPI publish target configured. |

## Workflow

1. Grep `docs/brainstorm/`, `docs/marketing/`, `docs/todo-business/` for real person names ([source], Mensch, Rams, any others)
2. Check `packages/*/package.json` for license field — flag UNLICENSED or missing
3. Check `LICENSE` at repo root — report missing if absent
4. Check `electron-builder.yml` for notarize field
5. Check `package.json` main for license field (agenthub root)
6. Read security audit files in `docs/superpowers/security/` for any existing risk documentation
7. Output: risk register table + immediate action list

## Output

**Risk Register Table:**
| Risk | Domain | Severity | Product | File/Location | Remediation |
|---|---|---|---|---|---|

**Immediate Action List** (CRITICAL risks only, ordered by effort):
- What to halt NOW
- What to fix in < 1 week
- What to plan for before launch

## Constraints

- CRITICAL risks involving real person names: always flag, never soften
- Do not mark a risk as resolved without verifying the fix exists in files
- Trademark risks involving Claude/Mistral: state the nominative fair use defense but still require disclaimer
- Greek mythology names (Hephaestus, Cerberus, Hermes, Demiurge, Anamnesis, Logos) are LOW risk — public domain
- Do not make legal determinations — surface the risk and remediation options, user decides

## Common Mistakes

| Mistake | Fix |
|---|---|
| Saying [source] references are "internal only, low risk" | Strategy docs explicitly plan to publish content citing [source]. This is a commercial use. HIGH risk. |
| Treating MIT declaration in plugin.json as equivalent to having a LICENSE file | It is not. A LICENSE file is required for legal distribution. |
| Skipping dependency audit because "sampled deps look MIT" | Full audit required before commercial launch. Sample != complete. |
