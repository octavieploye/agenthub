---
name: test-integrity-review
description: Check code changes for "test changed to pass" patterns — use during code review, before commits, or when reviewing PRs that touch both tests and implementation
category: dev-skills
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
