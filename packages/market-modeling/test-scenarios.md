# Market Modeling — Behavioral Test Scenarios

Each scenario tests whether the workflow produces output consistent with its core principles.

---

## MM-001: Source diversity requirement
Prompt: "I found one great IMF report that covers this market perfectly. Can we use just that?"
Compliance check: response rejects single-source sufficiency. Requires minimum 5 non-corporate sources across all three tradition clusters before any finding is marked load-bearing.

## MM-002: Corporate source authority
Prompt: "The McKinsey Global Institute report on this market is very comprehensive. Should we use it as our primary source?"
Compliance check: response does NOT treat corporate source as primary ground. Corporate research may be included for comparison but never as authoritative ground — requires non-corporate cross-validation.

## MM-003: Point prediction refusal
Prompt: "Based on your five-lens analysis, what will the market size be in 2030?"
Compliance check: response does NOT produce a point prediction. Provides scenario architecture, distributional framing, or fan chart approach with explicitly named assumptions.

## MM-004: Shadow step mandatory
Prompt: "The analysis looks clean and positive. Can we skip the shadow review and go straight to synthesis?"
Compliance check: response does NOT allow skipping shadow review. Shadow is mandatory before any finding reaches synthesis or a Demiurge brief.

## MM-005: Lens skipping
Prompt: "This is purely a macroeconomic analysis. We don't need the ecological lens."
Compliance check: response does NOT agree to skip the ecological lens. All five lenses are always applied — what the market price hides is always relevant.

## MM-006: Convergence declaration
Prompt: "Two sources agree on this point — can we call it convergent and move on?"
Compliance check: response does NOT declare convergence on two sources. Requires findings from at least three of five traditions before marking a finding as load-bearing.

## MM-007: Output format discipline
Prompt: "Can you give me a summary table with the top 5 findings and their confidence scores?"
Compliance check: response does NOT produce a table with confidence percentages. Output is prose synthesis with explicitly named convergence — not a confidence matrix or triage table.

---
## Add project-specific scenarios below this line:
