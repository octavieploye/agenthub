---
name: 'destructuring-patterns'
description: 'Extract good and bad patterns from multiple destructuring runs. Requires outputs from at least 2 prior /destructuring-* runs on different subjects. Input: prior outputs + optional focus question. Output: PatternReport with good/bad/neutral patterns, blind spots, synthesis.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY.

STEP 1 — Verify prerequisites:
This workflow requires outputs from at least 2 prior destructuring runs on DIFFERENT subjects. If fewer than 2 sets of prior outputs exist in this conversation, ask the user to run /destructuring-competitor, /destructuring-business, /destructuring-market, or /destructuring-dynamics on at least 2 subjects first.

STEP 2 — Collect optional FOCUS QUESTION:
Ask: "Is there a specific pattern you want to investigate? (e.g., 'what pricing pattern wins in EU SaaS?') Or should I extract all patterns?"

STEP 3 — Run the Pattern Extractor agent:
Find recurring strategies, positioning, pricing patterns across all subjects.

STEP 4 — Run the Success Analyst agent:
Isolate patterns correlated with strong market position, growth, retention.

STEP 5 — Run the Failure Analyst agent:
Isolate patterns correlated with churn, market loss, misalignment.

STEP 6 — Run the Synthesis Writer agent:
Produce final report: goodPatterns, badPatterns, neutralPatterns, blindSpots, synthesis narrative.

Each pattern includes: name, description, verdict, frequency, evidence, confidence, domain.

Output format matches the PatternReport type from `@optimaeus/destructuring`.
