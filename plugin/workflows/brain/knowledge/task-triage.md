# KNOWLEDGE: Task Triage — Human / AI / Human+AI / Outsource
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: IBM human-AI collaboration research, solopreneur AI stack analysis (2026),
        arxiv co-creation studies, delegation frameworks

---

## PURPOSE

Rules for classifying every task into one of four execution modes.
This determines WHO does the work and HOW it lands on the calendar.

---

## THE FOUR EXECUTION MODES

| Mode | Who does it | Calendar impact | Cost |
|---|---|---|---|
| HUMAN-ONLY | Human performs the task alone | Uses a human calendar slot | Human time (most expensive) |
| AI-ONLY | AI agent performs autonomously | No human slot needed — runs in background | AI compute (cheapest) |
| HUMAN+AI | Human and AI work together | Uses a human calendar slot, but output is 2-5x | Human time + AI compute |
| OUTSOURCE | External person or service | No human slot, but requires coordination slot | Money (variable) |

---

## RULE 1 — CLASSIFY EVERY TASK

Before placing any task on the calendar, classify it.

### Decision tree:

```
1. Can AI do this task autonomously with acceptable quality?
   YES → AI-ONLY
   NO  → continue

2. Can AI meaningfully assist a human on this task?
   YES → HUMAN+AI
   NO  → continue

3. Must the human personally do this? (judgment, relationship, performance)
   YES → HUMAN-ONLY
   NO  → OUTSOURCE candidate
```

---

## RULE 2 — WHAT STAYS HUMAN-ONLY

Tasks that require human judgment, presence, or relationship.

| Category | Examples | Why human-only |
|---|---|---|
| Strategic decisions | Pricing, partnerships, market entry | Consequences too high for AI |
| Relationship work | Client calls, investor meetings, team 1:1s | Trust requires human presence |
| Live performance | Podcast recording, presentations, demos | Audience expects a human |
| Final approval | Publishing, sending campaigns, signing contracts | Accountability stays human |
| Creative direction | Brand voice, product vision, editorial tone | AI can execute but not set direction |

---

## RULE 3 — WHAT AI DOES ALONE

Tasks that are rule-based, repetitive, or research-heavy.

| Category | Examples | Why AI-only |
|---|---|---|
| Research | Competitor analysis, market data, topic research | AI is faster and more thorough |
| First drafts | Show notes, social posts, email templates | Human reviews, AI creates |
| Data processing | Spreadsheet cleanup, analytics reports, summaries | Pattern matching at scale |
| Scheduling | Calendar management, meeting coordination | Rule-based optimization |
| Transcription | Audio-to-text, meeting notes | Commodity task |
| Distribution | Upload, schedule posts, cross-post | Repeatable automation |

---

## RULE 4 — WHAT HUMAN AND AI DO TOGETHER

These are the highest-leverage tasks. AI amplifies human capability.

### Five collaboration patterns:

| Pattern | How it works | Calendar impact | Best for |
|---|---|---|---|
| Hands-off | Human assigns, AI delivers autonomously | No human time — just a check-in slot later | Batch tasks with clear specs |
| Observational | AI works, human monitors and intervenes if needed | Minimal time — periodic check-ins | Tasks where AI is 80% right |
| Directive | Human sets strategy/direction, AI executes sub-tasks | Split — human front-loads, AI completes | Marketing strategy, content plans |
| Concurrent | Human and AI work simultaneously on same deliverable | Full human time — but output is 2-5x | Writing, editing, analysis |
| Iterative | AI drafts → human reviews → AI revises → human finalizes | Spread across multiple short sessions | Complex documents, code, designs |

### Rules for choosing a pattern:
1. Start with the most autonomous pattern that produces acceptable quality
2. Move to more hands-on only if output quality requires it
3. As AI improves on a task type, shift toward more autonomous patterns
4. Track which pattern produces best results for each task type

---

## RULE 5 — WHEN TO OUTSOURCE

Outsourcing triggers when the human calendar is full AND the task cannot be
done by AI alone.

### Outsource decision:

```
1. Is the human calendar full for this task's deadline?
   NO  → Do not outsource
   YES → continue

2. Can AI handle this task alone?
   YES → Move to AI-ONLY
   NO  → continue

3. Can AI + brief human oversight handle it?
   YES → Move to HUMAN+AI (hands-off or observational pattern)
   NO  → continue

4. Is the task critical enough to justify the cost?
   YES → OUTSOURCE — find a person or service
   NO  → RESCHEDULE to a later date
```

### Good outsource candidates:
- Graphic design (when templates are not sufficient)
- Video editing (complex, multi-camera)
- Bookkeeping and tax preparation
- Specialized technical work outside core skills
- Translation and localization

### Present options to user — never outsource automatically:
- "Your calendar cannot fit [task X] before [deadline]. Options:"
  1. Outsource to [type of service] — estimated cost: [range]
  2. Delegate to AI (lower quality, but fits timeline)
  3. Reschedule to [next available window]
  4. Reduce scope

---

## RULE 6 — CALENDAR PLACEMENT BY MODE

| Mode | Where it goes | How to schedule |
|---|---|---|
| HUMAN-ONLY | Human calendar, appropriate energy slot | Match to energy-and-focus.md rules |
| AI-ONLY | Background — no calendar slot needed | Queue for AI execution, set deadline for completion |
| HUMAN+AI | Human calendar, appropriate energy slot | Block the slot, note that AI is assisting |
| OUTSOURCE | Coordination slot only (15-30 min) | Brief + handoff in manager block, review in later slot |

---

## RULE 7 — RE-TRIAGE OVER TIME

Task classification is not permanent. Re-evaluate regularly.

| Trigger | Action |
|---|---|
| AI quality improves on a task type | Move from HUMAN+AI to AI-ONLY or from HUMAN-ONLY to HUMAN+AI |
| Human calendar becomes less constrained | Move outsourced tasks back to HUMAN-ONLY or HUMAN+AI |
| A task type consistently needs human rework after AI | Move from AI-ONLY to HUMAN+AI |
| Cost of outsourcing exceeds value | Stop outsourcing, bring back to HUMAN+AI |

---

## ANTI-PATTERNS

1. Doing everything yourself because "no one can do it like me"
2. Delegating to AI without reviewing output — AI makes confident mistakes
3. Using HUMAN+AI concurrent pattern for tasks that only need hands-off
4. Outsourcing before trying AI — AI is cheaper and faster for many tasks
5. No re-triage — keeping tasks in HUMAN-ONLY forever as AI capabilities grow
6. Automatically outsourcing without presenting options to the user
7. Expecting AI to set creative direction — AI executes direction, humans set it
