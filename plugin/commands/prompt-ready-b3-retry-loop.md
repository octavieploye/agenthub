```
Repo: /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub
Skill: /team-dev-loop
Model: Sonnet 4.6 (complexity score: 18.5)

Scope: BUG B3 — Orchestrator infinite retry loop on agent early exit. 2 issues:
  1. Agents exit in ~15 seconds without producing files (root cause)
  2. Orchestrator retries indefinitely spawning ~20 dead agents (missing safeguard)

READ BEFORE STARTING:
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/kanban-orchestrator.ts (dispatch + retry + completion logic)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/orchestrator-rules.ts (GUARDRAIL_PROMPTS.simple, OPERATING_RULES.maxPhaseRetries)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/agent-manager.ts (agent spawn, triage event emission at line ~270)
- /Users/octaviesmacpro/workspace/optimaeus-stacks/agenthub/src/main/services/auto-triage.ts (isTaskCompleted classification)

INVESTIGATION STEPS — follow in order:

Step 1 — Trace the 15-second exit classification:
- In auto-triage.ts, isTaskCompleted = (currentStatus === 'completed'). An agent that exits cleanly in 15s fires agent:completed, which calls onAgentCompleted (line 1833).
- onAgentCompleted calls advancePhase (line 1873) which marks dev as done and dispatches review, then security, then commit — even if the agent wrote ZERO files.
- Confirm: does advancePhase blindly advance through dev -> review -> security -> commit without checking if the agent actually modified files? Read advancePhase at line 1010.

Step 2 — Trace the commit failure -> retry path:
- executeCommitPhase runs git diff/commit. If nothing to commit, what happens? Read executeCommitPhase fully.
- If commit fails, the task log status becomes 'failed'. Then dispatchNextTasks (line 1099) checks for failed logs at line 1152 and re-dispatches the failed phase.
- The retry cap is maxPhaseRetries=3 (orchestrator-rules.ts line 126). But the retry counter is keyed as `${taskId}:${phase}`. If the COMMIT phase fails and re-dispatches DEV, the new dev dispatch gets a DIFFERENT retry key (`taskId:dev`), potentially resetting the counter.
- Check: does the retry loop create a cycle where dev->review->security->commit(fail)->dev->review->security->commit(fail) each time resets the per-phase counters?

Step 3 — Check the simple path (B-path) flow:
- dispatchSimplePath (line 714) spawns [simple] agents. These use GUARDRAIL_PROMPTS.simple which instructs the agent to call report_files_changed MCP tool AND print DONE.
- B-1 sentinel check (line 1947) requires DONE in last 20 lines. B-2 path (line 1935) requires report_files_changed with a files array.
- If the agent exits in 15 seconds without calling report_files_changed and without printing DONE, it triggers agent:completed (PTY exit) at line 1833. The agent is still tracked in simplePathModes. Does onAgentCompleted handle the case where a B-path agent exits via PTY without going through the B-1/B-2 path?
- Read onAgentCompleted carefully: line 1840 checks activeLog. If the agent is B-path, it should have been handled by onAgentStatusChanged. But if the agent EXITS (process dies) instead of going to locked state, onAgentStatusChanged never fires for 'locked', so onAgentCompleted fires instead and calls advancePhase — treating a dead agent as successful completion.

Step 4 — Identify the root cause of the 15-second exit:
- The agents were spawned as Haiku with --effort medium for a scaffolding task (create files from scratch in an empty repo).
- Haiku with medium effort may produce a plan/response but not actually write files, then exit.
- Check if the target repo had a CLAUDE.md or .claude/ directory — without project instructions, the agent may have no context on what to create.
- Check if --mcp-config was correct — without kanban MCP, the agent cannot call report_files_changed.

Step 5 — Fix both issues:

FIX A — Prevent treating zero-output agents as successful:
- In onAgentCompleted, before calling advancePhase, check if the agent is a B-path agent (simplePathModes.has(agentId)). If yes, it should NOT advance via advancePhase — it should be treated as failed (the B-1/B-2 completion signals were never received).
- Add: if simplePathModes has the agentId and onAgentCompleted fires (meaning PTY exited without going through locked -> B-1/B-2), mark the task log as 'failed' and clean up simplePathModes. Do NOT call advancePhase.

FIX B — Prevent infinite retry across phase boundaries:
- The retry counter keys on `${taskId}:${phase}`. A commit failure that re-dispatches dev creates key `taskId:dev` while the commit failure was `taskId:commit`. Each phase gets 3 independent retries = up to 15 agent spawns (5 phases x 3 retries) per cycle, and the cycle itself may repeat.
- Add a TASK-LEVEL retry counter (not just phase-level). After N total failed agent spawns for a taskId (across all phases), mark the task as permanently failed. Recommended: maxTotalRetries = 6 (two full cycles).
- Add this to OPERATING_RULES in orchestrator-rules.ts.

FIX C — Add minimum runtime guard:
- An agent that exits in < 30 seconds almost certainly did not do useful work. Add a duration check in onAgentCompleted: if the agent ran for less than MIN_USEFUL_RUNTIME_MS (e.g. 30000), treat it as failed regardless of exit status.
- This catches the Haiku-exits-after-plan pattern and any future model that produces text but does not write files.

Output: Modified files in src/main/services/

Constraints:
- Do NOT change GUARDRAIL_PROMPTS content — that is sec-devops territory
- Do NOT change maxPhaseRetries value (3) — only ADD maxTotalRetries
- The B-path early-exit fix (Fix A) is the highest priority — it prevents the infinite loop
- Run existing orchestrator tests: npm test -- src/main/services/kanban-orchestrator
- Write at least 1 new test: B-path agent that exits via PTY without DONE/report_files_changed should be marked failed, not advanced
- Do NOT touch agent-manager.ts unless strictly necessary for the fix
```
