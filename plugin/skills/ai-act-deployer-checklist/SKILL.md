---
name: ai-act-deployer-checklist
description: EU AI Act Deployer Checklist — guides companies through self-classification (prohibited/high/limited/minimal risk), role identification (provider/deployer/distributor/importer), and obligation mapping with deadlines
category: business-analysis
---

# AI Act Deployer Checklist

Guide a company through EU AI Act self-classification — determine their role, classify each AI system by risk level, map obligations, and produce a compliance action plan with deadlines.

## When to Use

- Company wants to know if the EU AI Act applies to them
- User says "classify my AI system", "AI Act compliance check", "am I high-risk?"
- Pre-launch compliance assessment for a product that uses AI
- Due diligence on AI systems in use (procurement, HR, finance, legal)
- Preparing for the 2 August 2026 full applicability deadline

## What You Need Before Starting

1. **Company profile**: EU presence (established, selling into EU, or neither), company size (SME/startup or not), sector
2. **AI system inventory**: list of AI systems the company develops, deploys, imports, or distributes — for each: what it does, who uses it, what decisions it influences
3. **Intended purpose**: for each AI system, what is the stated intended purpose and in what context is it used

If the user cannot provide these upfront, the workflow guides them through gathering this information step by step.

## Workflow

### Gate 0 — Scope Check

Ask these 3 questions to determine if the AI Act applies at all:

1. Does the company place AI systems on the EU market, put them into service in the EU, or use AI systems in the EU?
2. Does the company develop AI systems intended to be placed on the EU market (regardless of where the company is established)?
3. Does the output of the company's AI system reach people located in the EU?

**If ALL answers are NO** -> the AI Act does not apply. Document this finding and stop.
**If ANY answer is YES** -> proceed to Gate 1.

Note: the AI Act applies extraterritorially. A US company whose AI output affects EU individuals is in scope.

### Gate 1 — Role Identification

For each AI system, determine the company's role. A company can hold multiple roles across different systems.

| Role | Definition | Key test |
|---|---|---|
| **Provider** | Develops or commissions AI and places it on market / puts into service under own name or trademark | "Did you build it or have it built, and does it carry your name?" |
| **Deployer** | Uses an AI system under own authority (except personal non-professional use) | "Do you use someone else's AI system in your business operations?" |
| **Importer** | Places on EU market an AI system from a non-EU provider | "Do you bring AI from outside the EU into the EU market?" |
| **Distributor** | Makes AI available in the supply chain (not provider or importer) | "Do you resell or redistribute AI systems?" |
| **Authorized representative** | Mandated by a non-EU provider to act on their behalf | "Has a non-EU AI provider formally designated you?" |

**Output**: Table of `[AI system] -> [role]` for each system.

### Gate 2 — Prohibited Practice Screen

Check every AI system against the prohibited practices list (in force since 2 Feb 2025). If any match, the system MUST be discontinued — no exceptions.

Read and apply `criteria.md` Section A — Prohibited Practices.

**If a system is prohibited** -> flag it immediately. The company must stop using it. Document.
**If no prohibitions** -> proceed to Gate 3.

### Gate 3 — Risk Classification

For each non-prohibited AI system, determine its risk level.

Read and apply `criteria.md` Section B — Risk Classification Decision Tree.

The three possible outcomes per system:
- **High-risk** -> heavy obligations (Gate 4a)
- **Limited risk (transparency)** -> disclosure obligations (Gate 4b)
- **Minimal risk** -> no mandatory obligations, voluntary codes of conduct (Gate 4c)

**Output**: Table of `[AI system] -> [risk level] -> [classification basis]` with article/annex reference.

### Gate 4a — High-Risk Obligations Map (Providers)

For each high-risk AI system where the company is a PROVIDER, map these mandatory obligations:

1. Risk management system (Art. 9)
2. Data governance (Art. 10)
3. Technical documentation (Art. 11)
4. Record-keeping / automatic logging (Art. 12)
5. Transparency — instructions of use (Art. 13)
6. Human oversight design (Art. 14)
7. Accuracy, robustness, cybersecurity (Art. 15)
8. Quality management system (Art. 17)
9. Conformity assessment (Art. 43) — self-assessment or third-party depending on system type
10. EU declaration of conformity (Art. 47)
11. CE marking (Art. 48)
12. Registration in EU AI database (Art. 49)
13. Post-market monitoring (Art. 72)
14. Serious incident reporting (Art. 73) — within 15 days to market surveillance authority

For each obligation, assess: MET / PARTIALLY MET / NOT MET / NOT APPLICABLE.

### Gate 4a — High-Risk Obligations Map (Deployers)

For each high-risk AI system where the company is a DEPLOYER:

1. Use in accordance with instructions of use (Art. 26.1)
2. Human oversight by trained and authorized persons (Art. 26.2)
3. Input data relevance (Art. 26.4)
4. Monitor operation and report malfunctions (Art. 26.5)
5. Inform employees and their representatives before deployment (Art. 26.7)
6. Fundamental rights impact assessment — required for: public bodies, entities providing essential private services (banking, insurance, credit), entities evaluating creditworthiness, entities in life/health insurance, entities assessing/classifying emergency calls (Art. 27)
7. Data protection impact assessment if processing personal data (Art. 26.9, linked to GDPR Art. 35)
8. Retain logs generated by the AI system for minimum 6 months (Art. 26.6)

For each obligation, assess: MET / PARTIALLY MET / NOT MET / NOT APPLICABLE.

### Gate 4b — Limited Risk (Transparency Obligations)

Systems with transparency obligations (regardless of risk level):

| System type | Obligation |
|---|---|
| Chatbot / conversational AI | Inform users they are interacting with AI (Art. 50.1) |
| Emotion recognition system | Inform exposed persons (Art. 50.2) |
| Biometric categorization | Inform exposed persons (Art. 50.2) |
| Deep fake generator | Label output as artificially generated/manipulated (Art. 50.4) |
| AI-generated text published to inform public on matters of public interest | Label as AI-generated (Art. 50.4), unless human editorial oversight |

Assess: MET / NOT MET for each applicable obligation.

### Gate 4c — Minimal Risk

No mandatory obligations. Recommend:
- Voluntary code of conduct (Art. 95)
- Internal AI usage policy
- Basic transparency to users

### Gate 5 — GPAI Check (General-Purpose AI)

If the company provides or deploys a general-purpose AI model (e.g., foundation models, LLMs):

**GPAI provider obligations** (in force since 2 Aug 2025):
1. Technical documentation (Art. 53)
2. Information and documentation to downstream providers (Art. 53)
3. Copyright compliance policy (Art. 53)
4. Publish training content summary (Art. 53)

**Systemic risk GPAI** (>10^25 FLOPs training compute, or Commission designation):
5. Model evaluation including adversarial testing (Art. 55)
6. Assess and mitigate systemic risks (Art. 55)
7. Serious incident reporting (Art. 55)
8. Adequate cybersecurity protections (Art. 55)

### Gate 6 — Timeline and Deadline Map

Map each obligation to its enforcement deadline:

| Category | Deadline | Status as of July 2026 |
|---|---|---|
| Prohibited practices | 2 February 2025 | ALREADY IN FORCE |
| AI literacy obligations (Art. 4) | 2 February 2025 | ALREADY IN FORCE |
| GPAI model obligations | 2 August 2025 | ALREADY IN FORCE |
| High-risk (Annex III — standalone) | 2 August 2026 | IMMINENT |
| Transparency obligations | 2 August 2026 | IMMINENT |
| High-risk (Annex I — product safety components) | 2 August 2027 | 13 months |

Flag any obligation where the deadline has already passed and the company is NOT MET.

### Gate 7 — SME & Startup Provisions

If the company qualifies as an SME or startup under EU definitions:

- **Reduced penalties**: lower of absolute amount or percentage of turnover
- **Regulatory sandbox access**: priority access, reduced fees (Art. 57-58)
- **Proportionate conformity assessment**: simplified procedures where applicable
- **Guidance priority**: national AI offices must provide dedicated guidance channels
- **BPI France Diag Data IA**: check eligibility for French government-funded AI compliance diagnostic (France-specific)

### Gate 8 — Modification Rules

If the company plans to modify an AI system (fine-tuning, retraining, integration changes):

- A **substantial modification** may change the original provider's classification
- The modifier becomes a NEW PROVIDER if: the modification changes the intended purpose, OR the modification affects compliance with the AI Act
- The original provider's obligations transfer to the new provider
- Cosmetic changes, bug fixes, and security patches do NOT constitute substantial modification

Document: `[planned modification] -> [substantial? Y/N] -> [consequence]`.

### Gate 9 — Compliance Action Plan

Synthesize all findings into a single prioritized action plan:

1. **P0 — STOP** items: prohibited systems to discontinue, overdue obligations
2. **P1 — URGENT** items: obligations with imminent deadlines (< 3 months)
3. **P2 — PLAN** items: obligations with upcoming deadlines (3-12 months)
4. **P3 — PREPARE** items: future obligations (> 12 months)

For each item: `[obligation] -> [gap] -> [remediation action] -> [deadline] -> [owner suggestion]`.

## Output

Produce a single **AI Act Deployer Compliance Report** containing:

1. **Scope determination** — does the Act apply, and why
2. **Role matrix** — `[AI system] x [role]` table
3. **Risk classification table** — `[AI system] x [risk level] x [legal basis]`
4. **Obligations gap analysis** — per system, per obligation: MET / PARTIAL / NOT MET
5. **Timeline map** — visual of deadlines vs. current compliance state
6. **SME provisions** — applicable benefits if qualifying
7. **Modification risk register** — planned changes and their compliance impact
8. **Compliance Action Plan** — P0 through P3 prioritized items

Output format: structured markdown, one file, sectioned with headers per gate.

## Constraints

- This skill provides structured compliance guidance, NOT legal advice. Always state this disclaimer at the start of the report.
- Do NOT fabricate article numbers or obligation text — if unsure about a specific provision, flag it as "VERIFY WITH LEGAL COUNSEL" rather than guessing.
- Do NOT skip Gate 2 (prohibited practices) — it must be checked first regardless of what the user thinks their risk level is.
- Apply the classification criteria from `criteria.md` exactly — do not invent new risk categories.
- When the user's description of an AI system is ambiguous, ask a clarifying question rather than assuming the risk level.
- All dates in this skill are based on the AI Act as published in the Official Journal of the EU (Regulation (EU) 2024/1689). If the user mentions amendments or delegated acts, flag them as "NOT COVERED — verify current consolidated text".

## Common Mistakes

| Mistake | Fix |
|---|---|
| Assuming "we only deploy, we don't provide" means no obligations | Deployers have 8+ mandatory obligations for high-risk systems — check Gate 4a (Deployers) |
| Classifying by sector instead of by intended purpose | Risk classification depends on INTENDED PURPOSE of the specific AI system, not the company's industry |
| Treating GPAI and high-risk as mutually exclusive | A system can be both GPAI AND high-risk — check both Gate 3 and Gate 5 |
| Ignoring extraterritorial scope | AI Act applies to non-EU companies if output affects EU persons |
| Confusing CE marking with conformity assessment | CE marking (Art. 48) comes AFTER conformity assessment (Art. 43), not instead of it |
| Skipping AI literacy | Art. 4 AI literacy obligation has been in force since Feb 2025 for ALL actors, not just high-risk |
| Assuming fine-tuning is not a substantial modification | Fine-tuning that changes intended purpose or affects compliance = substantial modification = new provider |
