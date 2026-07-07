# Phase 1 — Parallel Harvest
Roles: Harvesters A, B, C (simultaneous)
Gate output: HARVEST-OUTPUT → Analyst (Phase 2)

---

## OBJECTIVE

Retrieve intelligence from a minimum of five non-corporate sources across three tradition clusters. Do not judge. Do not filter. Do not summarize away methodological detail — the Analyst needs to know whether a source uses VAR or ABM or Minsky, not just what it concludes.

Harvesters A, B, C run simultaneously. No Harvester waits for the others. All three return when their cards are complete.

---

## HARVESTER A — Academic & Quantitative

**Target sources:** nber.org, arxiv.org/list/econ, ssrn.com, jstor.org, jasss.org, aeaweb.org, ideas.repec.org, academic economics journals.

**Task:** Using WebSearch and WebFetch, find 2-3 sources from academic or quantitative economics traditions that address the research question. For each:

```
SOURCE CARD — Academic/Quantitative
=====================================
Title:
URL:
Tradition: academic
Key claims: [in detail — enough for a five-lens analyst to apply each framework to what this source says]
Data relied on: [what empirical ground this source stands on]
Methodology: [yes/no — and if yes: PE / CGE / DSGE / VAR / ABM / reduced-form / other]
What it does not address:
Corporate dependency: [any corporate funding or institutional capture risk?]
```

**Minimum:** 2 source cards. Include a third if it adds a genuinely distinct perspective.

---

## HARVESTER B — Official & Institutional

**Target sources:** imf.org, worldbank.org, oecd.org, bis.org, ecb.europa.eu, ec.europa.eu/eurostat, national central banks.

**Task:** Using WebSearch and WebFetch, find 2 institutional sources that address the research question. For each:

```
SOURCE CARD — Official/Institutional
======================================
Title:
URL:
Institution: [IMF / World Bank / OECD / BIS / ECB / Eurostat / other]
Tradition: institutional
Framework used: [GIMF / WEO / NAWM / GEP / other — if named]
Key indicators tracked or published:
Key claims:
What the official framing assumes:
What it does not address:
```

**Minimum:** 2 source cards.

---

## HARVESTER C — Heterodox & Complexity

**Target sources:** santafe.edu, inet.ox.ac.uk, postkeynesian.net, levyinstitute.org, stockholmresilience.org, degrowth.info, greattransition.org, pmc.ncbi.nlm.nih.gov (ecological economics).

**Task:** Using WebSearch and WebFetch, find 1-2 heterodox or complexity economics sources that address the research question. For each:

```
SOURCE CARD — Heterodox/Complexity
=====================================
Title:
URL:
School: [post-Keynesian / complexity/ABM / ecological economics / degrowth / other]
Tradition: heterodox OR complexity
Key critique of mainstream framing for this market:
Alternative variables or data this source includes:
What the market price hides according to this source:
What it does not address:
```

**Minimum:** 1 source card. 2 if available.

---

## SYNTHESIS — HARVEST-OUTPUT PACKAGE

Compile all source cards into the HARVEST-OUTPUT. Include:

```
HARVEST-OUTPUT CHECKLIST
=========================
[ ] Total non-corporate sources retrieved: ___
[ ] Tradition A (academic/quantitative): ___ sources
[ ] Tradition B (official/institutional): ___ sources
[ ] Tradition C (heterodox/complexity): ___ sources
[ ] All source URLs attempted (failures logged as HUMAN-NEEDED, not retried)
[ ] Local fallback checked: /Users/octaviesmacpro/workspace/ai-eu-studies/businesses
[ ] No single corporate source treated as ground truth
[ ] CSL items: any conflicts or contradictions across sources noted
[ ] Top 3 open questions the harvest did not answer
[ ] HUMAN-NEEDED blocks consolidated at end of output (if any)
```

**Gate 1 check (before passing to Analyst):** Total non-corporate sources ≥ 5 AND all three tradition clusters represented. If below threshold, note `[BELOW CONVERGENCE THRESHOLD — N sources retrieved, M pending human input]` and proceed with reduced confidence. Do not fabricate sources.

---

## WEB FETCH FAILURE PROTOCOL

When a harvester encounters a fetch failure — timeout, bot restriction, 403, CAPTCHA, or any non-response lasting more than ~30 seconds — it must **stop immediately and not retry**. The following steps apply:

### Step 1 — Emit a HUMAN-NEEDED flag

Output a block like this:

```
HUMAN-NEEDED — Harvester [A/B/C]
=====================================
URL:         [exact URL that failed]
Institution: [IMF / OECD / BIS / etc.]
Reason:      [timeout / bot restriction / 403 / other]
Data needed: [describe exactly what to look for on that page or document]
Source card fields to fill:
  - Title:
  - Framework used:
  - Key indicators tracked or published:
  - Key claims:
  - What the official framing assumes:
  - What it does not address:

HUMAN INPUT GUIDE
------------------
Retrieve this source manually using one of these formats, in priority order:

  1. Plain text paste (best)
     Copy the relevant section from the page into the conversation.
     Include: source name, institution, year, and any model or framework named.
     300-500 words of pasted text is sufficient for the Analyst.

  2. Pre-filled source card
     If you have already skimmed the source, fill the fields above yourself and paste them.
     This is the fastest path to Phase 2.

  3. PDF saved locally
     Save the file to: /Users/octaviesmacpro/workspace/ai-eu-studies/businesses
     Then specify: filename + page range (e.g. "pages 4-12 are the executive summary").
     Page range is required for reports over 20 pages — full PDF will timeout.
     ALWAYS use pdfplumber to extract text — never pypdf. pypdf produces garbled symbols
     on EU institutional PDFs. pdfplumber is installed system-wide.

     Extraction template:
       import pdfplumber
       with pdfplumber.open(filepath) as pdf:
           for i, page in enumerate(pdf.pages[start:end], start=start+1):
               t = page.extract_text()
               if t:
                   print(f"PAGE {i}\n{t}")

  4. Key stats with context
     Numbers without context are not usable. Always include:
     source name, institution, year, model or methodology named, what the number measures.
     Example: "OECD Economic Outlook 2024, GIMF model, EU-27 GDP growth 2.1%,
     assuming no further rate hikes"

  Avoid: screenshots of tables, raw CSV without labels, the same URL again.

  The harvest continues without waiting for this input.
```

### Step 2 — Check local files

Before marking the source as missing, check for any pre-downloaded material at:

```
/Users/octaviesmacpro/workspace/ai-eu-studies/businesses
```

If relevant files exist there (PDFs, notes, exports), read them and use them to fill the source card. Note the file path in the card instead of the URL.

### Step 3 — Continue the harvest

Do not wait for the human to respond. Continue retrieving other sources. If enough sources were already retrieved by the other harvesters (A and C), Gate 1 may still pass.

At the end of HARVEST-OUTPUT, add a section:

```
UNRESOLVED SOURCES — AWAITING HUMAN INPUT
==========================================
[List each HUMAN-NEEDED block here, consolidated]
Human can paste retrieved content directly after this section before Phase 2 begins.
```

### Step 4 — Gate 1 with partial harvest

If the total non-corporate sources fall below 5 due to fetch failures, note:
`[BELOW CONVERGENCE THRESHOLD — N sources retrieved, M sources pending human input]`

Phase 2 may proceed with reduced confidence, or the human may choose to provide the missing data first. This is a human decision, not a harvester decision.

---

## WHAT THIS PHASE DOES NOT DO

- Does not analyze the sources — that is Phase 2
- Does not judge which source is most authoritative — that is Phase 4
- Does not skip corporate sources if encountered — retrieves them as comparison data, never as ground truth
- Does not stop at exactly the minimum — more sources from underrepresented clusters strengthen the analysis
