# Test Protection Measures — Design Spec

**Date:** 2026-06-25
**Status:** Implemented
**Trigger:** Commit `c5100c5` removed `term.write()` callback from both code and test simultaneously, violating "NEVER CHANGE TESTS TO PASS" rule. Scout-integration flagged the violation.

## Problem

Agents treat tests as mirrors of current implementation rather than as contracts defining required behavior. When refactoring code, agents update test assertions to match the new code — silently removing behavioral contracts with no audit trail.

The existing one-liner rule ("NEVER CHANGE TESTS TO PASS") was insufficient because:
1. It lacked specifics on what "changing tests" looks like in practice
2. No commit-time gate caught the violation
3. No review-time checklist existed to detect the pattern
4. Mega-commits (39 files) made human review impossible

## Root Cause Analysis

Three contributing factors:
- **Mega-commit created low-scrutiny context** — 39-file commit introduced the callback pattern with no meaningful review possible
- **Agent treated test as mirror, not contract** — commit message literally said "Update test assertions to match new drain() call pattern"
- **No gate separates code change from test relaxation** — test suite passed because both sides changed simultaneously

## Solution: 4 Layered Defenses

### Measure A — Expanded CLAUDE.md Rule
**File:** `.claude/CLAUDE.md:32-37`

Expanded the one-liner into a subsection with:
- Signal vs obstacle framing
- Separate commit requirement for test changes
- Explicit prohibition of "update test to match code"
- Cross-reference to git-ops Test Relaxation Gate

### Measure B — Commit Scope Cap
**File:** `.claude/commands/git-commit.md` (Commit Scope Limits section)

- Max 7 files per commit (prevents mega-commits)
- "Fix N failures" tasks split by root cause
- Test+implementation in same commit triggers Relaxation Gate

### Measure C — Test Relaxation Gate
**File:** `.claude/commands/git-commit.md` (Test Relaxation Gate section)

Mandatory pre-commit scan for weakened assertions:
- 6 specific patterns detected (callback dropped, args reduced, precision reduced, etc.)
- STOP and escalate if found in same diff as implementation changes
- Exception for pure test-only commits

### Measure D — Test Integrity Review Skill
**File:** `.claude/skills/test-integrity-review/SKILL.md`

4-step checklist for code reviews:
1. Direction Check — did test follow code or code satisfy test?
2. Commit Separation Check — are changes in same commit?
3. Assertion Strength Audit — table of weakening patterns
4. Justification Check — is relaxation documented and approved?

Includes "Common Rationalizations to Reject" section for agent guidance.

## Defense-in-Depth

| Layer | When | What catches it |
|-------|------|-----------------|
| A (Rule) | Agent reads CLAUDE.md | Teaches the rule before work starts |
| B (Scope) | Before staging | Limits blast radius, forces atomic commits |
| C (Gate) | Before committing | Blocks weakened assertions at commit time |
| D (Review) | During code review | Catches violations in review/PR context |
