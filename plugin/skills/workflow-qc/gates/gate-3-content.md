# GATE 3 — FORBIDDEN CONTENT SCAN
MODE: lightweight (layers 1-2) | full (all 3 layers)
TOKENS: ~550

## INPUT
Required: all step and module file contents as flat text

## TASK
Detect PII, celebrity names, legal-risk content, and external product dependencies.
Run layers in order. Stop at first CRITICAL finding and report before continuing.

## LAYER 1 — PATTERN SCAN (lightweight + full)
Scan all content for these patterns:

PII PATTERNS — flag any match:
  Email address:      [a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
  French phone:       0[1-9](\s?\d{2}){4}
  IBAN:               [A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}
  French SSN:         [12]\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{3}\s?\d{3}\s?\d{2}
Output per match: CRITICAL:PII:[pattern type]:[matched value]:[filename]

LEGAL RISK PHRASES — flag any sentence containing these combined with a proper noun:
  "is guilty"
  "committed fraud"
  "is responsible for"
  "defrauded"
  "is accused of"
  "is liable for"
Output per match: CRITICAL:legal-risk:[phrase]:[context — 15 words]:[filename]

EXTERNAL PRODUCT DEPENDENCY IN INSTRUCTIONS — flag if used as a required tool:
  "open claude desktop"   "use chatgpt"   "in gemini"   "via copilot"
  "paste into notion"     "export to sheets"
These create external dependencies the buyer may not have.
Output per match: WARN:product-dependency:[phrase]:[filename]

## LAYER 2 — NAMED ENTITY CHECK (lightweight + full)
Scan instruction blocks (not template sections or example data) for:
  - A full person name pattern (First + Last, not a placeholder like [Your Name])
  - A specific company name used as the workflow's primary subject
  - A country-specific government institution used as a live data source without a date

For each match: REVIEW:[entity type]:[entity]:[context — 10 words around it]:[filename]
REVIEW items require human judgment. They do not auto-block.
Present all REVIEW items to the user before closing Gate 3.

## LAYER 3 — SEMANTIC SCAN (full mode only)
Ask the model:

PROMPT:
You are reviewing workflow instruction content for distribution safety.
Read the content below and answer these four questions:
1. Does it contain any real person name (celebrity, executive, public figure)?
2. Does it contain any internal product or platform name used as a workflow dependency?
3. Does it contain any personal identifying data (email, phone, address, ID number)?
4. Does it instruct the user to share personal data with the workflow or an external system?
Answer format — four lines only:
Q1: CLEAN | FLAG:[reason]
Q2: CLEAN | FLAG:[reason]
Q3: CLEAN | FLAG:[reason]
Q4: CLEAN | FLAG:[reason]
[INSERT WORKFLOW CONTENT HERE]

Collect all four answers. Any FLAG = add to gate findings.

## RESULT LOGIC
CLEAN:  No CRITICAL or FLAG findings. REVIEW items documented and approved by human.
FLAG:   Any CRITICAL or unresolved FLAG item = gate fails. Fix before distribution.

## OUTPUT FORMAT
GATE 3 — FORBIDDEN CONTENT SCAN
Result:                   CLEAN | FLAG:[count]
Layer 1 PII:              CLEAN | [list of CRITICAL findings]
Layer 1 Legal risk:       CLEAN | [list of CRITICAL findings]
Layer 1 Product deps:     CLEAN | [list of WARN findings]
Layer 2 Named entities:   CLEAN | [list of REVIEW items]
Layer 3 Semantic (full):  CLEAN | [list of FLAG answers] | not run
Human review needed:      YES:[list of REVIEW items] | NO
Action required:          NONE | [numbered list of items to fix]
