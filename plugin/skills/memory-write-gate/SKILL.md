---
name: memory-write-gate
description: "DEPRECATED — gate is now machine-enforced in MCP server"
category: dev-skills
---

# Memory Write Gate — DEPRECATED

This skill is **deprecated** as of 2026-08-27. The quality gate is now machine-enforced inside the Anamnesis MCP server's `gate.py`.

## What Changed

The quality gate that this skill defined — 5W1H evaluation, substantiveness scoring (>= 5.0 threshold), trust scoring, and security screening (credential leak, PII, injection detection) — now runs **automatically** inside the MCP server every time any write tool is called (`remember`, `learn`, `record_procedure`, `record_constellation`, `record_shadow`, `record_intelligence`).

The MCP gate cannot be bypassed — it runs before the API call, at zero token cost to the agent.

## Where to Go

See the **`anamnesis-write`** skill for all write and read instructions.

Path: `.claude/skills/anamnesis-write/SKILL.md`

## Changelog

- 2026-08-18: Initial skill definition. Aligned with OWASP ASI06 memory poisoning defense and PROJECTMEM Memory-as-Governance pattern.
- 2026-08-27: DEPRECATED. Quality gate moved to MCP server's gate.py. Agents no longer need to run the gate manually — it executes server-side on every write. Redirected to `anamnesis-write` skill.
