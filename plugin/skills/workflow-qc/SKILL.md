---
name: workflow-qc
description: Opeidos Workflow Quality Control — 7-gate dual-mode certification pipeline. Scans workflows for safety, security, LLM compatibility, and output quality before Opeidos distribution. Run before any workflow is uploaded to the Hetzner production volume.
category: utilities
---

# WORKFLOW-QC
Version: 1.0
Modes: LIGHTWEIGHT (Gates 1+2+3+5+7) | FULL (all 7 gates)

## WHEN TO USE
- Before any workflow is published to the Opeidos production server
- After any workflow file is modified
- When adding a new workflow to the distribution catalog
- When a buyer reports unexpected behavior from a workflow
- On every version bump — re-certification is mandatory after any content change

## MODE SELECTION

LIGHTWEIGHT: Run on any model including local 7B Ollama. No LLM generation required.
Covers structural safety and forbidden content only. Fast — completes in one pass.
Use when: quick pre-check, CI-style gate, or running on resource-limited hardware.

FULL: Requires Mistral Large, Claude Sonnet 4.6, or Kimi K2.5 (256K+ context).
Covers all 7 gates including semantic security probing and output quality judgment.
Use when: certifying a workflow for the first time or after significant content changes.

## GATE SEQUENCE

LIGHTWEIGHT — load gates in this order:
1. gates/gate-1-scope.md       Is this workflow distributable?
2. gates/gate-2-structure.md   Are all files valid and server-ready?
3. gates/gate-3-content.md     Does it contain forbidden terms or PII? (layers 1-2 only)
4. gates/gate-5-llm-compat.md  Static token/tier assessment only
5. gates/gate-7-certification.md  Generate certificate if all pass

FULL — load gates in this order:
1. gates/gate-1-scope.md
2. gates/gate-2-structure.md
3. gates/gate-3-content.md     All 3 layers including LLM semantic scan
4. gates/gate-4-injection.md   Prompt injection resistance — 5 probes + hardening
5. gates/gate-5-llm-compat.md  Static + live model simulation
6. gates/gate-6-output-quality.md  Generate sample output and score it
7. gates/gate-7-certification.md

## RULES
- Load one gate file at a time. Unload before loading the next gate.
- STOP if any gate returns BLOCK or FAIL. Do not proceed to the next gate.
- Gate 4 may produce hardening patches — apply them before running Gate 6.
- Gate 7 generates the certificate only when all preceding gates PASS or WARN.
- WARN = proceed with the warning logged in the certificate notes field.
- brain/ path workflows are ALWAYS blocked at Gate 1. No exceptions.
- Every QC run must produce a DB record in workflow_qc_runs (agenthub.db).
- Buyer-facing certificate (JSON) is saved to Hetzner volume by owner after Gate 7.

## OUTPUT STORAGE
Gate 7 produces two outputs:
  1. DB record  → workflow_qc_runs table in agenthub.db (owner audit trail)
  2. JSON file  → {workflow_volume}/{workflow_id}/qc-certificate.json (buyer-facing)
The JSON file template is at: output/qc-certificate-template.json

## TOKEN BUDGET
SKILL.md (this file):    ~500 tokens
Each gate file:          ~400-600 tokens
Maximum in context:      ~1,100 tokens (this file + one gate at a time)
