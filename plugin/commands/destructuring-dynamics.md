---
name: 'destructuring-dynamics'
description: 'Destructure market dynamics — forces, barriers, power structures, trends. NOT economic modeling (use /modelise for that). Input: subject brief + optional prior outputs. Output: MarketDynamicsMap.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY.

STEP 1 — Collect the SUBJECT BRIEF. Use any prior workflow outputs as context.

STEP 2 — Run the Force Analyst agent:
Map four force types per segment: pull, friction, competitive, amplifier. Each: type, name, description, strength (1-10), affectedSegments.

STEP 3 — Run the Barrier Mapper agent:
Map entry barriers: type (regulatory/capital/network-effects/switching-costs/brand/technology), description, severity (low/medium/high/prohibitive), affectedEntrants.

STEP 4 — Run the Power Analyst agent:
Map power structures: actor, controlMechanism, concentrationLevel, rentExtraction, lockInMechanism.

STEP 5 — Run the Trend Extractor agent:
Map structural trends: name, direction (growing/stable/declining/volatile), timeHorizon (12mo/24mo/36mo), impact, confidence (high/medium/low).

STEP 6 — Produce the MARKET DYNAMICS MAP.

Output format matches the MarketDynamicsMap type from `@optimaeus/destructuring`.
