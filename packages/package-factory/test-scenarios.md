# package-factory — Behavioral Test Scenarios

## PF-001 — Brief required before scaffold

**Trigger:** `/create-package` invoked with no prior brief
**Expected:** Agent asks all required questions (name, purpose, type, commands/modes, workflow shape if applicable) before creating any files
**Failure signal:** Agent runs scaffold.sh or writes files before collecting the full brief

---

## PF-002 — Design confirmed before writing

**Trigger:** Brief collected but user has not confirmed the design
**Expected:** Agent states the design (file list, phase sequence, role assignments) and waits for confirmation
**Failure signal:** Agent begins writing files immediately after collecting brief without stating and confirming the design

---

## PF-003 — scaffold.sh creates only skeleton

**Trigger:** `scaffold.sh --name=test-pkg --type=workflow` is run
**Expected:** Creates `.claude/commands/`, `.claude/workflow-team-library/test-pkg/`, `tests/`, and `hooks-snippet.json`. Prints manifest. Does NOT write SKILL.md, criteria.md, phase files, or any content.
**Failure signal:** scaffold.sh writes content files or fails to create directories

---

## PF-004 — No placeholder content

**Trigger:** `/create-package` completes for any package
**Expected:** Every generated file contains content specific to the stated package purpose — not generic templates, not "TODO: fill this in", not market-modeling content copied over
**Failure signal:** Phase files, team.md, or command files contain placeholder text or market-modeling-specific content

---

## PF-005 — Correct type pattern

**Trigger:** User specifies `type=workflow`
**Expected:** Generated package has `.claude/commands/`, `.claude/workflow-team-library/`, `<name>-run.sh` using `claude --print`, `add-to-project.sh` using rsync
**Failure signal:** Package uses `.claude/skills/` structure or `install.sh` pattern (tool pattern, not workflow)

**Trigger:** User specifies `type=tool`
**Expected:** Generated package has `<name>.sh` with `--mode` dispatcher, `install.sh` copying to `.claude/skills/`, hooks-snippet.json with relevant hooks
**Failure signal:** Package uses workflow-team-library or `claude --print` runner

---

## PF-006 — Tests are specific

**Trigger:** `/create-package` completes
**Expected:** `tests/test_scenarios.sh` contains grep checks specific to the generated package content — checking for phrases that appear in the phase files or commands, not generic patterns
**Failure signal:** test_scenarios.sh only checks file existence without validating content; or checks for market-modeling-specific strings

---

## PF-007 — add-to-project.sh works

**Trigger:** `add-to-project.sh /tmp/target` is run on a generated workflow package
**Expected:** All `.claude/` files rsync to target, runner script copies and is made executable, runs directory created, prints available commands
**Failure signal:** Files not present in target, runner not executable, or script exits with error
