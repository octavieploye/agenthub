---
description: "Threat Defense Team orchestrator command — invoke /team-threat-defense to launch the full external threat scanning workflow"
allowed-tools: ["Read", "Glob", "Grep", "Write"]
---

# Command: team-threat-defense

You are invoking the **Threat Defense Team** — a 6-agent team that detects outside threats, stealth and AI-driven cyber attacks, injection vectors, secrets/vault exposure, and high-speed anomalous movements.

Route this invocation to **lead-threat-defense**, which orchestrates the full team sequence.

---

## Invocation Syntax

```
/team-threat-defense                    → full scan (all domains, entire src/)
/team-threat-defense <path>             → scoped scan of specific file or folder
/team-threat-defense secrets            → secrets-guardian only
/team-threat-defense injection          → injection-analyst only
/team-threat-defense stealth            → stealth-detector only
/team-threat-defense surface            → threat-scout only
/team-threat-defense respond            → incident-responder only (requires prior scan output)
```

---

## Team Roster

| Agent | Role |
|-------|------|
| `lead-threat-defense` | Orchestrates, sequences, synthesizes TIP |
| `threat-scout` | Attack surface map + anomaly signals |
| `secrets-guardian` | .env, vault, API key, token exposure |
| `injection-analyst` | Prompt injection, SQL, command, XSS, SSTI, path traversal |
| `stealth-detector` | APT, AI attacks, supply chain, covert channels, evasion |
| `incident-responder` | Containment plan, hardening fragment, rotation protocol |

## Agent Sequence

```
[1] threat-scout         (alone)
[2] secrets-guardian \   (parallel — 2 active)
    injection-analyst/
[3] stealth-detector     (alone)
[4] incident-responder   (alone)
```

Max 3 agents active. Lead does not count toward cap.

## Outputs

- `docs/superpowers/security/YYYY-MM-DD-HH-MM-threat-defense-report.md`
- `docs/superpowers/security/security-log.md` (updated)
- Hardened Policy Fragment (inline + saved)
- Priority Remediation List (P0/P1/P2)

## Rules

- No code fixes — report only
- No secret values in reports — location references only
- CRITICAL findings shown inline immediately
- Human must resolve all CRITICALs before git-ops may commit
