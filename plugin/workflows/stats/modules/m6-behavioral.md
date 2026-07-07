# MODULE M6 — Behavioral Economics and Cognitive Research

Agent: behavioral-analyst
Purpose: Map cognitive biases, social influence patterns, and behavioral drivers relevant to markets, consumers, and decision-making contexts.

---

## When to Load

Load M6 when:
  - Understanding why markets or consumers deviate from rational models
  - Researching cognitive factors affecting financial decisions or risk perception
  - Analyzing social dynamics in adoption, pricing sensitivity, or competitive positioning
  - Providing behavioral context to decision-modeler (M7) inputs

---

## Scope Rule (enforced in this module)

This module describes patterns in populations, markets, and economic behavior.
It does NOT apply to the user personally.
It does NOT profile the user's customers without their explicit data.
It provides reference patterns. The user applies them to their context.

---

## Core Cognitive Bias Inventory

Each entry: Bias name | Domain | Description | Strength of evidence | Source

### Financial and Economic Biases

Loss Aversion
  Domain: Financial, risk, pricing
  Description: Losses feel ~2× as painful as equivalent gains (Kahneman & Tversky, 1979).
  Market effect: People hold losing assets too long, sell winners too early (disposition effect).
  Strength: Very High — replicated extensively across cultures and domains.
  Source: Kahneman & Tversky (1979), Prospect Theory. T2 CS: 88.

Hyperbolic Discounting
  Domain: Financial, consumer, savings
  Description: People overweight present rewards relative to future ones, at a rate steeper than exponential.
  Market effect: Under-saving, preference for immediate vs. deferred payments, subscription churn.
  Strength: High — robust across lab and field studies.
  Source: Laibson (1997), Thaler & Benartzi (2004). T2 CS: 82.

Overconfidence Bias
  Domain: Financial, business, forecasting
  Description: People systematically overestimate their accuracy and their control over outcomes.
  Market effect: Excess trading, over-entry into competitive markets, underestimation of project costs.
  Strength: Very High — one of the most replicated findings in behavioral finance.
  Source: Barber & Odean (2001); DeBondt & Thaler (1995). T2 CS: 85.

Anchoring Effect
  Domain: Pricing, negotiation, forecasting
  Description: First number seen disproportionately influences subsequent judgments.
  Market effect: Pricing anchors set reference points; salary anchors in negotiation; analyst forecast anchoring.
  Strength: High.
  Source: Tversky & Kahneman (1974). T2 CS: 83.

### Market and Social Biases

Herding / Social Proof
  Domain: Financial markets, consumer adoption, social trends
  Description: Individuals follow crowd behavior, especially under uncertainty.
  Market effect: Asset bubbles, bank runs, cascade adoption, viral products.
  Strength: Very High — observed empirically in markets and lab settings.
  Source: Banerjee (1992) theoretical; Bikhchandani et al. (1992). T2 CS: 80.

Status Quo Bias
  Domain: Consumer, financial, organizational
  Description: Strong preference for the current state; change requires disproportionate justification.
  Market effect: Low switching rates, high retention in incumbent products, under-adoption of superior alternatives.
  Strength: High.
  Source: Samuelson & Zeckhauser (1988). T2 CS: 78.

Availability Heuristic
  Domain: Risk perception, media-influenced markets
  Description: Probability of events is judged by how easily examples come to mind.
  Market effect: Overestimation of salient risks (recent crash, news-driven fear); underestimation of chronic/quiet risks.
  Strength: High.
  Source: Tversky & Kahneman (1973). T2 CS: 82.

Sunk Cost Fallacy
  Domain: Business, financial, organizational
  Description: Past irrecoverable costs irrationally influence future decisions.
  Market effect: Continued investment in failing projects, delayed exits.
  Strength: High.
  Source: Arkes & Blumer (1985). T2 CS: 78.

---

## Social and Behavioral Economics Patterns

### Price Psychology

Reference Price Effect: Consumers evaluate prices relative to a reference (anchor), not in absolute terms.
  Evidence: Grocery pricing studies, Ariely (2008) arbitrary coherence. T2 CS: 80.

Decoy Effect (Asymmetric Dominance): A third, inferior option increases preference for the "better" of the original two.
  Market application: Subscription tier design, product line architecture.
  Source: Huber, Payne & Puto (1982). T2 CS: 74.

Price-Quality Heuristic: Higher price signals higher quality when product quality is uncertain.
  Market application: Premium product positioning; price floor risks.
  Source: Multiple replication studies. T2 CS: 72.

### Consumer Decision-Making

Choice Overload: Too many options reduces purchase probability and satisfaction.
  Threshold: Research suggests 6–10 options near-optimal; beyond ~24 reduces conversion.
  Source: Iyengar & Lepper (2000) — jam study. T2 CS: 65. Note: replication results mixed — use directionally.

Default Effect: Pre-set defaults capture disproportionately large share of outcomes.
  Evidence: Retirement enrollment (Thaler & Sunstein); organ donation rates by country.
  Source: Madrian & Shea (2001). T2 CS: 84.

---

## Behavioral Economics in Markets — Aggregate Effects

These are population-level patterns for reference:

  Asset bubbles:        Herd behavior + overconfidence + availability heuristic
  Market panics:        Loss aversion + availability heuristic + herding
  Consumer adoption:    Social proof + default effect + price-quality heuristic
  Under-diversification: Home bias (T2 CS: 75) + familiarity bias + overconfidence
  Financial exclusion:  Status quo bias + hyperbolic discounting + complexity aversion

---

## Strength of Evidence Classification

Very High (CS 80+): Replicated in many studies across multiple cultures and domains.
High (CS 65–79):    Replicated, with some boundary conditions noted.
Moderate (CS 50–64): Original finding replicated in some domains; contested in others.
Low (CS 35–49):     Original result; replication attempts mixed or limited.
Speculative (CS < 35): Theory-stage or single study. Do not use as evidence basis.

---

## Output Format

For every behavioral pattern cited:
  "[Bias/Pattern Name] — [Domain]
   Description: [one sentence]
   Market relevance: [how it manifests in the context being analyzed]
   Strength of evidence: [Very High / High / Moderate / Low]
   Source: [citation, T[x] CS: [n]]
   Applicable population: [general / specific demographic / cultural context]"
