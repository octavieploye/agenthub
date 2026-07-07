Modular System Brainstorm                                                                                                                               
                                                                                                                                                        
  LLM-Lean Modules + Dual Traversal (Eagle→Focus and Focus→Eagle)
                                                                                                                                                          
  ---
  The Core Insight: Two Entry Points, Same Layers, Opposite Direction                                                                                     
                                                                                                                                                          
  FORWARD MODE  (Eagle → Focus)
  Used when:    scanning for opportunity, don't know where to play yet                                                                                    
  Entry:        macro signal → narrow to niche                                                                                                            
   
  Layer 1 → 1.5 → 2 → 3 → 4 → 5 → Synthesis                                                                                                               
                                                                                                                                                        
                                                                                                                                                          
  REVERSE MODE  (Focus → Eagle)                                                                                                                         
  Used when:    you know your business/niche, want to understand forces around it
  Entry:        your specific business → expand to macro context                                                                                          
   
  Business/Niche → R1 → R2 → R3 → R4 → R5 → Synthesis                                                                                                     
                                                                                                                                                        
                                                                                                                                                          
  LOOP MODE     (both directions, validated by synthesis)                                                                                               
  Used when:    forward and reverse are both run, synthesis finds where they agree or conflict                                                            
  Value:        disagreements between directions = highest-value CSL items                                                                                
                agreements between directions = highest-confidence findings                                                                               
                                                                                                                                                          
  ---                                                                                                                                                     
  Why Low-Context LLM Design Matters                                                                                                                      
                                                                                                                                                        
  Most modules as written are thousands of tokens. A low-context LLM (8K–32K window) that tries to load the entire methodology at once will either
  truncate it or hallucinate across the gaps.                                                                                                             
   
  The fix: Each module is a self-contained unit with an explicit interface. The LLM loads only what it needs for the current step. It does not need to    
  know the full methodology — it only needs to know:                                                                                                    
  - What its input is                                                                                                                                     
  - What it produces                                                                                                                                    
  - What conflicts to surface
  - What to hand off and where                                                                                                                            
   
  A manifest file tells the LLM what modules exist and which to load next.                                                                                
                                                                                                                                                        
  ---                                                                                                                                                     
  Module Standard Format                                                                                                                                
                                                                                                                                                          
  Every module follows this exact structure. No exceptions. The format is the contract.
                                                                                                                                                          
  MODULE: [identifier]                                                                                                                                  
  LAYER:  [F1 / F1.5 / F2 / F3 / F4 / F5 / R1 / R2 / R3 / R4 / R5 / SYN]                                                                                  
  MODE:   [FORWARD / REVERSE / BOTH]                                                                                                                      
  TOKENS: [estimated token count when loaded — keep under 800]
  ---                                                                                                                                                     
  LOAD FIRST                                                                                                                                              
    Always: core/non-assumption-rule                                                                                                                      
    Always: core/csl-protocol                                                                                                                             
    This module: [filename]                                                                                                                               
   
  SKIP IF                                                                                                                                                 
    [condition under which this module is not needed]                                                                                                   
                                                                                                                                                          
  INPUT
    Required: [what must exist before this module runs]                                                                                                   
    Optional: [what enriches output if available]                                                                                                         
   
  GEO TRACKS ACTIVE                                                                                                                                       
    [list which geo tracks are active — only those are processed]                                                                                       
                                                                                                                                                          
  PROCESS
    Step 1: [action]                                                                                                                                      
    Step 2: [action]                                                                                                                                    
    ...                                                                                                                                                   
    Max steps: 7
                                                                                                                                                          
  OUTPUT                                                                                                                                                
    Produces: [name of deliverable]
    Format:   [structure]
    Max size: [token estimate]                                                                                                                            
   
  CONFLICTS                                                                                                                                               
    Surface CSL item when: [condition]                                                                                                                  
                                                                                                                                                          
  HANDOFF
    Forward feeds:  [next module]                                                                                                                         
    Reverse feeds:  [next module]                                                                                                                       
    Gate:           [what must be true before handoff is valid]                                                                                           
   
  ---                                                                                                                                                     
  The Manifest — What the LLM Loads First (Always)                                                                                                      
                                                                                                                                                          
  The manifest is the only thing that must always be in context. It is kept under 300 tokens.
                                                                                                                                                          
  MANIFEST — Business Research Methodology v1                                                                                                           
  Modes: FORWARD | REVERSE | LOOP                                                                                                                         
  ---                                                                                                                                                   
  CORE (always load before any module)
    core/non-assumption-rule    The one rule that governs everything                                                                                      
    core/csl-protocol           How to surface conflicts to user                                                                                          
    core/confidence-scoring     How to score signal confidence                                                                                            
    core/signal-tiers           Source trust hierarchy                                                                                                    
    core/time-to-action         How to tag signal urgency                                                                                                 
                                                                                                                                                          
  FORWARD MODULES (Eagle → Focus)                                                                                                                         
    forward/f1-eagle             Macro forces, structural shifts                                                                                          
    forward/f1.5-lateral         Adjacent market scan (optional)                                                                                          
    forward/f2-sector            Industry structure, value chain                                                                                          
    forward/f3-market            Segment map, TAM, white space                                                                                            
    forward/f4-competitive       Player profiles, gap matrix                                                                                              
    forward/f5-niche-icp         Buyer psychology, ICP, language                                                                                          
                                                                                                                                                          
  REVERSE MODULES (Focus → Eagle)                                                                                                                         
    reverse/r1-niche-icp         Start here: what do we know about this business/niche?                                                                   
    reverse/r2-competitive       Who are the players around this niche?                                                                                   
    reverse/r3-market            What market contains this niche?                                                                                         
    reverse/r4-sector            What sector contains this market?                                                                                        
    reverse/r5-eagle             What macro forces shape this sector?                                                                                     
                                                                                                                                                          
  GEO MODULES (load only activated tracks)
    geo/fr    geo/eu    geo/us                                                                                                                            
    geo/cn    geo/asia  geo/africa    geo/oceania                                                                                                         
                                                                                                                                                          
  SYNTHESIS                                                                                                                                               
    synthesis/l6-synthesis       Cross-layer synthesis, integrity check, executive output                                                                 
                                                                                                                                                          
  OPERATIONS
    ops/watchlist                Near-signal parking and review                                                                                           
    ops/source-audit             Quarterly source maintenance                                                                                             
    ops/signal-registry          Active signal log with freshness tags
  ---                                                                                                                                                     
  LOAD ORDER                                                                                                                                            
    Step 1: Load core/ modules (all 5)                                                                                                                    
    Step 2: Load selected mode modules one at a time                                                                                                      
    Step 3: Load geo/ modules for active tracks only                                                                                                      
    Step 4: Load synthesis/ when all layers complete                                                                                                      
                                                                                                                                                          
  ---                                                                                                                                                   
  Forward Modules (Eagle → Focus)                                                                                                                         
                                                                                                                                                          
  forward/f1-eagle
                                                                                                                                                          
  MODULE: f1-eagle                                                                                                                                      
  LAYER:  F1 — Eagle View
  MODE:   FORWARD                                                                                                                                         
  TOKENS: ~600
  ---                                                                                                                                                     
  LOAD FIRST: core/non-assumption-rule, core/csl-protocol                                                                                               
                                                                                                                                                          
  INPUT
    Required: project brief (1–3 sentences describing the research goal)                                                                                  
    Required: active geo-tracks (list)                                                                                                                    
    Optional: known macro themes to investigate                                                                                                           
                                                                                                                                                          
  SKIP IF: project brief describes a known niche → use REVERSE mode instead                                                                               
                                                                                                                                                        
  PROCESS                                                                                                                                                 
    1. Scan macro forces per active geo-track                                                                                                           
       (capital flows, regulatory shifts, tech crossing deployment threshold,                                                                             
        demographic change, geopolitical realignment)                                                                                                     
    2. For each force: assign confidence score + TTA tag                                                                                                  
    3. Check each geo-track for the same force — note divergence                                                                                          
    4. Run integrity check: if all forces agree across all geos, flag echo chamber                                                                        
    5. Write Implications Block for top 3 forces                                                                                                          
    6. List CSL items (conflicts between geo-tracks or low-confidence forces)                                                                             
    7. Produce geo-delta summary                                                                                                                          
                                                                                                                                                          
  OUTPUT                                                                                                                                                  
    Produces: Macro Signal Map                                                                                                                            
    Format:                                                                                                                                             
      Force [ID]: [name]
      Direction: creating / destroying / transforming                                                                                                     
      Geos affected: [list]                                                                                                                               
      Confidence: [score]                                                                                                                                 
      TTA: [Immediate / Watch / Horizon / Structural]                                                                                                     
      So what: [one-line implication]                                                                                                                     
    Max 8 forces. No force listed without confidence score.                                                                                               
                                                                                                                                                          
  CONFLICTS                                                                                                                                               
    Surface CSL item when:                                                                                                                                
    - Two geo-tracks report opposite direction for same force                                                                                           
    - Confidence score < 40 on any force used as primary finding                                                                                          
    - Zero contradictions found across all sources (echo chamber)                                                                                         
                                                                                                                                                          
  HANDOFF                                                                                                                                                 
    Forward feeds: f1.5-lateral (optional) → f2-sector                                                                                                    
    Gate: at least 3 forces identified with CS ≥ 50                                                                                                       
          all CSL items reviewed by user before handoff                                                                                                   
                                                                                                                                                          
  ---                                                                                                                                                     
  forward/f1.5-lateral                                                                                                                                    
                                                                                                                                                        
  MODULE: f1.5-lateral
  LAYER:  F1.5 — Adjacent Market Scan
  MODE:   FORWARD
  TOKENS: ~400                                                                                                                                            
  ---
  SKIP IF: project is defensive (protecting existing position, not scanning for entry)                                                                    
                                                                                                                                                          
  INPUT
    Required: Macro Signal Map from f1-eagle                                                                                                              
    Required: Primary sector hypothesis (from f1 or user)                                                                                                 
                                                                                                                                                          
  PROCESS                                                                                                                                                 
    1. Identify 3 adjacent categories sharing same customer OR same distribution                                                                          
    2. Identify 2 technologies deployed elsewhere that could migrate to this sector                                                                       
    3. Check YC batches, ProductHunt, ArXiv for adjacent-origin companies                                                                                 
    4. Score each adjacent threat: origin / migration vector / timeline / risk level                                                                      
                                                                                                                                                          
  OUTPUT                                                                                                                                                  
    Produces: Adjacent Threat Map                                                                                                                         
    Format:                                                                                                                                             
      Threat [ID]: [adjacent category or company]
      Origin: [where it comes from]
      Migration vector: [how it enters this sector]                                                                                                       
      Timeline: [estimated]
      Risk: Low / Medium / High                                                                                                                           
    Max 5 threats.                                                                                                                                        
   
  HANDOFF                                                                                                                                                 
    Forward feeds: f2-sector                                                                                                                            
    Gate: at least 1 adjacent threat identified
          or explicit note that no credible adjacent threats found (with reasoning)                                                                       
                                                                                                                                                          
  ---                                                                                                                                                     
  forward/f2-sector through forward/f5-niche-icp                                                                                                          
                                                                                                                                                        
  Each follows identical module structure. Same format, different content. Loading one does not require loading others.
                                                                                                                                                          
  ---
  Reverse Modules (Focus → Eagle)                                                                                                                         
                                                                                                                                                        
  reverse/r1-niche-icp — Entry Point for Reverse Mode
                                                                                                                                                          
  MODULE: r1-niche-icp
  LAYER:  R1 — Niche / Business Entry                                                                                                                     
  MODE:   REVERSE                                                                                                                                         
  TOKENS: ~600
  ---                                                                                                                                                     
  LOAD FIRST: core/non-assumption-rule, core/csl-protocol                                                                                               

  INPUT
    Required: business description (1–3 sentences)
              OR industry name                                                                                                                            
              OR vertical/niche name
    Required: active geo-tracks                                                                                                                           
    Optional: known competitors, known buyer types, known pain points                                                                                   
                                                                                                                                                          
  PROCESS                                                                                                                                               
    1. Map what is already known about this niche from the input                                                                                          
       — do NOT extrapolate beyond what is stated                                                                                                         
       — for every gap: note it, do not fill it                                                                                                           
    2. Identify the ICP hypothesis from input language                                                                                                    
    3. Identify known buyer pain points from input                                                                                                        
    4. List what is NOT known (knowledge gap map)                                                                                                         
    5. Flag any assumption in the input as a CSL candidate                                                                                                
    6. Define the "focus question" — the one thing this reverse research must answer                                                                      
                                                                                                                                                          
  OUTPUT                                                                                                                                                
    Produces: Niche Entry Brief                                                                                                                           
    Format:                                                                                                                                             
      Business/niche:    [as stated by user — not reinterpreted]
      Known ICP:         [from user input only]                                                                                                           
      Known pain points: [from user input only]                                                                                                           
      Knowledge gaps:    [list of what we don't know yet]                                                                                                 
      Focus question:    [the single question this research answers]                                                                                      
      Assumptions found: [list — each becomes a CSL item]                                                                                                 
                                                                                                                                                          
  CONFLICTS                                                                                                                                               
    Surface CSL item when:                                                                                                                                
    - User input contains an assumption stated as fact                                                                                                  
    - Two elements of the user description contradict each other
    - ICP cannot be inferred without extrapolation                                                                                                        
                                                                                                                                                          
  HANDOFF                                                                                                                                                 
    Reverse feeds: r2-competitive                                                                                                                         
    Gate: focus question defined                                                                                                                        
          knowledge gap map complete
          all input assumptions surfaced as CSL items                                                                                                     
   
  ---                                                                                                                                                     
  reverse/r2-competitive                                                                                                                                
                                                                                                                                                          
  MODULE: r2-competitive
  LAYER:  R2 — Competitive / Company (Reverse)                                                                                                            
  MODE:   REVERSE                                                                                                                                       
  TOKENS: ~600
  ---
  INPUT
    Required: Niche Entry Brief from r1-niche-icp
    Required: active geo-tracks                                                                                                                           
   
  PROCESS                                                                                                                                                 
    1. Identify direct competitors in this niche (per active geo-tracks)                                                                                
    2. Identify adjacent competitors entering from outside                                                                                                
    3. Profile top 3–5 players: positioning, GTM, strengths, vulnerabilities                                                                              
    4. Run job posting archaeology on top 3 (what did they hire 12–18 months ago?)                                                                        
    5. Check Wayback Machine snapshots for positioning shifts                                                                                             
    6. Write Implications Block: what do these players reveal about what the market values?                                                               
    7. Flag: which knowledge gaps from r1 does this answer? Which remain?                                                                                 
                                                                                                                                                          
  OUTPUT                                                                                                                                                  
    Produces: Competitive Snapshot                                                                                                                        
    Format:                                                                                                                                             
      Player [ID]:
        Positioning: [one sentence]
        GTM motion: [how they acquire customers]                                                                                                          
        Strength:   [one thing they do well]
        Weakness:   [one exploitable gap]                                                                                                                 
        Geo variant: [if tracks diverge]                                                                                                                
      Gap matrix: [where no player is winning]                                                                                                            
      Knowledge gaps resolved: [list]                                                                                                                     
      Knowledge gaps remaining: [list]                                                                                                                    
                                                                                                                                                          
  HANDOFF                                                                                                                                               
    Reverse feeds: r3-market
    Gate: at least 2 players profiled with CS ≥ 50
          gap matrix has at least 1 entry                                                                                                                 
                                                                                                                                                          
  ---                                                                                                                                                     
  reverse/r3-market, reverse/r4-sector, reverse/r5-eagle                                                                                                  
                                                                                                                                                        
  MODULE: r3-market
  LAYER:  R3 — Market / Segment (Reverse)
  PROCESS: Given competitive snapshot → size the market these players compete in                                                                          
           → identify which segment the user's niche sits in                                                                                              
           → check if TAM assumption implied in r1 holds                                                                                                  
  HANDOFF: Feeds r4-sector                                                                                                                                
                                                                                                                                                          
  MODULE: r4-sector                                                                                                                                       
  LAYER:  R4 — Industry / Sector (Reverse)                                                                                                              
  PROCESS: Given market map → identify the sector                                                                                                         
           → map value chain, power holders, margin dynamics
           → check if sector is expanding, plateauing, or declining                                                                                       
  HANDOFF: Feeds r5-eagle                                                                                                                               
                                                                                                                                                          
  MODULE: r5-eagle                                                                                                                                      
  LAYER:  R5 — Eagle View (Reverse)                                                                                                                       
  PROCESS: Given sector → identify which macro forces are shaping it                                                                                    
           → run same process as f1-eagle but now with sector context loaded                                                                              
           → compare: does the macro picture validate or challenge
             the niche-level view established in r1?                                                                                                      
           → if forward mode was also run: load f1 macro signal map                                                                                       
             and find convergence / divergence with r5 findings                                                                                           
  HANDOFF: Feeds synthesis/l6-synthesis                                                                                                                   
                                                                                                                                                          
  ---                                                                                                                                                     
  The Loop: Where Forward and Reverse Meet                                                                                                                
                                                                                                                                                          
  LOOP MODE SYNTHESIS RULE
                                                                                                                                                          
  When both FORWARD and REVERSE have been run:                                                                                                            
   
  Agreement between F5 and R1 findings     → confidence boost +15 to those signals                                                                        
  Agreement between F1 and R5 findings     → confidence boost +15 to those forces                                                                       
  Disagreement between F3 and R3 market    → automatic CSL item (highest priority)                                                                        
  Disagreement between F1 and R5 macro     → automatic CSL item (re-run both with updated sources)                                                        
                                                                                                                                                          
  The synthesis module presents a LOOP VALIDATION TABLE:                                                                                                  
    Layer pair    F finding    R finding    Agreement?    CSL?                                                                                            
    F1 / R5       [macro]      [macro]      Yes/No        if No → CSL                                                                                     
    F3 / R3       [market]     [market]     Yes/No        if No → CSL                                                                                     
    F5 / R1       [ICP]        [ICP]        Yes/No        if No → CSL                                                                                     
                                                                                                                                                          
  This is the most powerful output of the entire methodology. When the eagle-down view and the niche-up view agree on what the market looks like — that is
   a high-confidence finding. When they disagree — that is the single most important thing to investigate next.                                           
                                                                                                                                                          
  ---                                                                                                                                                   
  Core Modules (Always Loaded, Always Tiny)
                                           
  core/non-assumption-rule  (~150 tokens)
    Three rules only:                                                                                                                                     
    1. Never fill a gap with a guess. List it.                                                                                                            
    2. Never resolve a conflict by choosing. Surface it.                                                                                                  
    3. Never project beyond the data window. Flag it.                                                                                                     
                                                                                                                                                          
  core/csl-protocol  (~200 tokens)                                                                                                                      
    When to create a CSL item.                                                                                                                            
    CSL item format (compact version).                                                                                                                    
    User must resolve all CSL items before module handoff.                                                                                                
                                                                                                                                                          
  core/confidence-scoring  (~200 tokens)                                                                                                                  
    Tier base scores.                                                                                                                                   
    Modifiers table.                                                                                                                                      
    Minimum thresholds (60 for primary, 35 for supporting).                                                                                               
                                                                                                                                                          
  core/signal-tiers  (~150 tokens)                                                                                                                        
    Tier 0–5 definitions. One line each.                                                                                                                  
                                                                                                                                                          
  core/time-to-action  (~100 tokens)
    Immediate / Watch / Horizon / Structural. One line each.                                                                                              
                                                                                                                                                          
  Total core load: ~800 tokens. Fits in any context window.                                                                                               
                                                                                                                                                          
  ---                                                                                                                                                     
  How a Low-Context LLM Uses This                                                                                                                       
                                                                                                                                                          
  Session start:
    Load: manifest (300 tokens)                                                                                                                           
    Load: core/ modules (800 tokens)                                                                                                                      
    Total so far: ~1,100 tokens
                                                                                                                                                          
  User chooses REVERSE mode, FR + EU tracks, focus = "B2B fintech niche in France":                                                                       
    Load: reverse/r1-niche-icp (600 tokens)                                                                                                               
    Load: geo/fr (400 tokens)                                                                                                                             
    Load: geo/eu (400 tokens)                                                                                                                             
    Total so far: ~2,500 tokens
                                                                                                                                                          
  r1 completes → handoff to r2:                                                                                                                         
    Unload: reverse/r1-niche-icp                                                                                                                          
    Load: reverse/r2-competitive (600 tokens)                                                                                                             
    Total: still ~2,500 tokens
                                                                                                                                                          
  Each module loads, runs, unloads.                                                                                                                     
  Core modules stay in context throughout.                                                                                                                
  Geo modules stay in context throughout (they're small).                                                                                                 
  Only the active layer module changes.                                                                                                                   
                                                                                                                                                          
  Maximum context at any point: ~3,000 tokens                                                                                                             
  Works in 8K context window with room for output.                                                                                                        
  Works in 4K context window if core modules are pre-compressed.                                                                                          
                                                                                                                                                          
  ---                                                                                                                                                     
  Module File Structure                                                                                                                                   
                                                                                                                                                        
  .claude/workflow-team-library/business/
    manifest.md                                                                                                                                           
    core/
      non-assumption-rule.md                                                                                                                              
      csl-protocol.md                                                                                                                                   
      confidence-scoring.md
      signal-tiers.md
      time-to-action.md
    forward/                                                                                                                                              
      f1-eagle.md
      f1.5-lateral.md                                                                                                                                     
      f2-sector.md                                                                                                                                      
      f3-market.md
      f4-competitive.md
      f5-niche-icp.md
    reverse/                                                                                                                                              
      r1-niche-icp.md
      r2-competitive.md                                                                                                                                   
      r3-market.md                                                                                                                                      
      r4-sector.md
      r5-eagle.md
    geo/
      fr.md                                                                                                                                               
      eu.md
      us.md                                                                                                                                               
      cn.md                                                                                                                                             
      asia.md
      africa.md
      oceania.md
    synthesis/
      l6-synthesis.md
    ops/
      watchlist.md                                                                                                                                        
      source-audit.md
      signal-registry.md                                                                                                                                  
                                                                                                                                                        
  ---
  Summary of the Two Traversal Modes
                                                                                                                                                          
  ┌────────────────┬──────────────────────────────────────────────────────┬──────────────────────────────────────────────────┐
  │                │               Forward (Eagle → Focus)                │             Reverse (Focus → Eagle)              │                            
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤                          
  │ Entry point    │ Macro signal / opportunity scan                      │ Known business / niche / vertical                │
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
  │ First question │ What forces are reshaping categories?                │ What do we already know about this niche?        │                            
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤                            
  │ Value          │ Finds where to play                                  │ Understands forces around where you already play │                            
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤                            
  │ Best for       │ New market entry, investment scanning                │ Competitive strategy, positioning, defense       │                          
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤                            
  │ Ends at        │ ICP + positioning brief                              │ Macro context map for your niche                 │                          
  ├────────────────┼──────────────────────────────────────────────────────┼──────────────────────────────────────────────────┤                            
  │ Combined       │ Loop mode — forward + reverse + synthesis crosscheck │                                                  │                          
  └────────────────┴──────────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
  