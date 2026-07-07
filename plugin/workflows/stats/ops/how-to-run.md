# HOW TO RUN — Statistics & Probability Team

## Session Start Checklist (lead-stats)

1. Load ALL 4 core/ modules: trust-levels, uncertainty-notation, non-assumption-rule, scope-rule
2. Confirm the request type (see TASK ROUTING below)
3. Confirm geographic scope (global / regional / national)
4. Confirm domain focus (financial / market / social / risk / decision)
5. Check for any user-provided data (T0 sources) — inventory these first
6. Sequence the team accordingly (never more than 3 active at once)

---

## Task Routing

### "What is the size / growth of [market/sector]?"
  Lead agent: market-stats-researcher
  Load: m5-market-research
  Support: quant-analyst (m1-descriptive for data profiling)
  Optional: behavioral-analyst (m6-behavioral for consumer context)
  End: synthesis/stats-synthesis

### "What is the probability / likelihood of [event/scenario]?"
  Lead agent: quant-analyst
  Load: m2-probability
  Support: risk-modeler (m4-risk-assessment for base rate data)
  End: synthesis/stats-synthesis

### "Assess the risks of [scenario/business model type/sector]"
  Lead agent: risk-modeler
  Load: m4-risk-assessment
  Support: quant-analyst (m2-probability for occurrence probability inputs)
  Optional: decision-modeler (m7-decision-modeling for probability-weighted scenario view)
  End: synthesis/stats-synthesis

### "Analyze data / find patterns / test if X is true"
  Lead agent: quant-analyst
  Load: m1-descriptive FIRST, then m3-inference
  End: synthesis/stats-synthesis

### "Help me think through a decision between [options]"
  Lead agent: decision-modeler
  Requires FIRST: quant-analyst (m2/m3) + risk-modeler (m4) outputs
  Load: m7-decision-modeling
  Optional: behavioral-analyst (m6-behavioral for cognitive bias overlay)
  End: synthesis/stats-synthesis

### "What do we know about [consumer behavior / cognitive patterns / market psychology]?"
  Lead agent: behavioral-analyst
  Load: m6-behavioral
  Support: market-stats-researcher (m5) for quantitative market data context
  End: synthesis/stats-synthesis

### "Full research report on [topic]"
  Full sequence — all agents:
  1. market-stats-researcher: m5 (parallel with quant-analyst: m1)
  2. quant-analyst: m2 + m3 (parallel with risk-modeler: m4)
  3. behavioral-analyst: m6
  4. decision-modeler: m7
  5. lead-stats: synthesis/stats-synthesis

---

## Concurrency Rules

Never more than 3 teammates active at once.
Suggested parallel pairs:
  - market-stats-researcher (m5) + quant-analyst (m1): data gathering in parallel
  - quant-analyst (m2/m3) + risk-modeler (m4): analysis in parallel
  - behavioral-analyst (m6) can run while decision-modeler waits for quant/risk inputs

Always sequence:
  - decision-modeler AFTER quant-analyst and risk-modeler (it consumes their outputs)
  - synthesis AFTER all domain modules complete

---

## Output Standards Reminder

Every output from every team member must carry:
  - Trust tier (T0–T5) on every source
  - CS score (0–100) on every finding
  - Uncertainty range (± or [low–high] with CI) on every quantitative claim
  - Plain language summary after every statistical result

---

## What This Team Does NOT Do (Scope Reminder)

NEVER:
  - Analyze the user's own business, projects, or operations
  - Prescribe action ("you should do X")
  - Give investment advice
  - Resolve data conflicts — surface them for user decision
  - Present a number without its uncertainty range
  - Cite a source past its decay window without flagging it as expired

ALWAYS:
  - Lead with the finding, not the process
  - Show sources inline, not in a footnote (user needs to see trust level immediately)
  - Surface conflicts (CSL items) before presenting conclusions
  - End every session output with the handoff note from stats-synthesis

---

## Escalation to Other Teams

If the research reveals business strategy implications → handoff to `business` team.
If the research requires market competitive intelligence → handoff to `business` team (market-researcher).
If the research will inform a marketing or positioning decision → handoff to `marketing` team.
Stats team produces the analytical foundation. Other teams act on it.
