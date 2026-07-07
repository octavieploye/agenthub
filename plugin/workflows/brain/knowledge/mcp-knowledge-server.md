# KNOWLEDGE: MCP Knowledge Server Architecture
OWNER:  lead-brain + strategy-advisor
UPDATED: 2026-06-26
SOURCE: Internal architecture discussion — MCP server for governing knowledge
        access by model tier, location, and clearance level

---

## PURPOSE

Architecture for an MCP server that serves knowledge documents to different
AI models based on their size, location, and clearance level. Enforces
sovereignty, governs access, and audits all knowledge consumption.

---

## CORE CONCEPT

```
KNOWLEDGE BRAIN (source of truth)
    │
    ├── MCP SERVER (7 functions)
    │   ├── 1. Auth       → WHO is calling
    │   ├── 2. Classify   → WHAT tier model (7B / 27B / 128k+)
    │   ├── 3. Locate     → WHERE is the model running (local / EU / US / CN)
    │   ├── 4. Clearance  → WHAT docs they can see (tier × location × classification)
    │   ├── 5. Translate  → COMPRESS + REDACT to appropriate level
    │   ├── 6. Serve      → DELIVER the document
    │   └── 7. Audit      → LOG what was served, to whom, when
    │
    ├── 7B local    → compact version, PUBLIC + INTERNAL only
    ├── 70B local   → full version, up to CONFIDENTIAL
    ├── EU cloud    → full version, up to CONFIDENTIAL (with DPA)
    └── US cloud    → full version, PUBLIC + INTERNAL only
```

---

## ACCESS MATRIX

Access is determined by THREE factors multiplied together:

```
Access = Classification Level × Model Tier × Model Location
```

| Classification | Local 7B | Local 70B | EU Cloud (Mistral) | US Cloud (Claude, GPT) |
|---|---|---|---|---|
| PUBLIC | compact | compact | full | full |
| INTERNAL | compact | full | full | full |
| CONFIDENTIAL | compact | full | full (with DPA) | BLOCKED |
| RESTRICTED | BLOCKED | BLOCKED | BLOCKED | BLOCKED |

---

## CLASSIFICATION LEVELS

| Level | Definition | Examples |
|---|---|---|
| PUBLIC | No business sensitivity | Scheduling frameworks, general knowledge, open-source docs |
| INTERNAL | Business-sensitive, not legally protected | Business strategy, project plans, roadmaps, internal processes |
| CONFIDENTIAL | Legally protected, contractual obligations | Client contracts, financial data, NDA-covered material |
| RESTRICTED | Maximum sensitivity, never served to any model | Legal disputes, passwords, trade secrets, sovereignty-critical |

### Rules:
1. Every document MUST have a classification level in its metadata
2. Default classification is INTERNAL (not PUBLIC)
3. RESTRICTED documents are NEVER served to any model — human eyes only
4. Classification can be upgraded but never downgraded without human approval

---

## MODEL TIER SERVING

| Tier | Context window | Version served | Max tokens per doc |
|---|---|---|---|
| Small (7B-13B) | 4k-32k | Ultra-compact — decision trees + top 5 rules only | ~2k tokens |
| Medium (27B-70B) | 32k-128k | Compact — current format (rules + tables + anti-patterns) | ~8k tokens |
| Large (128k+) | 128k-1M+ | Full doc + reference material | Unlimited |

---

## MCP SERVER TOOLS

```
Tools:
  knowledge.search(query, tier?, clearance?)
    → Returns matching docs at appropriate tier and clearance
    → Automatically compresses based on caller's model tier
    → Blocks docs above caller's clearance level

  knowledge.list(classification?)
    → Lists available docs the caller can see
    → Filtered by clearance

  knowledge.get(doc_id, tier?)
    → Returns specific doc at appropriate tier
    → Blocked if doc classification exceeds caller clearance

Resources:
  knowledge://brain/{doc-name}
    → Direct doc access (filtered by clearance + tier)

Prompts:
  knowledge.context(topic)
    → Pre-built context block for a topic
    → Assembled from multiple relevant docs
    → Compressed to caller's tier
```

---

## AUDIT TRAIL

Every knowledge access is logged:

| Field | What is recorded |
|---|---|
| Timestamp | When the access occurred |
| Caller ID | Who/what requested the document |
| Model tier | What size model made the request |
| Model location | Where the model is running (local/EU/US) |
| Document ID | Which document was requested |
| Classification | Document's classification level |
| Action | Served / Blocked / Redacted |
| Tokens served | How many tokens were delivered |

### Rules:
1. Audit trail is append-only — never modified or deleted
2. BLOCKED access attempts are logged (not just successful serves)
3. Audit data itself is classified INTERNAL minimum
4. Monthly audit review should check for anomalies

---

## STORAGE OPTIONS

| Option | Pros | Cons |
|---|---|---|
| SQLite DB | Fast, local, sovereign, single file | Need schema + migration |
| File system + metadata | Already built (current .md files) | Harder to query by classification |
| SQLite + files | DB = metadata + classification + audit; files = content | Best of both |

Recommended: SQLite + files. The knowledge docs remain readable .md files.
SQLite stores the metadata, classification, and audit trail.

---

## ANTI-PATTERNS

1. Serving CONFIDENTIAL docs to US cloud models — sovereignty violation
2. No classification on documents — defaults to maximum access, not minimum
3. Trusting model self-reporting of tier/location — server must verify
4. No audit trail — cannot prove what was or wasn't served
5. Allowing classification downgrade without human approval
6. Serving RESTRICTED docs to any model under any circumstance
7. No token budget — model downloads entire knowledge base in one session
