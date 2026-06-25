# Test Protection Measures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent "test changed to pass" violations with 4 layered defenses: expanded CLAUDE.md rule, commit scope cap, test relaxation gate, and code review skill.

**Architecture:** All 4 measures are documentation/config changes — no application code. They layer defense-in-depth: A teaches agents the rule, B limits blast radius of bulk fixes, C catches violations at commit time, D catches them at review time.

**Tech Stack:** Markdown files only (.claude/CLAUDE.md, .claude/commands/git-commit.md, .claude/skills/)

## Global Constraints

- Do not modify application code or tests
- Do not change `.gitignore`
- All changes are in `.claude/` directory or `docs/`
- Follow existing formatting conventions in each file

---

### Task 1: Expand CLAUDE.md Test Rule (Measure A)

**Files:**
- Modify: `.claude/CLAUDE.md:32` (expand one-liner into subsection)

**Interfaces:**
- Consumes: nothing
- Produces: Expanded rule that all agents read on every session

- [ ] **Step 1: Read current CLAUDE.md line 32**

Verify current content is:
```
- **NEVER CHANGE TESTS TO PASS** — tests define expected behavior; fix the code, not the test.
```

- [ ] **Step 2: Replace line 32 with expanded rule**

Replace the single bullet with this subsection (insert after line 31, replacing line 32):

```markdown
- **NEVER CHANGE TESTS TO PASS** — tests define expected behavior; fix the code, not the test.
  - If refactored code no longer satisfies an existing test assertion, that is a **signal**, not an obstacle.
  - **Either the test was wrong** — fix it in a *separate, prior* commit with explicit justification in the commit message explaining why the old assertion was incorrect.
  - **Or your code broke a contract** — fix the code to satisfy the test, not the other way around.
  - **"Update test to match new code"** is never a valid commit message or rationale.
  - **Test assertion changes and implementation changes must never appear in the same commit.** This is enforced by git-ops (see Test Relaxation Gate in `.claude/commands/git-commit.md`).
```

- [ ] **Step 3: Verify no formatting issues**

Read the modified file and confirm the new bullets nest correctly under Core Principles and don't break the markdown structure.

---

### Task 2: Add Commit Scope Cap to git-commit.md (Measure B)

**Files:**
- Modify: `.claude/commands/git-commit.md` (add new section after Test Gate)

**Interfaces:**
- Consumes: nothing
- Produces: Scope cap rule that git-ops reads before every commit

- [ ] **Step 1: Read git-commit.md to find insertion point**

The Test Gate section ends at line 53 (step 7). The new section goes immediately after, before the `## Process` section at line 57.

- [ ] **Step 2: Insert Commit Scope Limits section**

Insert after line 53 (end of Test Gate), before `## Process`:

```markdown

### Commit Scope Limits (mandatory)

8. **Max 7 files per commit** — unless the change is a pure rename/move refactor with no logic changes. If more than 7 files are staged, propose a split by root cause or logical grouping and wait for lead/user approval.
9. **"Fix N test failures" tasks must be split by root cause** — one commit per root cause, each passing the full test suite independently. Never bundle unrelated fixes into a single commit.
10. **If a commit touches both test files and implementation files**, verify that the test changes are additive (new assertions, new test cases) rather than weakening existing assertions. If assertions are weakened, this triggers the Test Relaxation Gate below.
```

- [ ] **Step 3: Verify numbering continuity**

Confirm steps 1-7 (existing) flow into 8-10 (new) without gaps or duplicates.

---

### Task 3: Add Test Relaxation Gate to git-commit.md (Measure C)

**Files:**
- Modify: `.claude/commands/git-commit.md` (add new gate section after Commit Scope Limits)

**Interfaces:**
- Consumes: Commit Scope Limits (Task 2) — step 10 references this gate
- Produces: Mandatory pre-commit gate that git-ops must execute

- [ ] **Step 1: Insert Test Relaxation Gate section**

Insert immediately after the Commit Scope Limits section added in Task 2:

```markdown

### Test Relaxation Gate (mandatory)

Before committing any diff that touches both test files (`*.test.*`, `*.spec.*`) and implementation files in the same commit, git-ops MUST scan the diff for weakened assertions. Run:

```bash
git diff --cached -- '*.test.*' '*.spec.*'
```

**Flag and STOP if any of these patterns appear in the diff (removed or changed lines):**

| Pattern | What it means |
|---------|---------------|
| `expect.any(Function)` removed | Callback contract dropped |
| `.toHaveBeenCalledWith(a, b)` args reduced | Argument contract weakened |
| `.toHaveBeenCalled()` changed to `.not.toHaveBeenCalled()` | Invocation contract inverted |
| `expect(...)` assertion line deleted with no replacement | Coverage reduced |
| `.toThrow(` or `.rejects.` removed | Error contract dropped |
| `.toEqual(` changed to `.toBeDefined()` or `.toBeTruthy()` | Precision reduced |

**If any match is found:**

1. **Do NOT commit.** This is a potential "test changed to pass" violation.
2. Report to the requesting agent or lead: "Test Relaxation Gate triggered — the following assertions were weakened in the same diff as implementation changes: [list patterns found]."
3. The requesting agent must either:
   - **Separate the commits:** Fix the test in a prior commit with justification, then make the implementation change in a subsequent commit.
   - **Justify the relaxation:** Explain why the old assertion was wrong (not just "doesn't match new code") and get lead/user approval. Document the justification in the commit message.
4. Only proceed with the commit after one of the above is satisfied.

**Exception:** If the diff ONLY touches test files (no implementation files in the same commit), the gate does not apply — pure test refactors are allowed.
```

- [ ] **Step 2: Verify the gate section renders correctly**

Read the file and confirm the markdown table and numbered steps render properly.

---

### Task 4: Create test-integrity-review Skill (Measure D)

**Files:**
- Create: `.claude/skills/test-integrity-review/SKILL.md`
- Modify: `.claude/skills/index.md` (add entry)

**Interfaces:**
- Consumes: nothing
- Produces: Project-local skill available to all agents via skill invocation

- [ ] **Step 1: Create the skill directory and file**

Create `.claude/skills/test-integrity-review/SKILL.md`:

```markdown
---
name: test-integrity-review
description: Check code changes for "test changed to pass" patterns — use during code review, before commits, or when reviewing PRs that touch both tests and implementation
---

# Test Integrity Review

A focused checklist for catching "test follows code" violations. This is not a full code review — it augments whatever review process is in use.

## When to Use

- During any code review that touches test files
- Before requesting a commit that modifies both tests and implementation
- When reviewing PRs or diffs from other agents
- When the `requesting-code-review` skill is invoked on changes that include test files

## Checklist

For each test file in the diff, answer these questions:

### 1. Direction Check

**Ask: "Did the test change to match the code, or did the code change to satisfy the test?"**

- If test assertions were weakened, loosened, or removed — this is "test follows code." Flag it.
- If test assertions were added or tightened — this is healthy. Continue.
- If test assertions were changed to different (not weaker) values — investigate why. The old assertion encoded an expectation. Why is the new expectation correct?

### 2. Commit Separation Check

**Ask: "Are test changes and implementation changes in the same commit?"**

- If yes, and the test changes weaken assertions — this is a rule violation regardless of intent.
- If yes, and the test changes only ADD new assertions — acceptable.
- If test fixes are in a separate prior commit with justification — correct workflow.

### 3. Assertion Strength Audit

For each modified or deleted assertion, check:

| Before | After | Verdict |
|--------|-------|---------|
| `.toHaveBeenCalledWith(a, b)` | `.toHaveBeenCalledWith(a)` | WEAKENED — arg contract dropped |
| `.toHaveBeenCalled()` | removed or `.not.` | WEAKENED — call contract dropped |
| `expect.any(Function)` | removed | WEAKENED — callback contract dropped |
| `.toEqual(exact)` | `.toBeDefined()` | WEAKENED — precision reduced |
| `.toThrow(msg)` | removed | WEAKENED — error contract dropped |
| `.toHaveBeenCalledWith(a)` | `.toHaveBeenCalledWith(a, b)` | STRENGTHENED — acceptable |
| new `expect(...)` line | - | ADDED — acceptable |

### 4. Justification Check

For any weakened assertion, verify:

- Is there a commit message or PR comment explaining **why the old assertion was wrong** (not just "doesn't match new code")?
- Was the test fix done in a separate commit?
- Did lead/user approve the relaxation?

If any of these are missing, flag the change.

## Output Format

```
## Test Integrity Review

**Files reviewed:** [list]
**Verdict:** PASS | FAIL

### Findings (if FAIL)
- [ ] [file:line] — [pattern found] — [recommendation]
```

## Common Rationalizations to Reject

These are NOT valid reasons to weaken a test assertion:

- "The test was testing implementation details" — maybe, but prove the OLD test was wrong first, in a separate commit.
- "The refactor changed the API" — then the test should have failed and the API decision should be deliberate, not incidental.
- "The callback wasn't doing anything" — the test was asserting the callback EXISTS. That's a contract.
- "I updated the test to match the new code" — this sentence IS the violation.
```

- [ ] **Step 2: Update skills index**

Add entry to `.claude/skills/index.md`:

```markdown
- [test-integrity-review](test-integrity-review/SKILL.md) — Check code changes for "test changed to pass" patterns during review or before commits
```

- [ ] **Step 3: Verify skill loads**

Read the created SKILL.md file and confirm frontmatter (name, description) is valid and the file is correctly referenced from index.md.

---

### Task 5: Write design spec and commit plan

**Files:**
- Create: `docs/superpowers/specs/2026-06-25-test-protection-measures-design.md`

- [ ] **Step 1: Write the design spec**

Save the approved design from the brainstorming session as the spec document.

- [ ] **Step 2: Verify all 4 measures are consistent**

Cross-check:
- CLAUDE.md rule (A) references git-commit.md gate (C) — verify the path matches
- git-commit.md scope cap (B) step 10 references the Test Relaxation Gate (C) — verify it exists
- Skill (D) checklist patterns match the gate (C) table patterns — verify consistency
- All files reference each other correctly
