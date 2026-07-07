# MODULE M4 — Risk Assessment and Failure Analysis

Agent: risk-modeler
Purpose: Quantify the probability and impact of failure modes, risks, and adverse scenarios.

---

## When to Load

Load M4 when:
  - Assessing risk in a sector, market, business model type, or macro scenario
  - Identifying and quantifying failure modes in a process, system, or strategy
  - Producing a probability-weighted risk matrix for decision support

---

## FMEA — Failure Mode and Effects Analysis

FMEA is a systematic method for identifying failure modes before they occur.
This team applies it to: business model risks, market entry scenarios, financial structures,
operational process risk, and systemic (macro) risks.

### FMEA Process

Step 1 — Identify failure modes
  List every way the system/scenario could fail.
  Source failure modes from: industry incident reports, academic case studies, regulatory filings,
  actuarial tables, insurance loss data (ISO, Lloyd's of London, Swiss Re).

Step 2 — Score each failure mode on three dimensions (1–10 scale each):
  S — Severity:     How severe is the impact if this failure occurs?
                    1 = negligible, 10 = catastrophic / irreversible
  O — Occurrence:   How likely is this failure to occur?
                    1 = remote (< 1%), 10 = almost certain (> 50%)
  D — Detectability: How easily can this failure be detected before impact?
                    1 = easily detected and corrected, 10 = undetectable until after impact

Step 3 — Calculate Risk Priority Number (RPN)
  RPN = S × O × D  (range: 1–1,000)
  Priority thresholds:
    RPN ≥ 500:   CRITICAL — flag immediately
    RPN 200–499: HIGH — requires attention
    RPN 50–199:  MEDIUM — monitor
    RPN < 50:    LOW — document only

Step 4 — Assign source and CS to each score
  Each S, O, D score must reference a source or be labeled "ESTIMATED."
  Format: "O = 7 (based on [sector] historical incident rate: [X]% per year, [source] T[n] CS: [n])"

### FMEA Output Format

  "FMEA TABLE — [system/scenario]
   Failure Mode | Effect | S | O | D | RPN | Source | CS | Priority
   [mode]       | [desc] | [n] | [n] | [n] | [n] | [src] | [n] | [CRITICAL/HIGH/MEDIUM/LOW]"

---

## Risk Matrix

For a visual/structured risk assessment:
  Plot failure modes on a 5×5 matrix:
    X-axis: Likelihood (1 = Rare, 5 = Almost Certain)
    Y-axis: Impact (1 = Negligible, 5 = Catastrophic)

  Risk zones:
    Red   (score 15–25): Extreme risk
    Amber (score 8–14):  High risk
    Yellow (score 4–7):  Medium risk
    Green  (score 1–3):  Low risk

---

## Probabilistic Scenario Risk

For macro or financial risk scenarios, use probability-weighted expected impact:

  Expected Loss = P(scenario) × Impact(scenario)

  Report three scenarios minimum:
    Baseline:     P = [X]%  |  Impact = [Y]  |  Expected = P × Y
    Adverse:      P = [X]%  |  Impact = [Y]  |  Expected = P × Y
    Stress/Tail:  P = [X]%  |  Impact = [Y]  |  Expected = P × Y
    Total EL = sum of all scenario expected losses

  Source probabilities from: IMF World Economic Outlook scenarios, BIS annual reports,
  central bank stress tests (ECB, Fed, PRA), reinsurance catastrophe models (Swiss Re, Munich Re).

---

## Failure Rate Data Sources (by domain)

  Financial / Credit:     Basel III LGD/PD tables, S&P/Moody's default rate studies
  Insurance / Actuarial:  SOA mortality tables, Lloyd's market loss data, Swiss Re sigma series
  Business failure:       World Bank doing business data, Eurostat enterprise demography
  Operational risk:       ISO 31000 framework, COSO ERM, ORX (Operational Risk Exchange)
  Systemic / Macro:       BIS quarterly review, IMF FSB, ECB financial stability review
  Technology:             NIST, CIS benchmarks, Verizon DBIR (cyber risk)

---

## Output Standards

Every risk assessment must include:
  1. Failure mode inventory (minimum 5 modes for any material risk scenario)
  2. FMEA table with scored S, O, D, and RPN
  3. Top 3 risks by RPN, with sources and CS scores
  4. Explicit uncertainty note on each score: "O score based on [n-year] historical data / estimated"
  5. Correlation risk note: "In stress scenarios, risks [A] and [B] are likely correlated — independent RPN scores understate combined risk."

NEVER prescribe risk mitigation actions — identify and quantify only.
State: "Mitigation strategies are outside this team's scope. The above quantifies the risk profile for user decision."
