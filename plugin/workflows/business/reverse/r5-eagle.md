# MODULE: r5-eagle
LAYER:  R5 — Eagle View (Reverse)
MODE:   REVERSE
TOKENS: ~600

## LOAD FIRST
core/non-assumption-rule
core/csl-protocol
core/confidence-scoring
core/signal-tiers
core/time-to-action
+ active geo/ modules
+ r4-sector output (Sector Context Map + updated knowledge gap map)
+ IF LOOP MODE: f1-eagle output (Macro Signal Map) — for crosscheck

## INPUT
Required: Sector Context Map from r4-sector
Required: Updated knowledge gap map from r4
Required: Active geo-tracks
Optional (LOOP MODE ONLY): Macro Signal Map from f1-eagle

## PROCESS
1. Identify macro forces shaping the sector found in r4.
   Use the same 5 force categories as f1-eagle:
   a. Capital flows
   b. Technology crossing deployment threshold
   c. Regulatory shifts
   d. Demographic / behavioral changes
   e. Geopolitical realignments

2. For each force found: assign CS + TTA

3. Check each force across all active geo-tracks — note divergence

4. CRITICAL FRAMING:
   Unlike f1-eagle (which scans for forces broadly), r5-eagle asks:
   "How do these macro forces specifically affect the r1 niche?"
   Every force must connect back to the original niche definition from r1.
   A macro force with no path to the r1 niche is noted but not primary.

5. INTEGRITY CHECK:
   Red flag A: zero contradictions across all macro sources — echo chamber risk
   Red flag B: macro conclusion exactly matches the opening belief in r1 — confirmation bias

6. IF LOOP MODE — run LOOP VALIDATION TABLE:
   Compare r5 macro findings with f1-eagle macro findings:
   Layer pair  r5 finding          f1 finding          Match?  Action
   Macro       [force from r5]     [force from f1]     Y/N     Y: +15 CS | N: CSL item
   If match: apply +15 CS modifier to that force in both outputs.
   If mismatch: CSL item — highest priority — present to user before synthesis.

7. Write Implications Block: what do these macro forces mean specifically for the r1 niche?
   This is the moment the full reverse picture comes together.

8. Close the knowledge gap map:
   All gaps from r1 should now be answered or explicitly listed as unresolved.
   Unresolved gaps carry to synthesis as open questions for the user.

## OUTPUT: Macro Context Map (Reverse)
Forces found (max 8, same format as f1-eagle Macro Signal Map):
  Force [ID]:
    Name:           [label]
    Direction:      creating / destroying / transforming
    Geos:           [active tracks where this applies]
    Geo-delta:      [divergence across tracks]
    CS:             [score]
    TTA:            [tag]
    Niche impact:   [how this force specifically affects the r1 niche]

LOOP VALIDATION TABLE (LOOP MODE only):
  [Comparison table — f1 vs r5 forces, match status, CS modifier or CSL item]

Implications Block:        top 3 niche-specific implications (full format)
Knowledge gaps resolved:   [all gaps answered from r1 through r5]
Knowledge gaps unresolved: [carry to synthesis as open questions]
CSL items:                 [numbered list — LOOP conflicts are highest priority]

## UPSTREAM INVALIDATION
If macro forces contradict r4 sector picture: CSL item.
If LOOP MODE mismatch between r5 and f1: highest-priority CSL item.

## HANDOFF
Feeds: synthesis/l6-synthesis
Gate before handoff:
  - >= 3 macro forces identified with CS >= 50
  - Each force connected to its niche-specific impact
  - LOOP crosscheck complete if in LOOP mode
  - Knowledge gap map finalized (resolved + unresolved)
  - All CSL items reviewed and resolved (or escalated to synthesis)
