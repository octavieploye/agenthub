---
name: 'destructuring-competitor'
description: 'Destructure competitors — micro scale. Name and reverse-engineer closest competitors by geographic radius (local > national > continental > worldwide). Input: subject brief. Output: CompetitorMap organized by geographic ring.'
---

IT IS CRITICAL THAT YOU FOLLOW THESE INSTRUCTIONS EXACTLY.

STEP 1 — Collect the SUBJECT BRIEF from the user:

```
DESTRUCTURING SUBJECT
=====================
Name:           [product/service/business name]
Description:    [one-sentence description]
Geographic base: [city, country — e.g. "Lyon, FR" or "digital-global"]
Geo radius:     [local | national | continental | worldwide]
Sector:         [industry/niche]
```

Do not proceed until all fields are provided.

STEP 2 — Run the Competitor Scanner agent:
For each geographic ring up to the specified radius (micro to macro: local > national > continental > worldwide), identify named competitors. Each ring must be mapped before expanding to the next.

For each competitor found, produce a COMPETITOR CARD:
- name, url, geoRing, location
- category: direct | adjacent | upstream | downstream | substitute
- audienceServed, coreValueProp, pricingModel
- deploymentModel: cloud | local | hybrid
- keyWeakness, keyStrength, switchingCost: low | medium | high

STEP 3 — Run the Strategy Extractor agent:
For each named competitor, extract: acquisitionChannels, techStack, moat, gaps, complaints.

STEP 4 — Run the Weakness Mapper agent:
Enrich gaps and complaints with deeper analysis from reviews (3-4 star are reality), forums, and public complaints.

STEP 5 — Produce the COMPETITOR MAP:
Organize all enriched competitor profiles by geographic ring. Include total count.

Output format matches the CompetitorMap type from `@optimaeus/destructuring`.
