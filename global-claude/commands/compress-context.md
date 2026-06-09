# /compress-context — Headroom Context Optimization Skill

Apply Headroom-derived multi-strategy compression to any prompt, system message, JSON payload, code block, or conversation context. Reduces token cost, maximizes cache hits, preserves reversibility.

## When to invoke

- Context or system prompt exceeds 4K tokens
- Large JSON blobs, API responses, or code blocks are in the context
- Preparing context before passing to a sub-agent
- Optimizing a prompt for cache-sensitive providers (Anthropic, OpenAI)

## Usage

```
/compress-context <file_path>
```
or paste content directly after the command.

---

## Step 1 — Classify input segments

Scan the full input and tag each segment before processing:

- `[JSON]` — structured data, API responses, config objects, payloads
- `[CODE]` — source code blocks of any language
- `[TEXT]` — prose, instructions, explanations, comments
- `[DYNAMIC]` — dates, UUIDs, session IDs, request tokens, timestamps, user-specific values

---

## Step 2 — Extract dynamic fields (cache alignment)

Move ALL `[DYNAMIC]` fields to the END of the output under a `## Dynamic Fields` section.

**Why:** Static prefix maximizes provider-level prefix cache hits. Dynamic values at the top of a prompt invalidate the cache on every call. Moving them to the end preserves a stable, cacheable prefix — up to 90% cost reduction on repeated calls.

---

## Step 3 — Apply per-type compression

### JSON `[JSON]`
1. Identify fields referenced by the current query or task — keep those intact
2. Squash fields with repeated or statistically redundant values (same value across >80% of records)
3. Remove null, empty-string, false-default, or zero-value fields unless they carry meaning
4. Collapse nested objects into flat dot-notation when depth > 2
5. Replace arrays of >5 identical-structure objects with one example + `[...N more]` annotation

### Code `[CODE]`
1. Strip comments unless they encode a hard rule, constraint, or security note
2. Remove boilerplate: obvious stdlib imports, empty constructors, scaffolding stubs
3. Collapse multiple blank lines to one
4. Preserve: function signatures, logic branches, error handlers, security constraints, return types

### Text `[TEXT]`
1. Remove filler: "In order to", "It is important to note that", "As mentioned above", "Please be aware"
2. Collapse restatements — keep first occurrence, remove duplicates
3. Convert paragraphs to bullets
4. Strip source citations unless the URL or reference IS the data point
5. Shorten section headers to ≤5 words
6. Merge bullets that share the same subject into one compound bullet

---

## Step 4 — CCR markers (Compress → Cache → Retrieve)

For any segment compressed aggressively (>60% token reduction from original), replace with a marker:

```
[CCR:<type>:<id>] <one-line summary of what was compressed>
```

Examples:
- `[CCR:JSON:a3f2] 47-field API response — query-irrelevant metrics removed`
- `[CCR:CODE:b91c] Full auth middleware — logic preserved, boilerplate stripped`

**Retrieval rule:** If downstream processing requires the original, use the ID to fetch from the local store (SQLite or Redis). If retrieval is called frequently for the same ID, the compression was too aggressive — reduce ratio on next run.

---

## Step 5 — Assemble output

Output order (strict):

1. All compressed static content (`[TEXT]`, `[JSON]`, `[CODE]` segments — in original order)
2. `## Dynamic Fields` — all extracted `[DYNAMIC]` values, labeled
3. `## CCR Registry` — one row per marker: `| ID | Type | Summary | Original size |` (omit if no CCR markers used)
4. `---`
5. `# SUMMARY: <what this context is, ≤15 words> | Compression: ~X% token reduction`

---

## Hard constraints

- Never hallucinate or infer content not present in the input — only remove or restructure
- Never compress security rules, hard constraints, warnings, or policy definitions
- Never merge logically distinct facts into a single bullet
- Never remove named entities (service names, table names, file paths, role names)
- Never remove ordered sequences or numbered steps
- If input is already ≤500 tokens with no dynamic fields: return unchanged with `# ALREADY OPTIMAL` at top
