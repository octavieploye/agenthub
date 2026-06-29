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

---
## Add project-specific scenarios below this line:

