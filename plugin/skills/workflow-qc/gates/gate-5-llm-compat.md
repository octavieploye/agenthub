# GATE 5 — LLM COMPATIBILITY
MODE: lightweight (Part A only) | full (Part A + Part B)
TOKENS: ~500

## INPUT
Required: manifest.md with TOKEN BUDGET GUIDE section
Required: token count declared for each module

## PART A — STATIC ASSESSMENT (lightweight + full)

STEP 1 — PEAK CONTEXT CALCULATION
Identify the heaviest simultaneous load scenario from the manifest LOAD ORDER.
Typical pattern: core modules (always loaded) + max active geo modules + one layer module + synthesis module.
Sum all token counts that would be in context at that moment.
Peak tokens = [sum]

STEP 2 — TIER ASSIGNMENT
Compare peak tokens against thresholds:
  Tier 1: ≤ 3,000 tokens   Any model — 7B local via Ollama, all APIs, Mistral Ministral
  Tier 2: ≤ 8,000 tokens   8B+ model or small API — Mistral Small 4, Claude Haiku, Kimi Mini
  Tier 3: ≤ 32,000 tokens  Mid API — Mistral Small 4 (256K), Claude Haiku 3.5, Kimi
  Tier 4: ≤ 128,000 tokens Large API — Mistral Large, Claude Sonnet 4.6, Kimi K2.5
  Tier 5: > 128,000 tokens Top API only — Claude Sonnet/Opus 4.6 (1M ctx), Kimi K2.5 (256K)

STEP 3 — ROLE COMPLEXITY BUMP
Does the workflow run multiple simultaneous cognitive roles (e.g. Harvester A + B + C + Analyst at once)?
  YES: bump minimum tier up by 1 (parallel roles require stronger instruction following)
  NO:  no bump

STEP 4 — OUTPUT FORMAT COMPLEXITY BUMP
Does any step require structured tables, scored multi-section output, or synthesis across 5+ sources?
  YES: minimum tier is at least 2
  NO:  no bump

STEP 5 — LOST-IN-MIDDLE RISK CHECK
If peak tokens > 16,000 AND critical instructions are in the middle of the context (not start or end):
  Flag: WARN:lost-in-middle — models perform worse on instructions buried in long context
  Recommendation: move critical rules to the top of the step file

## PART B — LIVE SIMULATION (full mode only)
Requires: access to the lowest feasible model for the assigned tier

SYNTHETIC INPUT:
"Analyze the sustainable packaging materials market in the European Union.
My company produces biodegradable films. I want to understand competitor positioning,
growth segments, and upcoming regulatory changes."

TASK:
  1. Feed: [synthetic input] + [first workflow step instruction] to the model
  2. Collect the generated output
  3. Check against the step's declared OUTPUT FORMAT — are all required sections present?
  4. Score: PASS (all sections present, format clean) | PARTIAL:[missing] | FAIL:[collapsed]

## RESULT LOGIC
PASS:   All steps produce valid tier assessment and simulation (if run) passes
WARN:   Lost-in-middle risk flagged or simulation returns PARTIAL
FAIL:   Simulation returns FAIL or tier calculation is impossible due to missing token declarations

## OUTPUT FORMAT
GATE 5 — LLM COMPATIBILITY
Peak tokens in context:      [calculated sum]
Role complexity bump:        YES:[new minimum tier] | NO
Output format bump:          YES:[minimum tier 2+] | NO
Lost-in-middle risk:         NONE | WARN:[affected steps]
MINIMUM_LLM_TIER:            [1-5]
Tier 1 (any 7B+):            YES | NO | PARTIAL
Tier 2 (small API):          YES | NO | PARTIAL
Tier 3 (mid API):            YES | NO | PARTIAL
Tier 4 (large API):          YES | NO | PARTIAL
Tier 5 (1M+ ctx):            YES | NO
Live simulation result:      [full: PASS | PARTIAL | FAIL] | not run (lightweight)
Recommended minimum model:   [plain language — e.g. "Mistral Small 4 or Claude Haiku 3.5"]
Result:                      PASS | WARN:[count] | FAIL:[reason]
