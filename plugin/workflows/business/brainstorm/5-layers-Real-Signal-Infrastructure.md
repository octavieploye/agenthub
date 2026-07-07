23.06.2026
Layer 1 Expansion Brainstorm — Real Signal Infrastructure                                                                                             
                                                                                                                                                          
  From noise to intelligence: sources, feeds, and filtering methodology
                                                                                                                                                          
  ---                                                                                                                                                     
  The Core Problem First
                                                                                                                                                          
  Most "research" confuses data with signal. Reddit has millions of posts. X has billions. The internet is not a signal — it is a firehose. The         
  methodology needs a signal extraction layer that sits between raw sources and the analyst. Without it, the business team drowns in noise before it      
  produces a single insight.
                                                                                                                                                          
  Signal = a data point that changes a hypothesis or confirms it with enough specificity to act on.                                                       
  Noise = everything else.
                                                                                                                                                          
  ---                                                                                                                                                   
  Signal Source Taxonomy                                                                                                                                  
                                                                                                                                                        
  Category A — Corporate Events (Hard Signals)
                                                                                                                                                          
  Verifiable facts. Filed documents. Press announcements. High trust, low noise.                                                                          
                                                                                                                                                          
  M&A / Acquisitions:                                                                                                                                     
  - Crunchbase, PitchBook, CB Insights — deal flow, funding rounds, acquisitions                                                                        
  - SEC EDGAR (US) — 8-K filings (material events), 13D (activist investor positions), proxy statements                                                   
  - Companies House (UK) — director changes, filings                                                   
  - INPI (FR) — French company registry, IP filings                                                                                                       
  - Bundesanzeiger (DE) — German official company announcements                                                                                         
  - AMF (FR) — Autorité des Marchés Financiers — market disclosures, M&A approvals                                                                        
  - Bloomberg/Reuters M&A feeds — deal announcements                                                                                                      
  - Refinitiv/LSEG — global deal flow database                                                                                                            
  - Mergermarket — deal intelligence, rumor stage included                                                                                                
                                                                                                                                                          
  Signals to extract:                                                                                                                                     
  - Which sectors are being rolled up by PE? (Consolidation = margin pressure on independents)                                                            
  - Which companies are being bought by strategic acquirers vs. financial buyers? (Strategic = they see capability gap)                                   
  - Which companies are being acquired for their data, their talent, or their product? (Reveals what incumbents can't build)                            
                                                                                                                                                          
  ---                                                                                                                                                     
  Category B — Executive & Board Changes (Soft-Hard Signal)                                                                                               
                                                                                                                                                          
  High specificity. When a CEO leaves or a board composition shifts, strategy follows within 6–12 months.                                               
                                                                                                                                                          
  Sources:                                                                                                                                                
  - LinkedIn — executive departure/arrival announcements (noisy but fast)                                                                                 
  - PR Newswire / Globe Newswire / BusinessWire — official leadership announcements                                                                       
  - BoardEx — director network mapping, board composition changes                                                                                       
  - Institutional Shareholder Services (ISS) — governance, proxy fight tracking                                                                           
  - SEC Form 4 — insider transactions (exec selling = signal, exec buying = signal)                                                                       
  - Refinitiv executive movement alerts                                                                                                                   
  - Manifesto filings — when a new CEO publishes their strategic letter (earnings calls, annual reports)                                                  
                                                                                                                                                          
  Signals to extract:                                                                                                                                     
  - Activist investor on the board → expect restructuring, spin-offs, cost cuts                                                                           
  - CTO/CPO departures at a growth company → product direction shift incoming                                                                             
  - New CEO from outside the industry → expect disruption of existing playbook                                                                          
  - Board member from a specific sector added → signals strategic pivot direction                                                                         
  - Exec selling large position pre-announcement → regulatory risk on the horizon                                                                         
                                                                                                                                                          
  FR/US/EU specific:                                                                                                                                      
  - France: AMF insider trading disclosures, AFEP-MEDEF governance code changes                                                                           
  - US: SEC proxy filings, activist 13D filings, Delaware court decisions                                                                                 
  - EU: ESMA executive accountability reports, ECB supervision decisions for financial sector                                                             
                                                                                                                                                          
  ---                                                                                                                                                     
  Category C — Policy, Law & Regulation (Hard Signal, Slow Fuse)
                                                                                                                                                          
  Slow to ignite, devastating when they land. Most companies miss the 18-month window before enforcement.                                               
                                                                                                                                                          
  EU Sources:                                                                                                                                           
  - EUR-Lex / Official Journal of the EU — all directives, regulations, decisions                                                                         
  - European Commission press releases — proposed legislation, competition decisions                                                                      
  - EDPB (European Data Protection Board) — GDPR enforcement trends                 
  - DG COMP — antitrust, merger control, state aid decisions                                                                                              
  - EU AI Act tracker — tiered risk classification updates                                                                                              
  - ESMA (securities), EBA (banking), EIOPA (insurance) — sector-specific rulemaking                                                                      
  - European Parliament committee agendas — signals 12–24 months ahead                                                                                    
                                                                                                                                                          
  FR Sources:                                                                                                                                             
  - Legifrance — official French law, ordonnances, décrets                                                                                                
  - CNIL — data protection enforcement actions and guidance                                                                                               
  - Autorité de la Concurrence — competition decisions, merger clearances                                                                               
  - DARES — labor market regulations, employment law changes                                                                                              
  - Sénat / Assemblée Nationale debate tracking — bills in committee                                                                                      
                                                                                                                                                          
  US Sources:                                                                                                                                             
  - Federal Register — all proposed and final federal rules                                                                                               
  - Congressional Record — bills introduced, committee votes                                                                                              
  - FTC/DOJ — antitrust investigations, enforcement actions, merger challenges                                                                          
  - SEC rulemaking — securities, ESG disclosure, AI governance rules                                                                                      
  - CFPB — fintech/financial product regulation                                                                                                           
  - State-level: California CPRA, Illinois BIPA, state AG actions (often precede federal)                                                                 
                                                                                                                                                          
  Signals to extract:                                                                                                                                     
  - Proposed regulation → 18-month window to position ahead of compliance burden                                                                          
  - Antitrust investigation opened → market will fragment, competitors become targets                                                                     
  - New employment law (FR: working time, AI supervision) → HR tech opportunity                                                                         
  - Data localization requirement → sovereignty play, cloud provider shifts                                                                               
  - Tax regime change → capital reallocation follows within one fiscal year                                                                               
                                                                                                                                                          
  ---                                                                                                                                                     
  Category D — New Discoveries, Science & Technology (Weak-to-Hard Signal)                                                                                
                                                                                                                                                          
  The weakest signal type initially — but the highest leverage if caught early.                                                                         
                                                                                                                                                          
  Academic / Research:                                                                                                                                  
  - ArXiv (preprints) — CS, AI, physics, economics — 1–3 years ahead of product                                                                           
  - PubMed / bioRxiv / medRxiv — life sciences, pharma, biotech                                                                                           
  - SSRN — economics, finance, law preprints                   
  - Google Scholar alerts on specific topics                                                                                                              
  - Nature, Science, Cell — top peer-reviewed (slower but authoritative)                                                                                
  - MIT Technology Review — translates research into business impact                                                                                      
                                                                                                                                                          
  Patent Filings:                                                                                                                                         
  - USPTO (US), EPO (EU), INPI (FR), WIPO (international) — patent application clusters                                                                   
  - Patent citation analysis — who is building on whose IP                                                                                                
  - Defensive patent filing patterns — signals protection of strategic moat
  - Patent abandonments — signals pivot away from a technology                                                                                            
                                                                                                                                                          
  Technology Emergence:                                                                                                                                   
  - Y Combinator batches — early stage company clustering by domain                                                                                       
  - ProductHunt — consumer/SMB tool launches                                                                                                            
  - GitHub trending repositories — developer adoption signals                                                                                             
  - Hacker News "Show HN" — technical community early adopters                                                                                            
  - Gartner Hype Cycle — where technologies are on the adoption curve                                                                                     
  - Exploding Topics / Glimpse — search trend acceleration                                                                                                
                                                                                                                                                          
  Signals to extract:                                                                                                                                     
  - Patent cluster in a domain → 3–5 years from product, track the assignees                                                                              
  - ArXiv paper with 500+ citations in 60 days → breakthrough, watch for commercialization                                                                
  - YC batch with 8+ companies in same problem space → market validation signal                                                                           
  - GitHub repo gaining 1000 stars/week → developer adoption inflection                                                                                   
                                                                                                                                                          
  ---                                                                                                                                                     
  Category E — Market Trends & Commercial Intelligence (Soft Signal)                                                                                      
                                                                                                                                                          
  Directional. Never act on one source. Always corroborate across at least 3.                                                                           
                                                                                                                                                          
  Search & Interest:
  - Google Trends — volume trend over time, geographic concentration                                                                                      
  - Semrush / Ahrefs — keyword competition, content gap, SERP shifts                                                                                      
  - Exploding Topics — acceleration detection before mainstream awareness
                                                                                                                                                          
  Commercial Data:                                                                                                                                        
  - Nielsen / Euromonitor / Statista — sector reports (expensive but authoritative)                                                                       
  - McKinsey Global Institute / BCG / Bain / Deloitte insights — free tier is directional                                                                 
  - Pitchbook sector reports — venture investment thesis signals                                                                                        
  - LinkedIn Talent Insights — hiring concentration by skill/geography                                                                                    
                                                                                                                                                          
  Job Posting Analysis:                                                                                                                                   
  - Jobs posted at a company = investment signal (where they're building)                                                                                 
  - Sudden surge in AI/data roles at a traditional company = transformation signal                                                                        
  - Mass layoffs in specific role types = technology displacement signal                                                                                
  - Role titles changing across an industry = new capability becoming standard                                                                            
                                                                                                                                                          
  ---                                                                                                                                                     
  Category F — Community & Practitioner Intelligence (Lowest Trust, Highest Insight Potential)                                                            
                                                                                                                                                        
  The richest source of real buyer psychology — and the noisiest. Requires aggressive filtering.                                                          
                                                                                                                                                          
  Sources:
  - Reddit — specific subreddits (r/entrepreneur, r/smallbusiness, r/legaladvice, sector-specific)                                                        
  - Hacker News — technical practitioner community, high signal density on SaaS/tech                                                                      
  - LinkedIn posts + comments — practitioners sharing real experience (verify account credibility)
  - Substack newsletters by domain experts — curated, niche, low noise                                                                                    
  - Blind — anonymous professional network, brutal honesty on company culture and tools                                                                   
  - Discord servers — niche communities, very high signal if you find the right server                                                                    
  - Quora — declining but useful for evergreen pain point discovery                                                                                       
  - Twitter/X — very low signal-to-noise ratio, use only verified experts + domain hashtags                                                               
                                                                                                                                                          
  ---                                                                                                                                                     
  The Filtering Framework — Separating Signal from Noise                                                                                                  
                                                                                                                                                          
  Tier System for Source Trust                                                                                                                          
                                                                                                                                                          
  Tier 1 — Hard Evidence        SEC filings, official gazettes, patent filings, court records                                                             
                                Trust: near 100%. No filter needed beyond relevance.                                                                      
                                                                                                                                                          
  Tier 2 — Verified Publication Official press releases, major financial media (Reuters, Bloomberg, FT)                                                   
                                Trust: high. Check for PR spin vs. factual claim.                                                                         
                                                                                                                                                          
  Tier 3 — Expert Opinion       Named practitioners, domain newsletter authors, academic papers                                                           
                                Trust: medium-high. Verify credentials. Check for conflict of interest.                                                   
                                                                                                                                                          
  Tier 4 — Community Signal     Reddit threads, Hacker News, LinkedIn comments, Blind posts                                                               
                                Trust: low individually. Only actionable when corroborated.
                                                                                                                                                          
  Tier 5 — Raw Social           Twitter/X, TikTok, general forum posts                                                                                    
                                Trust: very low. Use only for sentiment direction, never for facts.                                                       
                                                                                                                                                          
  ---                                                                                                                                                   
  Community Signal Filter (Reddit / HN / Social)                                                                                                          
                                                                                                                                                          
  A post moves from noise → signal only if it passes 3 of these 5 gates:
                                                                                                                                                          
  Gate 1 — Specificity                                                                                                                                  
    Does it name a specific product, tool, process, or company by name?                                                                                   
    Vague: "HR software is terrible" → noise                                                                                                              
    Specific: "ADP Workforce Now crashes every payroll run and support takes 3 days" → signal                                                             
                                                                                                                                                          
  Gate 2 — Reproducibility                                                                                                                                
    Has the same complaint appeared in 3+ independent threads, different authors?                                                                         
    Single post → noise                                                                                                                                   
    Pattern across subreddits, timeframes → signal                                                                                                        
                                                                                                                                                          
  Gate 3 — Account Credibility                                                                                                                            
    Account age > 6 months, karma > 500 for Reddit                                                                                                      
    Named LinkedIn profile with verifiable history                                                                                                        
    Anonymous or new account → noise (unless content is extremely specific)                                                                               
                                                                                                                                                          
  Gate 4 — Emotion-to-Fact Ratio                                                                                                                          
    High emotion + no specifics = troll or venting                                                                                                        
    Low emotion + high specifics = real practitioner describing real problem                                                                              
    "I hate this software" → noise                                                                                                                        
    "We migrated off X because it can't handle multi-currency invoicing" → signal                                                                         
                                                                                                                                                          
  Gate 5 — Corroboration Across Tiers                                                                                                                   
    Does a Tier 4 signal match anything from Tier 1–3?                                                                                                    
    Community complaint + executive departure at same company = compounded signal                                                                         
    Community complaint alone = watch list only                                                                                                           
                                                                                                                                                          
  ---                                                                                                                                                     
  Signal Lifecycle — From Raw to Actionable                                                                                                               
                                                                                                                                                          
  Raw Feed
    ↓                                                                                                                                                     
  Relevance Filter        Is this about a domain we're tracking?                                                                                        
    ↓                                                                                                                                                     
  Tier Assignment         Hard evidence / verified / expert / community / social
    ↓                                                                                                                                                     
  Gate Check (Tier 4-5)   Pass 3 of 5 gates to advance                                                                                                  
    ↓                                                                                                                                                     
  Corroboration Check     Does this appear in 2+ independent sources?                                                                                   
    ↓                                                                                                                                                     
  Hypothesis Impact       Does this change, confirm, or contradict a current hypothesis?                                                                
    ↓                                                                                                                                                     
  Layer Assignment        Which of the 5 research layers does this belong to?                                                                           
    ↓                                                                                                                                                     
  Signal Card             Structured entry: source, tier, signal content, hypothesis impact, date                                                       
                                                                                                                                                          
  ---                                                                                                                                                   
  Which Agents Handle Which Signal Types                                                                                                                  
                                                                                                                                                        
  ┌────────────────────────────┬────────────────────┬────────────────────┐
  │      Signal Category       │   Primary Agent    │  Secondary Agent   │                                                                                
  ├────────────────────────────┼────────────────────┼────────────────────┤
  │ M&A / Corporate Events     │ investment-curator │ market-researcher  │                                                                                
  ├────────────────────────────┼────────────────────┼────────────────────┤                                                                              
  │ Executive / Board Changes  │ market-researcher  │ business-analyst   │                                                                                
  ├────────────────────────────┼────────────────────┼────────────────────┤
  │ Policy / Law / Regulation  │ strategist         │ ceo-advisor        │                                                                                
  ├────────────────────────────┼────────────────────┼────────────────────┤                                                                                
  │ New Tech / Science         │ market-researcher  │ investment-curator │
  ├────────────────────────────┼────────────────────┼────────────────────┤                                                                                
  │ Market Trends / Commercial │ business-analyst   │ market-researcher  │                                                                              
  ├────────────────────────────┼────────────────────┼────────────────────┤                                                                                
  │ Community / Practitioner   │ market-researcher  │ positioning-expert │                                                                              
  └────────────────────────────┴────────────────────┴────────────────────┘                                                                                
  
  business-analyst owns the corroboration check and tier assignment across all categories.                                                                
  lead-business decides when a signal cluster is strong enough to trigger a Layer 2–5 deep dive.                                                        
                                                                                                                                                          
  ---                                                                                                                                                   
  Signal Cluster Trigger (When a Signal Becomes a Research Task)                                                                                          
                                                                                                                                                          
  A signal cluster is triggered when 3+ signals from different categories converge on the same domain:
                                                                                                                                                          
  Example:                                                                                                                                              
    - M&A: Large PE firm acquires 3 HR software companies in 6 months  (Category A)                                                                       
    - Regulation: EU announces mandatory AI transparency in hiring tools (Category C)                                                                     
    - Community: Reddit r/humanresources fills with ATS complaints       (Category F → passes 4/5 gates)                                                  
                                                                                                                                                          
  → Signal cluster: HR tech market under consolidation pressure + incoming regulation + buyer pain                                                        
  → Trigger: Layer 2 deep dive on HR tech sector                                                                                                          
  → Agent dispatched: market-researcher + business-analyst in parallel                                                                                    
  → Estimated output: sector intelligence brief within 48h    