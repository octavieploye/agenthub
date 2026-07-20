---
name: team-before-the-meeting
description: Before the Meeting Team Orchestrator — sequential bundle: Price Proof → Proposal Proof → Pitch Proof → Synthesis. Produces a single meeting readiness brief with go/fix/hold verdict.
category: business-venture
---

# Before the Meeting

Sequential bundle that runs all three pre-meeting stress-tests in order: price validated → proposal validated → pitch validated → single readiness brief. Each step feeds its output into the next, producing a more coherent result than running the three packs independently.

## When to Use

- "Run the full Before the Meeting bundle"
- "I have a meeting coming up — check my price, proposal, and pitch"
- "I want the full pre-meeting readiness check"
- User wants a comprehensive pre-meeting audit rather than one specific check

## What You Need Before Starting

- **Pricing context**: scope of work, client type, your current rate idea
- **Proposal text**: paste the full proposal (or draft)
- **Pitch materials**: deck outline, talking points, or meeting agenda
- **Meeting context**: who is the client, what is this meeting for?

If any of these are missing, the orchestrator will ask for them before dispatching the relevant agent. The bundle can be run with partial materials — missing steps will be flagged, not silently skipped.

## What This Team Produces

A single **Meeting Readiness Brief** containing:
- Price Proof verdict (go / adjust / hold + confirmed rate)
- Proposal Proof verdict (send / revise + top 3 objections preempted)
- Pitch Proof verdict (readiness score + top 3 changes)
- Overall meeting readiness: go / fix / hold
- Critical blockers (if any) that must be resolved before the meeting
- Top 5 changes ranked by impact across all three dimensions

## Agent Sequence

Sequential — each agent completes before the next starts. Outputs are passed forward.

1. **btm-price-agent** — runs Price Proof on the pricing context
   - Output: validated rate + rationale + top 3 price objections
   - Passes to: btm-proposal-agent

2. **btm-proposal-agent** — runs Proposal Proof on the proposal + price verdict
   - Input: proposal text + price verdict from Step 1
   - Output: section critique + top 3 proposal objections + send/revise verdict
   - Passes to: btm-pitch-agent

3. **btm-pitch-agent** — runs Pitch Proof on the pitch + proposal critique
   - Input: pitch materials + proposal critique from Step 2
   - Output: readiness score + champion/skeptic simulation + top 3 pitch changes
   - Passes to: btm-synthesizer

4. **btm-synthesizer** — consolidates all three outputs
   - Input: all outputs from Steps 1–3
   - Output: Meeting Readiness Brief with overall verdict + top 5 changes + critical blockers

## Key Rules

- **Never run steps in parallel** — each step requires the output of the previous one
- **Never skip a step silently** — if materials are missing for a step, flag it and ask before continuing
- **Never merge all three critiques into one undifferentiated list** — maintain price / proposal / pitch separation in the final brief
- Synthesizer does NOT re-run the individual analyses — it consolidates existing outputs only
- If the user has already run one or two individual packs, the orchestrator can use those outputs and skip the corresponding step

## Individual Skills

Each pack can also be run standalone without the bundle:
- `price-proof` — price check only
- `proposal-proof` — proposal review only
- `pitch-proof` — pitch test only
