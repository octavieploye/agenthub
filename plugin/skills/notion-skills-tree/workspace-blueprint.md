# Notion Workspace Blueprint

The Notion agent creates and maintains this structure. Pages and databases are created on first run and updated on subsequent runs.

## Top-Level Structure

```
Workspace Root
│
├── Internal Tools/                         ← Our dev stack (not customer-facing)
│   ├── AgentHub
│   ├── Anamnesis
│   ├── OPTimaeus
│   ├── Logos
│   ├── Demiurge
│   ├── Hermes
│   └── Opeidos Fraud & Admin
│
├── Commercial Products/                    ← Revenue-generating, customer-facing
│   ├── Opeidos (marketplace)
│   ├── Hephaestus (subscriptions)
│   ├── Hephaestus Sovereign (standalone)
│   ├── Anamnesis Commercial
│   ├── OPTimaeus Commercial
│   └── Workflow Server API
│
├── Business & Strategy/                    ← CEO-level decisions and analysis
│   ├── Financial Analysis
│   ├── Marketing Strategy
│   ├── Architectural Offer (subscription / standalone / enterprise)
│   ├── Revenue & Pricing
│   └── Competitive Intelligence
│
├── Neuronal System/                        ← Entity map and cross-entity flows
│   ├── Entity Status
│   └── Cascade Flows
│
└── Operations/
    ├── Deployment Status
    ├── Human Task Board
    └── Sprint History
```

## Per-Project Page Structure

Each project under Internal Tools/ and Commercial Products/ follows this template:

```
[Project Name]
├── Stack Summary          ← verified from code, not README
├── What It Does           ← one-paragraph brief
├── Architecture Decisions ← chronological, with rationale
├── Sprint Log             ← latest sprint at top
├── Deployment Status      ← current state: dev/staging/prod
├── Todos
│   ├── Now                ← actively being worked
│   ├── Next               ← planned, not started
│   └── Future             ← backlog, ideas
├── Human Tasks            ← things only the human can do
└── Change Log             ← significant changes with dates
```

## Rendering Decisions

The Notion agent decides the optimal format for each section:

| Content type | Recommended format | Why |
|---|---|---|
| Stack summary | Table (database) | Scannable, filterable by tech |
| Sprint log | Toggle list | Collapsible, latest first |
| Todos | Database with status column | Filterable: Now/Next/Future/Done |
| Human tasks | Database with status + priority | CEO needs to see and check off |
| Architecture decisions | Page per decision | Context matters, not just the choice |
| Deployment status | Inline table | Quick glance across all projects |
| Competitive intel | Database | Sortable by competitor, date |
| Financial analysis | Page with tables | Narrative + numbers |
| Change log | Bullet list with dates | Chronological, scannable |

The agent may deviate from these recommendations if a different format better serves CEO readability. When deviating, log the reasoning.

## Internal vs Commercial Separation

This separation is critical:
- **Internal Tools** = what we build with, for our own use
- **Commercial Products** = what generates revenue, what customers see

A product can appear in both (e.g., Anamnesis is both an internal tool and a commercial product). In that case, the Internal page focuses on technical state and the Commercial page focuses on revenue, pricing, and market positioning.

## Cross-References

Use Notion page mentions (@page) to link between:
- Internal tool ↔ its commercial counterpart
- Entity status ↔ project pages
- Architecture decisions ↔ the project they affect
- Business strategy ↔ the product it applies to
