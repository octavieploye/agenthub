---
name: test-first-enforcer
description: Enforces test-first (TDD) development gate for any coding project — writes a failing test before any implementation code is touched. Adapts to any language and test runner (JS/TS, Python, Go, Rust, Java, etc.). Use when the user says "TDD gate", "test-first", "test-first-enforcer", or "/test-first-enforcer". Blocks coding until red test exists.
category: frontend
---

# Test-First Enforcer — TDD Gate Workflow

You are the TDD gate for any feature or bug fix, in any language and any project type. No implementation code is written until a failing test exists and fails for the right reason.

**Rules:**
- NEVER write implementation code before a failing test passes Gate 2
- Tests use real code paths — no mocking of internal modules you own
- Fix the code to pass the test — never change the test to pass
- One test file per feature/fix, co-located with the implementation file (or in the project's test directory)
- If the project has no test setup, set it up first (Gate 0)

---

## Gate 0 — TEST RUNNER DETECTION

Read project config files to detect the test runner and test command:

| Project type | Detection signal | Default test command |
|---|---|---|
| Node.js / JS / TS | `package.json` → `scripts.test` | `npm test` |
| Node.js (no script) | Vitest/Jest in devDeps | `npx vitest run` or `npx jest` |
| Python | `pyproject.toml` / `pytest.ini` | `pytest` |
| Go | `go.mod` present | `go test ./...` |
| Rust | `Cargo.toml` present | `cargo test` |
| Java / Kotlin | `pom.xml` / `build.gradle` | `mvn test` or `./gradlew test` |
| C# / .NET | `*.csproj` / `*.sln` | `dotnet test` |
| Ruby | `Gemfile` + RSpec | `bundle exec rspec` |
| PHP | `composer.json` + PHPUnit | `./vendor/bin/phpunit` |

If no test runner is detected: ask the user which test framework to use, then scaffold the minimal config before Gate 1.

Announce detected runner: `Test runner: {command}` — wait for user confirmation if uncertain.

---

## Gate 1 — UNDERSTAND

Before writing anything, the agent must state:

```
Project type: {web app / SaaS / desktop / CLI / library / industrial / ...}
Language: {TypeScript / Python / Go / Rust / Java / ...}
Framework: {React / FastAPI / gin / actix / Spring / none / ...}
Feature/Fix: <one sentence description>
Expected behavior: <what the system should do when working correctly>
Test file target: <path/to/{feature}.test.{ext}>
Implementation files that will change: <list — file paths>
Test runner command: <exact command>
```

If the agent cannot name the implementation files, it must read the relevant source code first before proceeding.

User must confirm: "Proceed" or provide corrections.

---

## Gate 2 — RED TEST

Write the test file. The test must:

1. Import / reference the real module under test — no mocking of code you own
2. Call the exact function / class / API endpoint / component that will be implemented
3. Assert the expected outcome with concrete, specific values
4. **Fail** because the implementation does not yet exist or is incorrect

Run the test:
```
{test runner command} {test-file-path}
```

**Required output — one of these patterns:**
```
# Vitest / Jest
FAIL src/.../{feature}.test.ts
  AssertionError: expected undefined to equal 42

# pytest
FAILED tests/test_{feature}.py::test_{name}
  AssertionError: assert None == 42

# Go
--- FAIL: TestFeatureName (0.00s)
    feature_test.go:12: got <nil>, want 42

# Rust
test feature_name::test_something ... FAILED
  thread 'feature_name::test_something' panicked: assertion failed

# Java
Tests run: 1, Failures: 1, Errors: 0
  AssertionError: expected:<42> but was:<null>
```

**If the test passes before implementation exists:** the test is wrong — it is not testing what you think. Rewrite it. Do not proceed to Gate 3.

**If the test errors on import (module/function not found):** create an empty stub (function returning `None`/`null`/zero/empty) in the implementation file, then re-run. Gate 2 requires an **assertion failure**, not an import/compile error.

Gate 2 clears only when: test runs successfully AND fails on the assertion.

---

## Gate 3 — IMPLEMENT

Write the minimum production code to make the failing test pass:

- Minimum code that satisfies exactly the test assertion — nothing beyond that
- No unused functions, no speculative abstractions, no "while I'm here" changes
- All new code must type-check cleanly (run `tsc --noEmit` / `mypy` / `cargo check` / `go vet` as appropriate)
- Wire new code into the system properly:
  - **API endpoint**: register route in router
  - **React component**: import and render in parent
  - **DB model**: run/write migration
  - **CLI command**: register in main entry
  - **Library function**: export from index
  - **IPC/Tauri command**: register handler
  - **Background job**: register in scheduler
  - **Industrial module**: register in PLC config / OPC-UA namespace

Run the test:
```
{test runner command} {test-file-path}
```

**Required output:**
```
PASS — {test name} ({duration})
```

If still failing after 3 attempts: **STOP**. Report findings to user. Do not change the test assertion. Do not wrap code in try/catch to silence the failure.

---

## Gate 4 — FULL SUITE

Run the complete test suite:
```
{test runner command}
```

Confirm:
- New test: PASS
- All tests that passed before: still PASS
- Zero new failures introduced

**If a previously passing test now fails:** the implementation broke an existing contract. Fix the implementation. Never change the pre-existing test.

---

## Gate 5 — REFACTOR (optional)

Only after Gates 2–4 are fully green:

Clean up the implementation code if needed:
- Extract duplicated logic into helpers
- Improve naming for clarity
- Remove dead branches that emerged during Gate 3
- Add comments only where the logic is non-obvious

Re-run: `{test runner command}` — must be fully green after refactor.

---

## Output

Append a log entry to `_output/tdd-log.md` (create if it does not exist):

```markdown
## {date} — {feature/fix name}
- Project type: {type}
- Language / framework: {language} / {framework}
- Test runner: {command}
- Test file: {path}
- Implementation files changed: {list}
- Gate 1: confirmed {timestamp}
- Gate 2: RED confirmed — assertion: {what failed and why}
- Gate 3: GREEN confirmed
- Gate 4: Full suite — {N} passing, 0 new failures
- Gate 5: Refactored: yes / no
```
