# KNOWLEDGE: Data Sovereignty & Governance for AI Systems
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Internal architecture discussion, Databricks contextual security
        principles, Claude Enterprise data policies, EU/US jurisdiction analysis

---

## PURPOSE

Rules for determining where data can go based on its sensitivity, which
models can process it, and what legal/architectural protections exist.
Sovereignty means: your data, your infrastructure, your control.

---

## CORE PRINCIPLE

Cloud models + confidential data = sovereignty conflict.
Even with enterprise protections, data transiting foreign infrastructure
is architecturally non-sovereign.

---

## SOVEREIGNTY TIERS

| Tier | Where | Control | Legal jurisdiction |
|---|---|---|---|
| Tier 1 — Local | Your machine, your network | Full — data never leaves | Your country's laws only |
| Tier 2 — EU Cloud | EU-based provider (Mistral, OVH) | High — DPA + GDPR | EU data protection laws |
| Tier 3 — US Cloud | US-based provider (Anthropic, OpenAI, Google) | Medium — DPA + Terms | US law + CLOUD Act |
| Tier 4 — CN/adversarial | Non-allied foreign infrastructure | None | Foreign government access |

### Rules:
1. CONFIDENTIAL data: Tier 1 or Tier 2 only (with DPA)
2. RESTRICTED data: Tier 1 only (human eyes, no model)
3. INTERNAL data: Tier 1, 2, or 3 (with DPA/Enterprise terms)
4. PUBLIC data: Any tier
5. Tier 4: NEVER for any classification

---

## WHY ENTERPRISE PLANS DON'T FULLY SOLVE IT

| What Enterprise provides | What it does NOT solve |
|---|---|
| Data not used for training (contractual) | Data still TRANSITS through provider infrastructure |
| ZDR = deleted after processing (minutes) | DURING processing, data IS on their servers |
| DPA provides legal protection | Provider may be compelled by government (CLOUD Act) |
| BYOK gives encryption key control | Provider's system decrypts to process — keys alone don't prevent access |
| Audit logs show what was accessed | Cannot audit what happens inside the provider's processing pipeline |

### The bottom line:
Enterprise makes it **legally defensible** but not **architecturally sovereign**.

---

## CONTEXTUAL SECURITY (from Databricks principles)

Static permissions are insufficient. Security must be contextual —
based on what the agent has SEEN, not just who launched it.

| State | What agent accessed | What agent can do |
|---|---|---|
| Clean | No sensitive data | Full permissions — can write externally |
| Sensitive | Read CONFIDENTIAL docs | Cannot write externally, cannot relay to other models |
| Elevated | User granted temporary override | Scoped action allowed, time-limited |

### Rules:
1. An agent that has read CONFIDENTIAL data cannot publish to external services
2. An agent that has read CONFIDENTIAL data cannot relay content to a US cloud model
3. Permissions change based on session state, not just role
4. Prompt injection risk: a compromised agent with CONFIDENTIAL access is a data exfiltration vector

---

## TOKEN BUDGETS

Cap agent spend to prevent runaway costs AND runaway data access.

| Rule | Implementation |
|---|---|
| Set budget per agent session | "This agent can consume max $5 / max 50k tokens of knowledge" |
| Require permission to exceed | Agent pauses and asks before continuing |
| Budget inheritance | Parent agent's budget limits child agents |
| Knowledge volume cap | Prevent an agent from downloading the entire knowledge base |

---

## THE CLOUD ACT PROBLEM

The US CLOUD Act (2018) allows US law enforcement to compel US-based
companies to produce data stored anywhere in the world.

| Implication | Impact |
|---|---|
| Anthropic is US-incorporated | Subject to CLOUD Act regardless of where data is processed |
| A US warrant can compel disclosure | Even if data is "deleted" via ZDR, processing logs may exist |
| Enterprise DPA is contractual, not architectural | Legal challenge possible but not guaranteed protection |
| EU GDPR conflicts with CLOUD Act | Creates legal uncertainty for EU-based customers |

### For your architecture:
- US cloud models get INTERNAL access maximum
- CONFIDENTIAL stays local (Tier 1) or EU cloud (Tier 2) with DPA
- RESTRICTED never touches any model anywhere

---

## PRACTICAL DECISION TABLE

When you have sensitive data and need AI processing:

```
1. Is the data RESTRICTED?
   YES → Human only. No model. Stop.

2. Is the data CONFIDENTIAL?
   YES → Can a local model (70B) handle the task?
         YES → Use local model. Sovereign.
         NO  → Is there an EU cloud provider with DPA?
               YES → Use EU cloud. Tier 2 sovereign.
               NO  → Can the task be done with a REDACTED version?
                     YES → Redact sensitive fields, send to US cloud
                     NO  → Task cannot be done with AI. Human only.

3. Is the data INTERNAL?
   YES → Use any model with DPA/Enterprise terms.

4. Is the data PUBLIC?
   YES → Use any model. No restrictions.
```

---

## FUTURE: CONFIDENTIAL CONTRACT HANDLING

When contracts enter the knowledge system:

| Step | What happens |
|---|---|
| Upload | Contract classified CONFIDENTIAL automatically |
| Storage | Encrypted at rest, local or EU only |
| Metadata | Stored in SQLite: parties, dates, term summary (not full text) |
| Large local model (70B) | Full document access — sovereign Tier 1 |
| EU cloud (with DPA) | Full document access — sovereign Tier 2 |
| US cloud (Claude Enterprise) | BLOCKED — "Classified CONFIDENTIAL, requires sovereign model" |
| Small local model (7B) | Summary only: "Contract with [party] dated [date], 3-year term" |
| Audit | Every access logged: who, when, what was served |

---

## ANTI-PATTERNS

1. Trusting "not used for training" as equivalent to sovereignty — it is not
2. Sending CONFIDENTIAL data to US cloud because "we have Enterprise" — legally defensible, not sovereign
3. No contextual security — an agent that read a contract can relay it to any service
4. No token/knowledge budget — agent downloads entire knowledge base
5. Assuming BYOK = full protection — the system decrypts to process
6. Ignoring the CLOUD Act when choosing providers
7. Treating all cloud providers as equivalent — jurisdiction matters
