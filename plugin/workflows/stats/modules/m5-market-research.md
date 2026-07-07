# MODULE M5 — Market Research and Sector Statistics

Agent: market-stats-researcher
Purpose: Source and validate quantitative market data across industries, geographies, and time horizons.

---

## When to Load

Load M5 when:
  - Estimating market size (TAM, SAM, SOM)
  - Researching sector growth rates, adoption curves, competitive share
  - Sourcing macroeconomic indicators relevant to a market context
  - Building a quantitative foundation for market opportunity or risk analysis

---

## Market Sizing Framework

### TAM (Total Addressable Market)
  Top-down: Start from national/global GDP or sector output statistics.
    Source: World Bank national accounts, OECD sector statistics, Eurostat, IMF WEO.
  Bottom-up: Estimate from unit economics × addressable population.
    Source: census/demographic data (national statistics offices) + survey data.
  Report both where possible, flag if they diverge > 20%.

### SAM (Serviceable Addressable Market)
  Apply geographic, regulatory, and structural constraints to TAM.
  Every filter must cite its source.

### SOM (Serviceable Obtainable Market)
  This is forward-looking and company-specific.
  The stats team reports: typical market share acquisition curves for comparable entrants.
  It does NOT estimate SOM for the user's business.

### Output Format

  "MARKET SIZE ESTIMATE — [market name, geography, year]
   TAM: [value] ± [range]  (method: [top-down/bottom-up], T[x] CS: [n])
   SAM: [value] ± [range]  (filters applied: [list])
   CAGR (historical): [X]% ± [margin]  (period: [start–end], T[x] CS: [n])
   CAGR (projected):  [X]% [CI: low–high%] (source, T[x] CS: [n])
   Data conflict flags: [any CSL items]"

---

## Growth Rate Sourcing

Hierarchy for growth rate data:
  1. National accounts growth (T1): most reliable for macro sectors
  2. Industry association statistics (T2/T3): sector-specific but methodology varies
  3. Established market research firms (T4): useful but require gate checks

Always distinguish:
  - Historical CAGR (observed, T1–T2 preferred) vs. Projected CAGR (forward-looking, T3–T4)
  - Nominal growth vs. real growth (inflation-adjusted)
  - Volume growth vs. value growth (price effects)

---

## Competitive Landscape Statistics

Report at sector level only — not analysis of specific named competitors.
  - Market concentration: HHI (Herfindahl-Hirschman Index) if available
  - Top-N player share ranges: "Top 5 players hold [X–Y]% of market" (not individual shares)
  - Entry/exit rates: new firm formation and closure rates by sector
  - Sources: Eurostat enterprise demography, national competition authority filings,
    industry association reports, BIS sector studies

---

## Macro Indicators Relevant to Market Context

When requested, source and present:
  | Indicator | Primary Source |
  |---|---|
  | GDP growth | World Bank / IMF WEO (T1) |
  | Inflation (CPI/PPI) | National stats offices, ECB, Fed (T1) |
  | Consumer confidence | EC Consumer Survey, Conference Board (T2/T3) |
  | Business investment | OECD, Eurostat national accounts (T1) |
  | Trade volumes | WTO, UNCTAD (T1) |
  | Employment / unemployment | ILO, national stats offices (T1) |
  | Interest rates / yield curves | Central banks (T1) |
  | Currency trends | BIS, ECB, Fed (T1) |
  | Commodity prices | World Bank commodity price data, IEA (T1) |

---

## Adoption Curve Analysis

For technology or product adoption scenarios:
  Use Rogers' diffusion framework as a reference lens (T2 academic, replicated):
    Innovators: ~2.5% | Early adopters: ~13.5% | Early majority: ~34%
    Late majority: ~34% | Laggards: ~16%

  S-curve inflection: adoption typically accelerates when penetration crosses 10–15% of addressable market.
  Source empirical S-curve data from comparable technologies where available (T1/T2 preferred).
  Flag where the user's sector follows atypical adoption patterns.

---

## Geographic Scope

Always define the geographic scope of every market estimate:
  - Global / Regional (EU, APAC, Americas) / National / Sub-national
  - Regulatory perimeter: some markets are geography-fragmented by regulation
  - Currency: state all financial figures in the same currency with base year noted
  - PPP adjustment: for cross-country comparisons, offer both nominal and PPP-adjusted figures

---

## Source Quality Gates for Market Data

Before citing any market size or growth figure, apply these gates:
  Gate 1 — Is the methodology disclosed? (sample, period, geography, definitions)
  Gate 2 — Is the source a named, established organization?
  Gate 3 — Is the figure corroborated by at least one independent source?
  Gate 4 — Is it within the decay window? (12 months for T4, 5 years for T1)
  Gate 5 — Does it distinguish nominal vs. real, historical vs. projected?

Fail on Gates 1–2: Do not cite. Explain gap and recommend alternative.
Fail on Gates 3–5: Cite with explicit caveat and reduced CS.
