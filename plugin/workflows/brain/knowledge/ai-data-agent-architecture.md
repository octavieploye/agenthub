# KNOWLEDGE: AI + Data Agent Architecture
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Latent Space podcast — Matei Zaharia & Reynold Xin (Databricks founders)

---

## PURPOSE

Principles for building AI agent systems on top of data. Extracted from
Databricks founders' experience scaling to 50-60 million VMs/day across
three clouds processing exabytes of data.

---

## THESIS

Get the data in the right place. Slap an agent on top. The magic comes out.

Generic agents have good reasoning capabilities. Many traditional software
paradigms will be rewritten with this new paradigm.

Data and context are becoming MORE valuable with AI, not less.

---

## PRINCIPLE 1 — DATA FIRST, AGENT SECOND

| Step | What | Why |
|---|---|---|
| 1 | Get data into the right place | Agents are only as good as what they can access |
| 2 | Make data queryable and governed | Security + structure enables agent reliability |
| 3 | Add agent layer on top | Reasoning over structured, accessible data |

The agent does not replace the data layer. It sits on top of it.
Without the data foundation, agents hallucinate and guess.

---

## PRINCIPLE 2 — CODING AGENTS AND CUSTOM AGENTS FACE THE SAME PROBLEMS

Whether building coding infrastructure or customer-facing agents, the
challenges are identical:

| Challenge | What it means |
|---|---|
| Security | Who can access what, when, and in what context |
| Delivery | How agents are deployed, updated, and monitored |
| Portability | Agents must not be locked to one model or platform |
| Collaboration | Multiple humans and agents sharing sessions |
| Model switching | Ability to swap models without rewriting agents |

Build the infrastructure once, serve both use cases.

---

## PRINCIPLE 3 — NETWORK PROTOCOL THINKING

Agent infrastructure should work like Internet protocols:
- Interoperability between parties moving at different speeds
- Common API on top of all harnesses (OpenAI SDK, etc.)
- Map different interfaces to the same standard
- Open-source layers that benefit from network effects win long-term

Open > proprietary. Community integrations compound.

---

## PRINCIPLE 4 — COMPUTE SANDBOXING FOR AGENTS

Agents need persistent, secure compute environments.

| Requirement | Why |
|---|---|
| Cloud sandboxes that don't shut down | Agents need persistent development environments |
| Local persistence | Libraries should not reinstall every session |
| Shell access | Agents need to list files, run commands, render output |
| Security boundaries | Login, session sharing, access control |

Key insight: a compute sandbox for agents is a database architecture
with the database removed — keep the compute, storage, and orchestration.

---

## PRINCIPLE 5 — CONTEXTUAL SECURITY POLICIES

Static permissions are insufficient for agents. Security must be contextual.

### The problem:
Should an agent that reads confidential docs also be allowed to publish
to a website? No — prompt injection could exfiltrate data.

### The solution:
Track the STATE of the session to govern actions:

| State | What agent accessed | What agent can do |
|---|---|---|
| Clean | No sensitive data | Full permissions |
| Sensitive | Read confidential docs | Cannot write externally |
| Elevated | User granted temporary permission | Scoped action allowed |

Permissions change based on what the agent has seen, not just who launched it.

---

## PRINCIPLE 6 — TOKEN BUDGETS

Cap agent spend to prevent runaway costs.

| Rule | How it works |
|---|---|
| Set budget per sub-agent | "This agent can spend max $5" |
| Require permission to exceed | Agent pauses and asks before continuing |
| Track spend in real-time | Dashboard of token usage per agent per session |
| Budget inheritance | Parent agent's budget limits child agents |

This is data governance applied to AI compute — same principles as
managing database query costs, applied to agent token consumption.

---

## PRINCIPLE 7 — SPECIALIZED MODELS BEAT GENERAL MODELS FOR HIGH-VOLUME TASKS

| Approach | Cost | Quality | When to use |
|---|---|---|---|
| General frontier model | High | Good | Novel tasks, complex reasoning, low volume |
| Specialized fine-tuned model | 100x cheaper | Better (for its domain) | High-volume repetitive tasks (document parsing, data extraction, classification) |

### Rules:
1. Start with a general model to prove the use case works
2. When volume justifies it, train a specialized model
3. Specialized models can be 100x cheaper AND higher quality for their domain
4. The goal is not to train a frontier model — it is to make models useful for YOUR data

---

## PRINCIPLE 8 — PLATFORM CONSOLIDATION WINS

### The pattern:
1. First phase: decompose into best-of-breed tools (ingestion, transformation, visualization)
2. Customer pain: managing 5 different vendors is painful
3. Second phase: consolidate into unified platform with common interfaces

### Applied to AI agents:
- Don't build separate infrastructure for each agent type
- Provide a common API layer that maps different SDKs to one interface
- Let users switch models without rewriting agents
- Open-source the interop layer — network effects will defend it

---

## PRINCIPLE 9 — REWRITE FROM SCRATCH WHEN WARRANTED

Most systems are decades old, full of hacked-around abstractions.

### When to rewrite:
- The existing architecture cannot support the new paradigm
- You can hire people who have built multiple systems before
- You can avoid "second system syndrome" by having experienced builders

### How Databricks did it:
- Hired engineers who had built 2-3 database engines already
- Built a "factory" using ML to predict the best algorithm per query
- ML model trained on a quadrillion trace data points
- Dispatches the right algorithm at runtime based on data sparsity, latency, memory

---

## PRINCIPLE 10 — OPENNESS AS COMPETITIVE ADVANTAGE

| Strategy | Outcome |
|---|---|
| Open formats (no proprietary lock-in) | Customers adopt faster, trust more |
| Open-source infrastructure layers | Community contributes, network effects compound |
| Common APIs across providers | Reduces switching cost, increases platform value |
| Start upstream (bulk processing, data engineering) | Build trust before moving to higher-value layers |

Databricks never had a proprietary format. This is cited as a key
differentiator against competitors who did.

---

## KEY QUOTES

> "Get the data in the right place, and slap some agent on top;
> the magic will come out."

> "Many traditional software paradigms will be rewritten with this
> new paradigm."

> "Data and context are becoming more valuable with AI."

> "We focus on making models useful for querying data... specialized
> models for high-volume cases are 100x cheaper and better than
> general models."

> "A layer that benefits from a network effect and community
> integrations will win in the long run."

---

## ANTI-PATTERNS

1. Building agents without a data foundation — agents hallucinate without data
2. Using one general model for everything — specialized models are cheaper and better at scale
3. Proprietary formats — they slow adoption and lock customers in
4. Static security — agent permissions must be contextual, not role-based
5. No token budgets — agents run up costs without spend caps
6. Separate infrastructure per agent type — build the platform once
7. Patching old architecture — sometimes a clean rewrite with experienced builders is faster
