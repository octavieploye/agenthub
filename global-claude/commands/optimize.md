# /optimize — LLM-Ready Compression Skill

Transform any file or text into a dense, LLM-ready format with minimum tokens and maximum signal.

## Instructions

When invoked, apply the following transformations to the provided content:

**Strip:**
- Filler phrases ("In order to", "It is important to note that", "As mentioned above")
- Redundant explanations of things already stated
- Source citations / URLs unless they are the actual data point
- Decorative prose and narrative padding

**Preserve:**
- Every distinct fact, rule, constraint, or decision
- All named entities (services, tables, files, roles)
- Numbered sequences and ordered steps
- Warnings, hard rules, and security constraints
- Section headers (shorten if verbose)

**Format rules:**
- Use bullet points over paragraphs
- Use `code` for names, paths, and values
- Merge related bullets if they share a subject
- Max header depth: 2 levels (`##`, `###`)
- No blank lines between bullets in the same group
- End with a `---` separator and a one-line summary: `# SUMMARY: <what this file is, in ≤15 words>`

## Usage

```
/optimize <file_path>
```
or paste content directly after the command.

## Output

Return only the optimized content. Do not explain what you changed. Do not add commentary.
If the input is already optimal, return it unchanged with `# ALREADY OPTIMAL` at the top.
