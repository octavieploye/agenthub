# Data Gouv Hub — Expert Workflow Research and Target Architecture

**Date:** 2026-10-03  
**Target:** `/Users/octaviesmacpro/workspace/optimaeus-stacks/data-gouv-hub`  
**Scope:** research and architecture only; no production code or dependency changes

## Executive verdict

Data Gouv Hub currently has a useful workflow-library shell, but not yet an expert workflow product. The five presets are short connector chains. The platform can represent “run tool A, then tools B and C,” but it cannot yet represent the accountable casework that makes data governance valuable: ownership, human review, decisions, approvals, evidence, deadlines, exceptions, control mappings, versioned policy, or measurable closure.

More urgently, the generic workflows are not executable through the production paths as currently wired:

1. The HTTP workflow runner is created with an empty tool registry and is not later populated.
2. The nine tool names used in presets have zero overlap with the API's permitted tool names.
3. A production-path probe of the first preset fails on its first tool lookup.
4. MCP workflow handlers acknowledge `dispatched` but do not invoke the workflow runner.

The recommendation is therefore not “add many more presets.” It is:

- **Wave 0:** make one end-to-end workflow truthful and executable.
- **Wave 1:** evolve the DAG runner into a durable, versioned governance-case engine.
- **Wave 2:** ship a tightly curated horizontal core and a France/EU public-data pack.
- **Wave 3:** add regulated industry packs whose controls, evidence, and vocabulary are genuinely domain-specific.

Commercial intelligence workflows such as Company Due Diligence and Tender Scout can remain, but they should be labeled as **Intelligence & Discovery**, not presented as data-governance workflows.

## 1. Research scope and method

The review covered:

- workflow definitions, persistence, execution, MCP exposure, API, frontend composition, tests, migrations, and existing workflow design documents;
- reusable governance capabilities: catalogue/metadata, quality, lineage/change, access/sharing, privacy, lifecycle/retention, master/reference data, data products, AI governance, audit/reporting, and incidents;
- vertical needs in public sector, finance/insurance, health/life sciences, energy/utilities, manufacturing/automotive, retail/CPG, telecom, transport/logistics, and EU data spaces;
- official or standards-body evidence, counterchecked from at least two sources for every domain recommendation.

“Expert workflow” means a workflow with an explicit trigger, accountable roles, authoritative inputs, state and time semantics, control/decision gates, required evidence, exception/escalation behavior, machine-readable outputs, and outcome measures. A connector sequence alone does not meet that threshold.

## 2. As-is review

### 2.1 Current catalogue

| Current preset | Current shape | Proper product family | Assessment |
|---|---|---|---|
| Company Due Diligence | Company lookup → legal filings + sanctions | Intelligence & Discovery | Useful domain workflow, but not governance case management |
| Legal Monitoring | BODACC + Légifrance + news polling | Regulatory Intelligence | Monitoring inputs exist; triage, impact, assignment, decision, and closure are absent |
| Market Scout | Tenders + public data + competitor lookup | Commercial Intelligence | Valid adjacent product, not data governance |
| Company Legal Risk | Litigation + sanctions + crypto + status | Risk Intelligence | Requires evidence/confidence adjudication and analyst disposition to be expert-grade |
| Tender Opportunity | Tender fetch + market/competitor context | Commercial Intelligence | Discovery/scoring workflow; separate it from procurement-data governance |

The catalogue count and slugs are confirmed by both the preset definitions and preset tests. The engine supports dependency edges, concurrency, timeouts, variable substitution, and stop/continue failure behavior; runner tests cover those mechanics. The definition model and frontend types independently show that domain semantics are limited to descriptive fields, category, steps, and shallow input schema.

### 2.2 Capability maturity

| Dimension | Current maturity | Evidence-backed gap |
|---|---:|---|
| Definition catalogue | 2/5 | CRUD and active/inactive exist; no immutable versions or draft/review/published lifecycle |
| Automated orchestration | 2/5 | DAG mechanics are tested; production registry/tool naming is disconnected |
| Human workflow | 0/5 | Every accepted step is a tool step; no assignment, review, approval, or attestation |
| Case management | 1/5 | Runs and payloads persist; no case owner, business state, related assets, or linked cases |
| Evidence/audit | 1/5 | Operational output is stored; no evidence manifest, decision record, definition snapshot, or control result |
| Time/event semantics | 0/5 | No schedules, signals, timers, due dates, pause/resume, or escalation |
| Policy/control semantics | 0/5 | No obligation, control, policy version, exception, or compensating-control model |
| Domain depth | 1/5 | Five short presets; no industry roles, gates, artifacts, or regulatory vocabulary |
| Security foundations | 2/5 | Allowlist, tenant rate limits, idempotency, sanitized errors, timeouts, and deactivation are tested |
| Composition | 1/5 | UI concatenates/rekeys steps; it does not check semantic contracts or governance invariants |

These scores are architecture judgments, not compliance ratings.

### 2.3 Critical integration break

This is the highest-priority finding because it affects the truthfulness of the whole catalogue:

- `get_workflow_runner()` returns a module singleton constructed with an empty registry.
- Seeded presets use connector IDs such as `recherche_entreprises`, `legifrance`, and `boamp`.
- API validation permits MCP-facing names such as `search_companies`, `search_legal_texts`, and `search_tenders`.
- No preset identifier is present in the permitted set.
- HTTP API tests replace the real runner with a stub; preset tests only prove database seeding; runner tests provide synthetic registries.
- Dynamic MCP workflow tools return a dispatch acknowledgement without calling the runner.

This is why component tests can pass while the assembled capability fails. Wave 0 needs a real, non-stub integration test from seeded definition → validated tool binding → execution → persisted result, plus an equivalent MCP path test.

## 3. Design principles

1. **A workflow is a governed case, not a macro.** The case holds business state, ownership, evidence, decisions, timers, and related data assets; automated tasks are only one part.
2. **Definitions are immutable once published.** Every case pins an exact workflow version, policy version, schema version, and connector/tool contract version.
3. **Human accountability is first-class.** Human task, four-eyes approval, attestation, segregation of duties, delegation, and escalation are explicit primitives.
4. **Evidence is typed and tamper-evident.** Inputs, source snapshots, validation reports, approvals, submissions, notifications, and receipts are linked to the case with provenance and retention rules.
5. **Rules recommend; accountable people decide where judgment is material.** Automated decisions need a declared policy, reason codes, confidence, override route, and replayability.
6. **Time is part of the model.** Due dates, business calendars, wait states, reminder schedules, statutory clocks, and breach/escalation events are durable.
7. **A domain pack is more than labels.** It contains vocabulary, roles, forms, controls, evidence requirements, rules, connectors, metrics, and reference workflow versions.
8. **Composition is contract-based.** A subworkflow declares typed inputs, outputs, preconditions, postconditions, side effects, sensitivity, and failure/compensation behavior.
9. **Regulation mappings are traceability, not legal conclusions.** Record the obligation/control source and organization interpretation; require legal/compliance approval for applicable mappings.
10. **One catalogue, multiple product families.** Governance & Control, Regulatory Operations, Data Product Operations, and Intelligence & Discovery should be visibly distinct.

The evidence behind these principles includes GDPR/CNIL case obligations; W3C DCAT/DQV/PROV and EU DCAT-AP interoperability; NIST lifecycle/AI risk management; and EU data-sharing, sector, and reporting regimes. The source matrix is in §10.

## 4. Canonical expert-workflow contract

Every published workflow should satisfy this minimum contract:

| Facet | Required content |
|---|---|
| Identity | Stable key, title, purpose, product family, domain/industry, owner, semantic version |
| Applicability | Jurisdiction, organization type, asset/data classes, effective dates, inclusion/exclusion rules |
| Trigger | User request, asset event, quality signal, policy change, schedule, external notice, or linked-case event |
| Roles | Requester, case owner, contributor, reviewer, approver, control owner, observer, escalation owner |
| Contracts | Typed inputs/outputs, preconditions, postconditions, invariants, sensitivity classification |
| Flow | Tasks, decisions, parallel branches, waits, timers, signals, subworkflows, termination and compensation |
| Controls | Control objective, gate criteria, automated tests, attestations, segregation-of-duties constraints |
| Evidence | Required artifact types, provenance, validation status, hash, issuer, retention, access policy |
| Decisions | Question, options, policy/rule version, rationale, decider, time, override and dissent record |
| Exceptions | Failure classes, retry policy, waiver route, compensating controls, escalation and expiry |
| Service levels | Response/resolution targets, statutory clock where applicable, pause rules, breach behavior |
| Outcomes | Completion conditions, outputs, publication/submission receipt, residual risk, follow-up actions |
| Measures | Lead time, first-pass yield, overdue rate, recurrence, control pass rate, evidence completeness, value metric |

Publication must fail if the graph is cyclic, a referenced role/control/schema/tool is unresolved, a terminal state lacks closure criteria, a required evidence item has no producer, or a material decision lacks an accountable role.

## 5. Curated horizontal workflow portfolio

This is the reusable core. “P1” means first release after Wave 0, “P2” next, and “P3” later.

### A. Governance operating model

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Data domain & accountable owner onboarding** | New domain or ownership change; validate scope overlap, executive accountability, steward capacity, critical assets, RACI conflicts | Signed charter, asset inventory, role attestations / unowned critical assets |
| P2 | **Policy lifecycle and adoption attestation** | New/revised policy; legal/control review → impact assessment → approval → targeted attestations → effectiveness review | Versioned policy, review comments, approvals, attestation cohort / adoption and overdue rate |
| P2 | **Governance exception & compensating-control waiver** | Control failure or justified deviation; risk assessment → control-owner review → time-bound approval → periodic revalidation → expiry/closure | Exception rationale, residual risk, compensating evidence, expiry / expired open waivers |

### B. Catalogue, metadata, semantics

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Dataset/data-service publication certification** | Publish request; owner, purpose, classification, lawful release, license, DCAT/DCAT-AP metadata, schema, sample, API/distribution, contact and quality gates | Metadata validation report, privacy review, license approval, endpoint probe / first-pass certification |
| P2 | **Business glossary term lifecycle** | Proposed/changed term; duplicate/semantic conflict check → domain consultation → steward approval → impact propagation | Definition, synonyms, examples, linked fields/reports, decision log / disputed and orphan terms |
| P2 | **Metadata drift & stale-catalog remediation** | Schema/source/contact/freshness drift; assess consumers → assign remediation → verify metadata/endpoint → close or deprecate | Before/after metadata, consumer impact, validation result / time stale and recurrence |

### C. Data quality and observability

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Critical data element rule onboarding** | New critical field/report dependency; define fitness-for-purpose dimensions, threshold, population, exclusions, owner, test, alert route, baseline | Rule spec, sample results, owner approval, baseline / coverage of critical elements |
| P1 | **Data quality incident triage, RCA, remediation** | Threshold breach or consumer report; validate signal → severity/impact → contain → root cause → repair/backfill → consumer acceptance → prevention | Failed samples, lineage, impact list, RCA, repair validation / detect-to-contain, recurrence |
| P2 | **Periodic data quality attestation** | Scheduled for critical product/report; evaluate trend, open exceptions, rule coverage, source health, consumer fitness; attest or escalate | Scorecard, exceptions, steward/owner attestation / on-time attestations and residual risk |

### D. Lineage, schema, and change control

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Breaking schema change impact approval** | Proposed contract/schema change; compatibility test → downstream lineage blast radius → privacy/control recheck → consumer sign-off → rollout/rollback | Diff, affected consumers, test report, approvals, migration plan / prevented unannounced breaks |
| P2 | **Lineage gap certification/remediation** | Missing/broken lineage; classify critical path → source/transform/consumer reconstruction → steward verification → coverage recertification | Reconstructed edges, query/code evidence, reviewer sign-off / critical lineage coverage |
| P2 | **Source/connector deprecation and consumer migration** | Provider/API retirement or maturity downgrade; inventory dependencies → replacement equivalence → dual run → reconciliation → cutover → archive | Dependency list, parity report, cutover/rollback, notices / consumers migrated before deadline |

### E. Access, sharing, privacy, and retention

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Purpose-bound data access request** | Access request; identity/role → purpose/lawful basis → minimisation → sensitivity/transfer risk → owner approval → provision → expiry/review | Request, purpose, fields, policy result, approvals, provision/revocation receipt / access lead time and stale grants |
| P1 | **DPIA / high-risk processing assessment** | New/materially changed processing; screening → necessity/proportionality → threat/impact → mitigations → DPO review → residual-risk decision → consultation if required | Processing design, data flow, risk register, DPO advice, decision / unresolved high risks |
| P1 | **Personal-data breach decision clock** | Suspected breach; validate → contain → scope/data subjects → rights/freedoms risk → DPO/legal gate → regulator/subject notification branches → lessons learned | Timeline, affected data, risk rationale, notices/receipts, corrective actions / clock compliance and recurrence |
| P2 | **Data-subject rights orchestration** | Verified request; identity and scope → system search → exemptions/third-party review → fulfill/refuse with rationale → propagate corrections/deletion → evidence closure | Identity verification, search manifest, disclosures/actions, response / due-date compliance |
| P2 | **Retention, legal hold, and defensible disposal** | Retention expiry, legal hold, contract end, or purpose cessation; classify schedule → detect holds/conflicts → approve disposition → purge/anonymise/archive → verify propagation | Schedule/policy, hold check, deletion logs, residual copies/exceptions / overdue eligible data |

### F. Master/reference data and reconciliation

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P2 | **Golden-record merge/split adjudication** | Duplicate/conflict signal; match evidence → survivorship proposal → steward decision → downstream propagation → rollback window | Candidate facts/provenance, decision, affected systems, reconciliation / false merge and reversal rate |
| P2 | **Reference-data change release** | Code-list/taxonomy change; authority/source validation → semantic impact → mapping → effective-date coordination → dual validity → consumer confirmation | Source publication, mapping, impacted contracts, release receipt / consumers ready by effective date |
| P3 | **Cross-source entity conflict resolution** | Authoritative sources disagree; source authority and recency review → confidence → steward adjudication or explicit unresolved state | Source snapshots, provenance, rule/decision, consumer warning / unresolved critical conflicts |

### G. Data product operations

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **Data product release readiness** | New/major release; contract, quality, security/privacy, lineage, documentation, SLO, support and rollback gates | Test pack, owner approvals, SLO, runbook, release record / change failure rate |
| P2 | **Data product SLO breach** | Freshness/availability/quality/support breach; severity → consumer impact → mitigation → restore → RCA → error-budget decision | Telemetry, impact, incident timeline, RCA / restore time and repeat breach |
| P2 | **Data product deprecation/end-of-life** | Low value, replacement, provider change, or policy need; consumer inventory → notice → migration → retention/archive → revoke and tombstone | Usage evidence, notices, migration status, archive/tombstone / active consumers at shutdown |

### H. AI/data-for-AI governance

| Priority | Workflow | Trigger and expert gates | Required evidence / primary KPI |
|---|---|---|---|
| P1 | **AI use-case intake and risk classification** | Build/buy/material change; intended purpose → affected people → data/model/vendor inventory → applicability/risk tier → required controls and owner | Use-case card, classification rationale, system/data inventory / unclassified AI systems |
| P1 | **Training/evaluation data approval** | Dataset proposed for AI; provenance/rights → representativeness/quality → sensitive data → leakage/contamination → documentation → accountable approval | Dataset card, license/consent, provenance, quality/bias tests, restrictions / approved-data coverage |
| P2 | **AI pre-deployment go/no-go** | Release candidate; requirements → independent testing → human oversight → logging/explainability → security/privacy → residual risk → approval | Test results, limitations, oversight plan, decision / conditional launches and open conditions |
| P2 | **AI monitoring, drift, incident, and material-change review** | Drift/harm/complaint/security event or model/data change; severity → containment → evaluation → notify/escalate → retrain/rollback/retire → effectiveness | Monitoring signal, impacted cohort, decision, corrective tests / detect-to-action and recurrence |

## 6. Curated industry packs

Each industry workflow reuses the horizontal primitives but adds sector actors, schemas, clocks, evidence, and regulatory vocabulary. These are product hypotheses until validated with target users and legal/control owners.

### Public sector and open data — first vertical

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **High-value dataset publication & recurring assurance** | Identify applicable theme → privacy/anonymisation → machine-readable/API and bulk-download readiness → terms/license → DCAT-AP metadata → QoS/contact → publish → periodic evidence report |
| P1 | **DCAT-AP federation and harvest failure remediation** | Validate profile/controlled vocabularies/URLs → publish → observe harvester result → diagnose rejected/stale record → correct → verify cross-portal discovery |
| P1 | **DECP award/modification data publication** | Contract notification event → assemble mandatory/conditional fields → secrecy/privacy gate → schema/nomenclature validation → publish to data.gouv.fr → reconcile receipt and deadline |
| P2 | **TED eForms notice validation and publication** | Draft notice → business-rule validation → buyer remediation → delegated approval → submission → acceptance/rejection reconciliation → corrected resubmission |
| P2 | **Open-data controlled depublication/archive** | Risk, expiry, supersession, or legal issue → consumer/obligation impact → preserve record/provenance → redirect/tombstone → revoke distribution → notify reusers |

Evidence: EU high-value dataset regulation + DCAT-AP; EU eForms/TED validation + French DECP guidance.

### Financial services and insurance

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **Critical risk-report data attestation (BCBS 239 pattern)** | Reporting cycle → lineage and source completeness → reconciliation → quality exceptions/materiality → report-owner and risk-owner attestations → distribution → remediation tracking |
| P1 | **DORA ICT third-party register onboarding/change/attestation** | Contract or service change → classify ICT service/critical function → capture provider/subcontracting/locations → validate register fields → risk approval → periodic completeness attestation → supervisory extract |
| P2 | **Regulatory metric lineage change approval** | Rule/model/source change → impact on metric lineage and historical comparability → parallel calculation/reconciliation → model/data/control-owner approvals → effective-date cutover |
| P2 | **Finance data-quality exception materiality case** | Reconciliation break or late data → quantify report/capital/customer impact → containment/adjustment → independent approval → disclose/escalate → permanent fix |

Evidence: BCBS 239 + Basel Framework implementation; EBA DORA register and technical-standard materials.

### Healthcare and life sciences

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **EHDS secondary-use application and permit** | Applicant/purpose/dataset request → permitted-use and prohibited-use screen → minimisation → ethics/IP/trade-secret review → opt-out handling → HDAB-style decision → permit/conditions/expiry |
| P1 | **Secure processing environment dataset release** | Approved permit → cohort feasibility → anonymisation/pseudonymisation → disclosure-risk and quality review → provision inside controlled environment → usage/output review → deletion/closure |
| P2 | **Patient restriction/opt-out/rectification propagation** | Authenticated request → affected records/uses → safety and legal exceptions → apply restriction/correction → propagate to exchange/secondary-use indexes → notify and audit |
| P2 | **Health dataset quality label and catalogue release** | Holder registers dataset → provenance/completeness/representativeness/refresh/privacy metadata → expert review → publish searchable quality statement → periodic update |

Evidence: EHDS regulation + Commission EHDS implementation/secondary-use guidance, layered with GDPR/CNIL controls.

### Energy and utilities

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **REMIT transaction/exposure validation, correction, resubmission** | Report due/received → technical validation → reference-data consistency → completeness/accuracy/timeliness checks → responsibility routing → correct/retransmit → ACER receipt reconciliation |
| P2 | **Inside-information publication review** | Potential inside information → materiality/confidentiality assessment → legal/market-conduct review → authorized publication through appropriate channel → correction/update trail |
| P2 | **Meter/consumption data purpose-bound access** | Customer/partner request → identity/mandate → purpose and granularity → consent/legal basis → provision → usage/expiry monitoring → revoke/export evidence |
| P3 | **Grid/asset reference-data change coordination** | Asset/topology/reference change → authority and effective date → downstream market/operations impact → dual-run validation → coordinated release |

Evidence: ACER REMIT reporting, data-quality, and reporting-responsibility guidance; trusted sharing patterns from the Data Act and GDPR.

### Manufacturing and automotive

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **Battery passport create/update/transfer/end-of-life** | In-scope battery event → identity/model/instance data → source verification → access-tier classification → completeness/accuracy approval → publish/update QR-linked record → ownership/status/end-of-life transitions |
| P2 | **Connected-product data-access request** | User/authorized third party requests product data → verify entitlement/purpose → trade-secret/security safeguards → scope/format → provide → monitor terms and revoke |
| P2 | **Supplier traceability evidence exception** | Missing/conflicting batch/material provenance → quarantine impact → supplier evidence request → quality/compliance adjudication → release/rework/block → corrective action |
| P3 | **Digital product passport schema/change governance** | Regulatory/schema/product change → map attributes/sources/access tiers → interoperability validation → version migration → ecosystem conformance evidence |

Evidence: EU Batteries Regulation and consolidated text; EU Data Act/DGA sharing and interoperability materials.

### Retail, CPG, and agri-food

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **EUDR lot-level due diligence statement** | Planned market placement/export → commodity/product/plot data → legality and deforestation evidence → risk assessment → mitigation if non-negligible → accountable approval → statement submission → five-year evidence retention |
| P1 | **EUDR substantiated-concern/post-market escalation** | New adverse information → affected lots/suppliers/customers → compliance reassessment → stop/notify authorities and downstream actors where needed → corrective action and evidence update |
| P2 | **Product recall master-data and channel propagation** | Safety/quality trigger → canonical product/lot resolution → severity and market scope → channel/authority/customer notifications → withdrawal reconciliation → closure |
| P2 | **Marketing consent and suppression propagation** | Consent/objection/change event → identity resolution → channel/purpose mapping → update suppression lists and processors → verify no further prohibited sends |

Evidence: consolidated EUDR + Commission guidance; GDPR/CNIL purpose, objection, and retention guidance.

### Telecommunications

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **Regulatory network-QoS dataset submission** | Measurement cycle → method/device/geography validation → operator/reference reconciliation → anomaly investigation → accountable attestation → publish/submit open data |
| P1 | **Connection-data retention, legal hold, and purge** | Record creation/contract end/hold/expiry → classify category and purpose → calculate retention → apply hold conflicts → purge/anonymise → evidence verification |
| P2 | **Coverage/availability claim discrepancy** | Field/crowdsourced/regulator discrepancy → validate measurement comparability → localize affected area → operator remediation/evidence → corrected publication |
| P2 | **Electronic-communications consent/objection propagation** | Collection or opt-out → classify commercial vs transactional purpose → consent/legal-basis check → durable suppression across channels/processors → periodic evidence test |

Evidence: Arcep QoS and data-driven regulation; CNIL minimisation, retention, and electronic-communications guidance.

### Transport and logistics

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P1 | **eFTI authority inspection disclosure** | Authenticated authority request → shipment/data-set resolution → legal scope → selective disclosure/access link → access log → response/expiry → audit evidence |
| P1 | **Mobility National Access Point feed onboarding** | Provider/feed proposal → standards/schema → metadata/license → geographic/data-type coverage → quality baseline → publish → scheduled conformance monitoring |
| P2 | **eFTI platform/service-provider certification evidence** | Initial/renewal/material change → functional/security/access/audit/archiving controls → independent assessment → remediation → certification decision |
| P2 | **Travel-feed quality degradation remediation** | Freshness/completeness/consistency signal → affected modes/services → provider assignment → repair → revalidation → user/reuser notice |

Evidence: Commission eFTI framework and DTLF; multimodal travel/NAP regulation and implementation guidance.

### Cross-border data spaces

| Priority | Workflow | Niche workflow architecture |
|---|---|---|
| P2 | **Participant onboarding and trust attestation** | Organization application → identity/authority → policy/contract acceptance → capability/security checks → role approval → credentials → periodic re-attestation |
| P2 | **Data offer publication and contract negotiation** | Provider proposes asset → metadata/quality/rights/purpose constraints → pricing/terms where applicable → consumer negotiation → signed usage policy → publish |
| P2 | **Purpose-bound access grant and usage-policy enforcement** | Consumer request → policy match → human approval if needed → credential/token grant → usage/evidence monitoring → expiry/revocation |
| P3 | **Cross-border transfer/protected-data reuse case** | Reuse request → jurisdiction/recipient/purpose → legal and technical safeguards → secure environment/contract → approval → audit/termination |

Evidence: EU Data Governance Act, Data Act, common-data-space policy, DCAT-AP, and GDPR.

## 7. Target workflow architecture

### 7.1 Functional shape

```text
Triggers/API/UI/MCP/events/schedules
                 │
                 ▼
       Case intake + applicability
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
Versioned process      Policy/control resolver
definition snapshot    (rules, obligations, roles)
       │                   │
       └─────────┬─────────┘
                 ▼
       Durable orchestration engine
  machine · human · approval · decision
  timer · signal · evidence · subworkflow
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
 Connectors   Work queues  Notifications
       │         │          │
       └─────────┼──────────┘
                 ▼
 Case ledger · evidence/provenance · metrics
                 │
                 ▼
 Catalogue / audit export / regulator receipt
```

### 7.2 Core records

| Record | Purpose | Essential invariants |
|---|---|---|
| `workflow_template` | Stable identity and ownership | Key is stable; no executable mutable graph here |
| `workflow_version` | Immutable published process | Content hash, effective interval, lifecycle, compatibility, policy/control mappings |
| `workflow_case` | Business instance | Pins version; tenant, owner, subject/assets, priority, current state, deadlines |
| `task_instance` | Unit of accountable work | Type, assignee/candidate role, inputs/outputs, due date, attempt, completion actor |
| `decision_record` | Durable material judgment | Question/options, result, reason codes, rationale, policy/rule version, decider |
| `evidence_item` | Typed proof | Provenance, issuer/source, hash, classification, validation, retention/access policy |
| `case_event` | Append-only history | Ordered, idempotent, actor, timestamp, causation/correlation, before/after refs |
| `timer` | Durable time condition | Due time, calendar, pause/resume reason, escalation action, fired-at proof |
| `control_evaluation` | Test/attestation result | Control version, scope, method, result, exceptions, evidence refs, reviewer |
| `obligation_mapping` | Traceability | Source, article/requirement, applicability rationale, interpretation owner/date |
| `case_relationship` | Cross-case dependency | Parent/subcase, blocks, supersedes, caused-by, duplicate-of |
| `metric_observation` | Outcome/process measure | Definition/version, dimensions, time, source, confidence |

Existing `workflow_definitions` can become the template/version import source, but published definitions must not remain mutable. Existing `workflow_runs` can remain the execution ledger for machine-only tasks or be migrated into cases; do not treat a mutable foreign key as sufficient historical provenance.

### 7.3 Step primitives

| Primitive | Use |
|---|---|
| `service_task` | Idempotent connector/tool call with typed contract and retry/timeout policy |
| `human_task` | Assigned work with form, instructions, evidence requirements, due date, delegation rules |
| `approval_task` | Explicit approve/reject/request-changes, with segregation-of-duties constraints |
| `attestation_task` | Named actor certifies a scoped statement at a time |
| `decision` | Policy/rule evaluation with explainable output and optional human override |
| `evidence_capture` | Acquire, validate, hash, classify, and attach an artifact/source snapshot |
| `timer_wait` | Durable due date, business-calendar wait, reminder, or escalation |
| `signal_wait` | Pause until external receipt, response, correction, or linked-case event |
| `notification` | Templated, localized notice with audience, channel, receipt, and retry policy |
| `subworkflow` | Version-pinned reusable process with typed inputs/outputs |
| `manual_intervention` | Operational fallback that records actor, reason, action, and residual risk |
| `compensation` | Declared rollback/revoke/correct action for a prior side effect |

### 7.4 Lifecycles

**Definition:** `draft → in_review → approved → published → suspended → deprecated → retired`  
Only a new version may change published behavior. Suspension blocks new cases; existing cases follow an explicit continue/migrate/cancel decision.

**Case:** `opened → triaged → active ↔ waiting → escalated → resolved → verified → closed`  
Alternative terminals: `rejected`, `withdrawn`, `cancelled`. Reopening creates a recorded transition and reason, not a silent mutation.

**Task:** `available → claimed → in_progress → completed`; alternatives include `blocked`, `failed`, `waived`, `cancelled`, and `expired`. Waiver requires an authorized decision and compensating-control/expiry data.

### 7.5 Execution guarantees

- Persist state before and after every external side effect.
- Use idempotency and correlation keys for triggers, tasks, notifications, submissions, and receipts.
- Separate retryable technical failure from business rejection and control failure.
- Use an outbox/event pattern so state transitions and emitted events cannot drift.
- Redact secrets and minimize personal/sensitive case payloads; reference protected objects rather than duplicating them.
- Pin tool contract and workflow version for replay; preserve source snapshots needed to explain the decision at that time.
- Make cancellation, timeout, dead-letter, manual recovery, and compensation visible in the case ledger.
- Require integration tests using real production registries and schemas; stub-only path tests are insufficient.

### 7.6 Access and accountability

- Combine tenant isolation and role-based permissions with attributes such as data class, jurisdiction, domain, case relation, and purpose.
- Enforce “requester cannot approve own high-risk request” and comparable four-eyes rules in the engine.
- Model temporary delegation with scope and expiry.
- Separate artifact visibility from case visibility; sensitive evidence may be restricted to DPO, legal, health-data, or regulator roles.
- Record who viewed, exported, changed, approved, waived, or disclosed material data.

### 7.7 Catalogue and UX

The Workflow Hub should browse by outcome and applicability, not only category:

- product family and industry;
- business outcome/control objective;
- jurisdiction and effective date;
- data sensitivity and asset type;
- required roles/connectors;
- automation level and typical lead time;
- template maturity: experimental, validated, certified internally, deprecated;
- installed capability status: runnable now, missing connector, missing role, policy setup required.

The run screen becomes a case page: current state, owner, clock, pending tasks, decision/evidence trail, linked assets/cases, exceptions, and outcome measures. Composition should occur in an admin designer with contract validation, not by concatenating cards in the operational hub.

## 8. Rollout architecture

### Wave 0 — Truthful execution foundation

1. Define one canonical tool registry and one identifier namespace used by presets, validation, HTTP, MCP, and runner.
2. Make MCP workflow tools invoke the same execution service as HTTP.
3. Add production-path integration tests for seeded workflow execution and result persistence.
4. Add catalogue readiness status so non-runnable workflows cannot appear as runnable.
5. Reclassify the current five workflows under Intelligence & Discovery / Regulatory Intelligence.

**Exit:** one seeded workflow succeeds through HTTP and MCP using real production registration, or fails with an intentional typed dependency/readiness error before case creation.

### Wave 1 — Governance-case kernel and first workflows

Build definition versions, cases/events, human/approval/decision/evidence/timer primitives, role assignment, and SLA/escalation. Deliver these six reference workflows:

1. Dataset/data-service publication certification
2. Data quality incident/RCA
3. Breaking schema change impact approval
4. Purpose-bound data access request
5. Personal-data breach decision clock
6. Data product release readiness

These six exercise nearly every reusable primitive without overfitting to one vertical.

### Wave 2 — France/EU public-data pack

Deliver high-value dataset publication, DCAT-AP federation remediation, DECP publication, eForms validation/publication, and controlled depublication. Reuse the repository's existing catalogue, provenance, data.gouv.fr, company, legal, and tender strengths.

### Wave 3 — Regulated vertical packs

Prioritize by named design partners, not catalogue volume:

1. Finance: BCBS 239-style attestation + DORA register
2. Health: EHDS permit + secure-environment release
3. Energy: REMIT validation/correction
4. Manufacturing/retail: battery passport + EUDR due diligence
5. Transport: eFTI disclosure + mobility feed quality
6. Telecom: QoS submission + retention/purge

Each pack must ship with at least one domain expert-reviewed workflow, vocabulary, evidence schema, control mappings, fixtures, and end-to-end acceptance scenarios.

### Wave 4 — Data-space federation and controlled composition

Add participant trust, data offers, contract/purpose negotiation, usage enforcement, cross-border protected reuse, and contract-checked subworkflow composition.

## 9. Portfolio governance and success measures

Do not optimize for workflow count. Use a portfolio scorecard:

| Measure | Why it matters |
|---|---|
| Runnable catalogue rate | Prevents discoverable-but-broken workflows |
| Cases completed with complete required evidence | Measures auditability, not clicks |
| First-pass control/validation yield | Reveals usability and source quality |
| Median/95th-percentile lead time by workflow/state | Finds queues and policy friction |
| Overdue/statutory-clock breach rate | Tests operational control |
| Exception recurrence after closure | Tests whether remediation works |
| Human override rate and reasons | Detects poor automation/policy rules |
| Reopened case rate | Detects false closure |
| Critical assets with owner/quality/lineage/access controls | Measures governance coverage |
| Consumer or regulator receipt/reconciliation success | Measures external outcome |
| Avoided incidents/manual hours/value realization | Tests product value |

Sunset workflows that have no accountable owner, no validated users, persistent low completion, or a better consolidated replacement.

## 10. Evidence and traceability matrix

| Recommendation area | Source 1 | Source 2+ | Architectural consequence |
|---|---|---|---|
| Privacy register/DPIA/breach/rights | [GDPR](https://eur-lex.europa.eu/legal-content/ENG/ALL/?uri=celex%3A32016R0679) | [CNIL breach guidance](https://www.cnil.fr/fr/violations-de-donnees-personnelles-les-regles-suivre), [CNIL register](https://www.cnil.fr/fr/le-registre-rgpd-de-la-cnil) | Timed risk decisions, DPO/legal roles, evidence, conditional notification |
| Metadata and public-data interoperability | [W3C DCAT](https://www.w3.org/TR/vocab-dcat-2/) | [EU DCAT-AP](https://interoperable-europe.ec.europa.eu/collection/semic-support-centre/dcat-ap) | Typed metadata artifact, validation, publication and federation receipts |
| Quality and provenance | [W3C data best practices](https://www.w3.org/TR/dwbp/) | [EU SEMIC quality study](https://interoperable-europe.ec.europa.eu/sites/default/files/document/2019-09/SEMIC%20Study%20on%20data%20quality%20management.pdf), [W3C PROV overview](https://www.w3.org/TR/prov-overview/) | Quality measures and evidence provenance across lifecycle |
| Trusted sharing/data spaces | [EU Data Governance Act](https://digital-strategy.ec.europa.eu/en/policies/data-governance-act) | [EU Data Act](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained) | Purpose/terms, participant trust, policy enforcement, revocation/expiry |
| Public high-value data | [EU Regulation 2023/138](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0138) | [EU DCAT-AP](https://interoperable-europe.ec.europa.eu/collection/semic-support-centre/dcat-ap) | API/bulk/metadata/license/QoS/contact gates and recurring reporting |
| Public procurement | [EU eForms](https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/eforms_en) | [TED validation](https://docs.ted.europa.eu/eforms/1.12/guide/validation.html), [French DECP guidance](https://www.economie.gouv.fr/files/files/directions_services/daj/media-document/FT_publication_donnees_essentielles_commande_publique%20v.PH%2020250804_1.pdf) | Schema/business-rule validation, remediation, submission/receipt reconciliation |
| Finance risk data | [BCBS 239](https://www.bis.org/publ/bcbs239.pdf) | [Basel Framework SRP 36](https://www.bis.org/committees/bcbs/basel-framework/standard/srp/36/inforce/2019-12-15/published/2019-12-15) | Lineage, reconciliation, exception materiality, attestations |
| Finance ICT third parties | [EBA DORA preparation](https://eba.europa.eu/activities/direct-supervision-and-oversight/digital-operational-resilience-act/preparation-dora-application) | [EBA register ITS](https://www.eba.europa.eu/activities/single-rulebook/regulatory-activities/operational-resilience/implementing-technical-standards-establish-templates-register-information) | Versioned third-party register, criticality review, attestation/extract |
| Health secondary use | [EHDS Regulation](https://eur-lex.europa.eu/eli/reg/2025/327/oj/eng) | [Commission EHDS](https://health.ec.europa.eu/ehealth-digital-health-and-care/european-health-data-space-regulation-ehds_en), [secondary-use guidance](https://health.ec.europa.eu/ehealth-digital-health-and-care/reuse-health-data_en) | Permit case, purpose screen, opt-out, minimisation, secure environment |
| AI governance | [EU AI Act overview](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) | [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/), [AI RMF](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf) | Lifecycle risk classification, testing, go/no-go, monitoring/change/incident |
| Energy reporting | [ACER reporting](https://www.acer.europa.eu/remit/data-collection/data-reporting) | [ACER quality](https://www.acer.europa.eu/remit/data-collection/data-quality), [responsibility Q&A](https://www.acer.europa.eu/iii233) | Multi-stage validation, responsibility routing, correction/resubmission |
| Battery/product passport | [Batteries Regulation](https://eur-lex.europa.eu/eli/reg/2023/1542/oj) | [Consolidated text](https://eur-lex.europa.eu/eli/reg/2023/1542/2025-07-31/eng/pdf) | Instance lifecycle, access tiers, accuracy/completeness/freshness, interoperability |
| Deforestation due diligence | [Consolidated EUDR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A02023R1115-20251226) | [Commission guidance](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=CELEX%3A52025XC04524) | Evidence chain, risk/mitigation gate, statement, new-information escalation |
| Telecom quality/retention | [Arcep QoS](https://www.arcep.fr/nos-sujets/la-qualite-de-service-mobile.html) | [Arcep data regulation](https://www.arcep.fr/la-regulation/grands-dossiers-thematiques-transverses/la-regulation-par-la-data/les-outils-de-regulation-par-la-data-de-larcep.html), [CNIL retention](https://www.cnil.fr/fr/minimiser-les-donnees-collectees) | Measurement methodology, anomaly remediation, purpose-based retention/purge |
| Freight/mobility | [Commission eFTI](https://transport.ec.europa.eu/transport-themes/logistics-and-multimodal-transport/efti-regulation_en) | [DTLF](https://transport.ec.europa.eu/transport-themes/logistics-and-multimodal-transport/digital-transport-and-logistics-forum-dtlf_en), [multimodal NAP](https://transport.ec.europa.eu/transport-themes/smart-mobility/road/its-directive-and-action-plan/multimodal-travel-information_en) | Authenticated selective disclosure, certification, access logs, feed quality |

## 11. Decisions to validate with product/domain owners

1. Is DGH's primary buyer a French public data publisher/operator, or is it intended as a horizontal enterprise governance platform? The recommended sequencing assumes the former.
2. Should Intelligence & Discovery remain a first-class product family, or become applications built on top of governed datasets?
3. Which role directory is authoritative for accountable owners, DPO/legal/control roles, delegations, and segregation of duties?
4. Which evidence objects must be retained inside DGH versus referenced from a protected document/records system?
5. Which two design partners can validate one industry pack end to end before catalogue expansion?
6. What legal/control review process approves obligation mappings and keeps them current?

## 12. `depsVerified`

No dependency packages or versions are proposed in this research architecture, so there are no rows to verify. Any implementation brief or sprint plan must populate this table before naming a version.

| package | pinned | latest | status | date |
|---|---|---|---|---|

