# Category: Entity Map

Neuronal system entities and cross-entity status.

## When to load

- Ecosystem status review
- Cross-entity flow updates
- New entity added to the system

## Entity Registry

The Neuronal System section tracks all Optimaeus entities:

| Entity | Role | Repo | Type |
|---|---|---|---|
| Hephaestus | Builder — code execution, agent orchestration | agenthub | Internal + Commercial |
| OPTimaeus | Head — evaluation, drift detection, approval | optimaeus | Internal + Commercial |
| Logos | Translator — specs, schemas, type systems | logos | Internal |
| Demiurge | Thinker — briefs, analysis, domain coverage | demiurge | Internal |
| Hermes | Crawler — source verification, fact checking | hermes | Internal |
| Anamnesis | Memory — consolidation, pattern storage | anamnesis | Internal + Commercial |

## Entity Status Page

Each entity gets a status sub-page:

```
# [Entity Name]

Role: [one sentence]
Repo: [path]
Current state: [operational / in development / not yet built]
Last updated: [date]

## Build status
- [% complete or milestone description]

## Dependencies
- Reads from: [other entities]
- Writes to: [other entities]

## Key capabilities
- [bullet list]

## Open issues
- [bullet list]
```

## Cascade Flows Page

Documents how data moves between entities:

```
Demiurge → Logos → Hephaestus → Anamnesis ← OPTimaeus reads
                                    ↑
                               Hermes feeds
```

Track which flows are operational vs planned:
| Flow | Status | Notes |
|---|---|---|
| Demiurge → Logos | Not built | Entities not yet created |
| Logos → Hephaestus | Not built | Logos not yet created |
| Hephaestus → Anamnesis | Planned | Write layer spec exists |
| OPTimaeus → Anamnesis | Planned | Read layer spec exists |
| Hermes → Demiurge | Not built | Hermes not yet created |

## Rules

- Entity status must reflect actual code state, not plans
- Cross-reference with project pages under Internal Tools
- Update cascade flow status when new integrations are built
