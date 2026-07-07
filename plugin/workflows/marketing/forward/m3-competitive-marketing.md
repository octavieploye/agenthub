# MODULE: forward/m3-competitive-marketing
TYPE:   Forward Layer — load after M2 is complete
OWNER:  competitive-intel-marketing (lead: lead-marketing)
TOKENS: ~700

## PURPOSE
Audit competitor marketing channels, messaging, ad creative, content strategy, and
SEO/paid approach. Identify what is working for competitors, what is not, and where
marketing gaps exist to exploit. This is a marketing audit — not a product audit.
The product competitive analysis was done by the business team (f4/r2). This layer
is about how competitors show up in the market and what that means for our approach.

## INPUTS REQUIRED
  Competitive Gap Matrix from business team (player profiles, gap matrix, customer voice)
  M1 Persona Map (to map competitor targeting against our target buyer)
  M2 Readiness (timing flag, friction profile)
  If player profiles missing: DRL item before proceeding

## STEP 1 — COMPETITOR MARKETING CHANNEL AUDIT

For each competitor identified in the business team's gap matrix (3-5 players):

  Player: [name]
  Source: [business team gap matrix — player profile]

  Organic channels:
    Website:    [style: content-heavy / product-heavy / community / unknown]
    Blog/SEO:   [YES/NO — topic clusters if detectable via SEMrush / Ahrefs estimates]
    YouTube:    [YES/NO — content type: tutorial / case study / thought leadership]
    LinkedIn:   [YES/NO — post frequency, content type]
    Instagram:  [YES/NO — visual approach]
    Podcast:    [YES/NO — own / sponsored]
    Community:  [YES/NO — Slack group, Discord, forum]

  Paid channels (source: Meta Ad Library, LinkedIn Ad Library, SpyFu):
    Facebook/Instagram ads: [YES/NO — count of active creatives if visible]
    LinkedIn ads:           [YES/NO — format: single image / video / lead gen]
    Google ads:             [YES/NO — keywords if available via SpyFu]
    YouTube ads:            [YES/NO]

  Channel priority score (inferred):
    Primary channel:   [most active — reason]
    Secondary channel: [second most active]
    Absent:            [channels they are NOT on — potential white space]

## STEP 2 — COMPETITOR MESSAGING AUDIT

What problem do they claim to solve? What language do they use?
Source: homepage H1/H2, ad copy (Meta Ad Library), landing pages, G2/Capterra descriptions.

  Player: [name]
  Core claim: [their H1 — exact text]
  Proof element: [what they use as proof: numbers, logos, reviews, certifications]
  Tone: [formal / conversational / technical / aspirational / fear-based]
  Key words they own: [3-5 terms they repeat]
  What they avoid saying: [gaps in their messaging — often reveals vulnerability]

  Source: [Meta Ad Library URL or landing page date]
  CS: [score — Tier 2 if verified copy, Tier 3 if inferred from reviews]

## STEP 3 — CUSTOMER VOICE MINING

Use exact customer review text from the business team's gap matrix (customer voice field).
Plus: G2, Capterra, Trustpilot, App Store, Reddit mentions — always exact quotes.

  What customers praise (about competitors):
    "[exact quote]" — Source: [G2/Capterra/etc], CS: [score]
    "[exact quote]" — Source: [source], CS: [score]

  What customers complain about (about competitors):
    "[exact quote]" — Source: [source], CS: [score]
    "[exact quote]" — Source: [source], CS: [score]

  Patterns in praise → what competitors are doing right (learn from, or compete on)
  Patterns in complaints → marketing gap = our potential position

  Rule: never paraphrase customer quotes. Use exact text or do not cite.

## STEP 4 — SEO AND CONTENT GAP MAP

Topics competitors own vs. topics available to us.
Source: SEMrush organic keyword estimates, Ahrefs if available, Google autocomplete.

  Topics competitors rank for (high priority):
    [keyword] — [competitor owning it] — [estimated monthly volume: high/med/low]

  Topics with search volume but no strong competitor:
    [keyword] — [volume: h/m/l] — [why no competitor owns it: new topic / niche / neglected]

  Content format competitors use:
    Long-form articles: [YES/NO — average word count if known]
    Comparison pages:   [YES/NO — "[competitor] vs [competitor]" type]
    Case studies:       [YES/NO — industry-specific?]
    Tools/calculators:  [YES/NO]

## STEP 5 — COMPETITOR MARKETING GAP MATRIX

Cross-reference competitor channel + message audit with M1 persona platform map.

  Gap 1: [channel or message type]
    Competitors on this channel:   [list — none if gap]
    Our persona active here:       [YES / NO — from M1 Step 5]
    Opportunity level:             HIGH / MEDIUM / LOW
    Why competitors avoid it:      [reason if detectable]

  Gap 2: [format or content type]
    Same structure.

  Gap 3: [message or positioning angle]
    Competitors claiming this:     [none / partial]
    Buyer evidence for demand:     [quote or CS signal]
    Opportunity level:             HIGH / MEDIUM / LOW

  Rule: only flag gaps where buyer evidence exists. A channel no competitor uses
  is not a gap unless the persona actually uses it (from M1 Step 5).

## STEP 6 — AD CREATIVE ANALYSIS

Source: Meta Ad Library, LinkedIn Ad Library — public data only.

  Visual patterns competitors use:
    Human faces: [YES/NO — majority of creatives?]
    Product screenshot: [YES/NO]
    Text-heavy vs. visual-heavy: [ratio if detectable]
    Video vs. static: [ratio]
    Color palette trend: [observation]

  Copy patterns:
    Headline formula: [pain point / outcome / curiosity / social proof]
    CTA used most: [Free trial / Book demo / Learn more / Get started]

  What is absent in competitor ads that our persona responds to:
    [gap — supported by M1 buyer language or M3 Step 3 complaint patterns]

## M3 OUTPUT FORMAT

  COMPETITIVE MARKETING AUDIT — M3 — [N] players

  For each player:
    [Player name]: Primary channel [X], core claim "[Y]", proof: [Z]

  Marketing gaps (prioritized):
    GAP-001: [description] — opportunity: HIGH/MEDIUM/LOW — channel: [X]
    GAP-002: [description]
    GAP-003: [description]

  Customer voice summary:
    What they praise:    [1-2 patterns]
    What they complain:  [1-2 patterns — these are our positioning opportunities]

  SEO white space: [top 2 topic gaps]

  Competitive marketing position recommendation:
    We should own: [message/channel/format] — because: [evidence]
    We should avoid: [channel/message that is saturated or mismatched to persona]

  DRL items raised this layer: [count]
  CSL items raised this layer: [count]

## HANDOFF TO NEXT LAYERS
  → M4 (channel): competitor channel gaps + persona match
  → M5 (message): competitor claims to differentiate from, customer complaint language
  → M6 (campaign): ad creative patterns, content gap topics for calendar
