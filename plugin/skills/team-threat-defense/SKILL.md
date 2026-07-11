---
name: team-threat-defense
description: Threat Defense Team Orchestrator — outside threat detection, stealth/AI-driven cyber attacks, injection vectors, secrets/vault exposure, high-speed movement interception. Produces Threat Intelligence Package + Hardening Plan.
category: dev-skills
---

# Threat Defense Team

6-agent team that scans, detects, and produces hardening recommendations against outside threats: stealth attacks, AI-driven cyber attacks from humans and agents, injection patterns, .env and secrets exposure, vault call leaks, and high-speed anomalous movements.

**Does not fix code. Produces reports and hardening policy only. Human approves all actions.**

## When to Use

- Suspicious activity or unusual access patterns detected in logs
- Before a major release — full external threat sweep
- After adding new agent spawn paths, IPC channels, or external integrations
- After adding vault calls, .env changes, or secret management code
- Reviewing code that processes user-controlled input fed to AI agents
- Suspected prompt injection, credential leak, or supply chain compromise
- APT-pattern indicators: low-and-slow access, repeated auth failures, unusual process spawns

## What You Need Before Starting

- Scope: which paths, features, or modules to scan (or "full" for entire src/)
- Access to `docs/superpowers/security/security-log.md` (prior open findings)
- Access to `.claire/sec-devops.md` (accepted risks + false positives to skip)

## What This Team Produces

1. **Attack Surface Map** — exposed entry points, IPC surfaces, agent spawn boundaries, network listeners
2. **Secrets Exposure Report** — .env, vault, API key, token leaks in code/logs/IPC/DB
3. **Injection Vector Map** — prompt injection, SQL, command, XSS, SSTI, path traversal, deserialization
4. **Stealth Threat Analysis** — APT patterns, AI prompt manipulation, supply chain, covert channels, evasion
5. **Threat Intelligence Package (TIP)** — unified cross-agent findings table (CRITICAL/HIGH/MEDIUM/LOW)
6. **Hardened Policy Fragment** — paste-ready text for `--append-system-prompt-file` or `CLAUDE.md`
7. **Priority Remediation List** — P0 (pre-commit), P1 (this sprint), P2 (scheduled)
8. **Vault/Secrets Rotation Protocol** — ordered list of credentials to rotate

## Agent Sequence

```
[1] threat-scout         → Attack Surface Map + Anomaly Signal List
[2] secrets-guardian  \  → Secrets Exposure Report      (parallel — max 2 active)
[2] injection-analyst /  → Injection Vector Map
[3] stealth-detector     → Stealth Threat Analysis
[4] incident-responder   → TIP + Hardening Plan + Rotation Protocol
```

Max 3 agents active at once. Lead orchestrates handoffs.

## Invocation Modes

```
/team-threat-defense                    → full scan (all domains, entire src/)
/team-threat-defense <path>             → scoped scan of specific file or folder
/team-threat-defense secrets            → secrets-guardian only
/team-threat-defense injection          → injection-analyst only
/team-threat-defense stealth            → stealth-detector only
/team-threat-defense surface            → threat-scout only
/team-threat-defense respond            → incident-responder only (requires prior scan output)
```

## Key Rules

- **No code fixes** — all agents report only. Devs fix. Human approves CRITICAL items.
- **No secret values in reports** — reference file:line and variable name only, never the actual value.
- **CRITICAL findings shown inline immediately** — do not wait for the full report to surface them.
- **Gate before commit** — no git-ops commit while open CRITICALs exist from this team.
- **Accepted risks require human sign-off** — log to `.claire/sec-devops.md` under Accepted Risks.
- **Complement sec-devops, not replace it** — this team focuses on external/AI threats; sec-devops covers OWASP + architecture.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Running all 6 agents simultaneously | Max 3 active — follow the sequence above |
| Logging actual secret values in reports | Reference location only (file:line, env var name) |
| Applying hardening policy without human review | Present the fragment, wait for explicit approval |
| Skipping threat-scout and jumping to injection-analyst | threat-scout surface map is required input for scope |
| Marking a CRITICAL as accepted-risk without human | Human sign-off required every time |
| Treating this team as a replacement for sec-devops | They are complementary — run both for full coverage |
