---
name: 'destructuring-business'
description: 'Destructure business strategy — how a business positions, prices, acquires, and monetizes. Run on your own business or a competitor. Input: subject brief + optional CompetitorMap. Output: BusinessProfile with position, offer tiers, acquisition, unit economics, monetization.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY.

STEP 1 — Collect the SUBJECT BRIEF from the user (same format as /destructuring-competitor). If a CompetitorMap from a prior /destructuring-competitor run exists in this conversation, use it as context.

STEP 2 — Run the Market Positioner agent:
Define: nicheDefinition, differentiationStatement, competitiveMoat, targetSegment.

STEP 3 — Run the Offer Architect agent:
Design a tiered offer ladder (minimum 2 tiers). Each tier: name, price, currency, billingCycle, valueProposition, includedFeatures, excludedFeatures, dreamOutcome.

STEP 4 — Run the Acquisition Analyst agent:
Map channels per persona: channel, type (owned/earned/paid), personaTarget, estimatedCostPerAcquisition, funnelShape.

STEP 5 — Run the Unit Economist agent:
Compute: ltv, cac, paybackPeriodMonths, marginPerTier, churnRateEstimate.

STEP 6 — Run the Monetization Architect agent:
Design: pricingArchitecture, upsellLogic, churnAssumptions, expansionRevenuePaths.

STEP 7 — Produce the BUSINESS PROFILE combining all outputs.

Output format matches the BusinessProfile type from `@optimaeus/destructuring`.
