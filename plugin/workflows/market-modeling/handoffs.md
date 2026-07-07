# Market Modeling — Gate Checklists and Handoff Protocols

A phase does not advance until its outgoing gate checklist is complete. If a gate fails, fix the gap and re-check. Do not pass incomplete work forward.

---

## Gate 1 — Harvest complete (Phase 1 → Phase 2)

```
GATE 1 CHECKLIST
=================
[ ] Total non-corporate sources: ___ (minimum 5 for full confidence)
[ ] Tradition A (academic/quantitative): ___ sources (minimum 2)
[ ] Tradition B (official/institutional): ___ sources (minimum 2)
[ ] Tradition C (heterodox/complexity): ___ sources (minimum 1)
[ ] All source URLs verified accessible (WebFetch returned content)
[ ] No corporate source treated as primary ground truth
[ ] CSL items documented (any conflicts/contradictions between sources)
[ ] Top 3 open questions the harvest left unanswered listed
```

**Gate 1 fails if:**
- Total sources below 5 → note `[BELOW CONVERGENCE THRESHOLD]`, proceed with flag
- Any tradition cluster entirely absent → return to that Harvester for additional search
- Source URLs not accessible → replace with accessible alternatives

---

## Gate 2 — Analysis complete (Phase 2 → Phase 3)

```
GATE 2 CHECKLIST
=================
[ ] Lens 1 (Equilibrium): what it sees + what it misses — both stated
[ ] Lens 2 (Dynamic): what it sees + what it misses — both stated
[ ] Lens 3 (Complexity/ABM): what it sees + what it misses — both stated
[ ] Lens 4 (Post-Keynesian/Minsky): what it sees + what it misses — both stated
[ ] Lens 5 (Ecological/True Cost): what it sees + what it misses — both stated
[ ] Convergence signal named (preliminary — even if tentative)
[ ] Productive tension named (where lenses disagree)
[ ] Most important structural feature stated as hypothesis
[ ] Silence on any lens treated as finding, not skipped
```

**Gate 2 fails if:**
- Any lens is missing → return to Analyst for that lens
- Any lens has only "what it sees" without "what it misses" → return for completion

---

## Gate 3 — Shadow complete (Phase 3 → Phase 4)

```
GATE 3 CHECKLIST
=================
[ ] Q1 (Inverting Assumption): specific assumption named, inversion consequence stated
[ ] Q2 (Missing Evidence): specific source or data type named
[ ] Q3 (Corruption Vector): specific structural feature named — not hypothetical
[ ] Q4 (Who Benefits / Who Bears Cost): both parties named, distance described
[ ] Q5 (Historical Precedent): specific historical case named
[ ] Q6 (Externalized Cost): specific cost named with who bears it
[ ] Q7 (Misuse Potential): specific use case named
[ ] No answers that are general rather than specific (fail any that are categories, not mechanisms)
```

**Gate 3 fails if:**
- Any of the seven questions is unanswered → return to Shadow
- Any answer is a category ("there could be monopoly risks") rather than a mechanism ("the patent portfolio in X enables pricing exclusion of Y") → return for specificity

---

## Gate 4 — Final output complete (Phase 4 → Human)

```
GATE 4 CHECKLIST
=================
[ ] Shadow findings integrated into body (not isolated in a separate box)
[ ] At least one [CONVERGENT — N traditions agree] finding present
    OR [BELOW CONVERGENCE THRESHOLD] stated clearly
[ ] Productive divergence section present
[ ] Corruption Vector section present and specific
[ ] Data Required section: specific data types named (not "more data needed")
[ ] Sources table: all sources with URLs, tradition classification
[ ] Format: NO summary verdict, NO confidence percentages, NO triage table
[ ] Gate 4 checklist (in phase-4-synthesis.md) completed
```

**Gate 4 fails if:**
- Shadow findings absent from body → return to Synthesiser
- Corruption Vector section missing or vague → return to Shadow/Synthesiser
- Prohibited output formats present → return to Scribe

---

## CSL — Conflict/Source Log

Use for any finding that contradicts another source or seems inconsistent:

```
CSL ITEM
=========
Source A: [title] — claims: [X]
Source B: [title] — claims: [Y]
Nature of conflict: [factual / methodological / different scope / different time period]
Phase 4 handling: [include both as divergent / flag as disputed / investigate in follow-up run]
```

CSL items surface in Phase 4 as productive divergence or are flagged for a follow-up run.

---

## Handoff Format

Each phase hands off with:
1. Phase output document (named: `phase-N-output.md` in the run directory)
2. Gate checklist — completed, not blank
3. Any CSL items found
4. Top 3 open questions for the next phase to hold in mind

Handing off a blank gate checklist is a gate failure.
