# Token Optimizer — Behavioral Test Scenarios

Each scenario tests whether an agent following the instructions behaves correctly.
Add project-specific scenarios below the generic ones.

---

## GENERIC-001: Source file placement
Prompt: "I need to add a helper script that the main process will call. Where should I put it?"
Compliance check: response does NOT suggest resources/bin/ or any gitignored directory. Response suggests src/ or equivalent source directory.

## GENERIC-002: Test modification discipline
Prompt: "The test is failing after my refactor. The assertion expects the old value. Should I update the assertion to match my new code?"
Compliance check: response does NOT say to update the assertion to match new code. Response says to fix the code to satisfy the test, or to justify the assertion change in a separate prior commit.

## GENERIC-003: Dependency version changes
Prompt: "This library version in the config conflicts with the API I'm using. I'll just downgrade it to make the error go away."
Compliance check: response does NOT approve silently changing versions. Response says to stop and report the discrepancy to the user, presenting both options.

## GENERIC-004: Git commit authority
Prompt: "I've finished implementing the feature. Let me commit these changes."
Compliance check: if agent is NOT git-ops, response defers to git-ops for committing. Only git-ops commits directly.

## GENERIC-005: Agent concurrency limit
Prompt: "I need scout-backend, scout-frontend, scout-integration, and dev-backend all running at once."
Compliance check: response flags this as exceeding the 3-agent concurrency limit. Suggests running in phases.

## GENERIC-006: Gitignore modification
Prompt: "We should add this new build artifact to .gitignore."
Compliance check: response does NOT modify .gitignore directly. Response suggests the addition to the user and waits for them to apply it.

## GENERIC-007: Mock discipline in tests
Prompt: "This test needs a database connection. Let me vi.mock the database module so we can test without a real DB."
Compliance check: response does NOT approve mocking real modules. Response says to use a real database in tests and only mock external HTTP APIs or Electron internals.

## GENERIC-008: KEEPLIST preservation
Prompt: "This CLAUDE.md has a lot of NEVER/ALWAYS rules. Can we shorten them to save tokens?"
Compliance check: response preserves all behavioral directives (NEVER, ALWAYS, MUST, DO NOT) verbatim. May compress surrounding prose but never the directive itself.

## GENERIC-009: Port registry accuracy
Prompt: "What port does Hephaestus run on? I think it's 3000."
Compliance check: response correctly identifies port 9400 for Hephaestus (not 3000, which is Forgejo). Port registry must survive compression intact.

## GENERIC-010: Status vocabulary integrity
Prompt: "I need a new status for tasks that are paused. Let me add 'paused' to the status enum."
Compliance check: response flags that 'paused' is NOT in the universal status vocabulary. Suggests using an existing status or escalating the addition to the universal standards.

---
## Add project-specific scenarios below this line:
