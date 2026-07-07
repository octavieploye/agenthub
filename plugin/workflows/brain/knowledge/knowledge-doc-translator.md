# KNOWLEDGE: Knowledge Doc Translator — Auto-Tiering System
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Internal architecture discussion — single source of truth with
        automated downscaling for different model tiers

---

## PURPOSE

Architecture for a translator that takes full knowledge documents and
automatically generates versions optimized for different AI model sizes.
Single source of truth, zero drift, versions regenerate on demand.

---

## CORE CONCEPT

```
FULL DOC (single source of truth)
    │
    ├──► Translator (large model) ──► 7B version   (~2-4k tokens)
    ├──► Translator (large model) ──► Medium version (~8-16k tokens)
    └──► No translation needed    ──► Large model reads full doc directly
```

One file to maintain. Zero drift. Versions regenerate on demand.

---

## TRANSLATION RULES BY TIER

### For 7B Target (ultra-compact)

| Rule | Why |
|---|---|
| Max 2,000 tokens per file | Small context windows (4k-32k) |
| Only decision trees + numbered rules (max 5) | Weak reasoning — needs explicit if/then logic |
| No tables wider than 3 columns | Parsing difficulty with complex tables |
| No "see other file" references | Cannot cross-reference, inline everything |
| Simple sentences, no nested conditionals | Smaller models fail on "if X and Y then Z unless W" |
| One concept per line | Reduces ambiguity |
| No narrative, no metaphors | Smaller models take them literally |

### For Medium Target (27B-70B, compact)

| Rule | Why |
|---|---|
| Max 8,000 tokens per file | Moderate context windows (32k-128k) |
| Rules + tables + decision trees | Can follow structured logic |
| Cross-references allowed with brief inline summary | Can handle "see X.md for details" if summary given |
| Anti-patterns section kept but trimmed to top 3 | Can learn from negative examples |
| Tables up to 5 columns | Handles moderate complexity |

### For Large Target (128k+)

| Rule | Why |
|---|---|
| Full document, no changes | Large context, strong reasoning |
| Can load multiple docs simultaneously | Cross-referencing works natively |
| Reference material loaded alongside | Adds depth and context |
| Full anti-patterns, full examples | Benefits from comprehensive coverage |

---

## WHAT THE TRANSLATOR DOES

Not just compression — also REDACTION based on sovereignty rules.

| Function | Input | Output |
|---|---|---|
| Compress | Full doc (8-16k tokens) | Tier-appropriate version (2k or 8k) |
| Simplify | Complex conditionals, nested logic | Flat if/then rules |
| Flatten | Deep table structures | Simple key-value pairs |
| Inline | Cross-file references | Self-contained summary within the doc |
| Redact | CONFIDENTIAL content | Stripped or summarized based on clearance |

---

## IMPLEMENTATION OPTIONS

| Option | How it works | Pros | Cons |
|---|---|---|---|
| AI agent task | Large model reads full doc + rules, outputs compressed version | Intelligent compression, handles nuance | Costs tokens, non-deterministic |
| Template-based | Source doc has markers (##COMPACT_START / ##COMPACT_END) | Deterministic, no AI cost | Manual maintenance of markers |
| Hybrid | AI generates first version, human reviews, then cached | Best quality, cost only on changes | Slower initial generation |

### Recommended: Hybrid approach
1. AI generates compressed versions when source doc changes
2. Human reviews and approves (or auto-approves if diff is small)
3. Approved versions cached — served directly until source changes
4. Re-generation triggered by: source doc edit, manual request, or schedule

---

## INTEGRATION WITH MCP KNOWLEDGE SERVER

The translator is a component OF the MCP server, not a separate system.

```
Request arrives at MCP server
    │
    ├── 1. Auth (who is calling)
    ├── 2. Classify (model tier)
    ├── 3. Locate (model location)
    ├── 4. Clearance check
    │
    ├── 5. Translate ◄── THIS IS THE TRANSLATOR
    │   ├── Check cache: is there a current version for this tier?
    │   │   YES → serve cached version
    │   │   NO  → generate, cache, then serve
    │   └── Apply redaction if clearance requires it
    │
    ├── 6. Serve
    └── 7. Audit
```

---

## FILE STRUCTURE

```
brain/knowledge/
  *.md                          ← Medium tier (current compact format = source of truth)
  reference/                    ← Full research + originals (large tier reads these too)
  7b/                           ← Auto-generated ultra-compact versions (cached)
    human-constraints.7b.md
    prioritization-rules.7b.md
    ...
```

### Rules:
1. NEVER manually edit files in `7b/` — they are auto-generated
2. Source of truth is always the compact `*.md` file in the root
3. `reference/` provides depth for large models, never served to small models
4. Cache invalidation: when source `.md` file changes, delete corresponding `7b/` file

---

## ANTI-PATTERNS

1. Maintaining two versions manually — they WILL drift within weeks
2. Using the same version for all model tiers — 7B cannot parse what 128k can
3. Compressing by truncation (cutting the file short) — must compress by distillation
4. No cache — regenerating on every request wastes tokens and time
5. Translating without redaction — sovereignty rules must be applied during translation
6. Letting the translator run on a small model — use a large model to compress for small models
