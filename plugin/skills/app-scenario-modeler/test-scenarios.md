# App Scenario Modeler — Behavioral Tests

These tests verify that the team produces correct, complete output. lead-scenario runs these checks against the output package before writing files.

---

## T1 — Booking App Cascade (from TeleBook brainstorm session)

**Input:**
- APP: telebook
- FEATURE: cascade-appointment-reschedule
- GOAL: When solopreneur moves one appointment, all subsequent appointments that day shift automatically with solopreneur approval
- TARGET USER: non-technical solopreneur (nail tech, esthetician)
- STACK: Python FastAPI, SQLite, Telegram Bot, Brevo SMS, APScheduler
- CONSTRAINTS: closing time 18:00, max chain = same-day only, SMS cost per message, Telegram message length limit
- CASCADE_RISK: yes

**Expected behavior:**
- scenario-discoverer generates minimum 12 scenarios (cascade adds extra)
- Cascade scenarios include: chain fits, chain overflows closing time, cross-day move request, concurrent reschedule collision
- scenario-classifier marks chain-fits and simple-move as CORE; overflow as SECONDARY; cross-day and concurrent as EDGE
- constraint-analyst maps closing time as hard constraint stressing overflow scenarios
- optimisation-strategist recommends slot-lock (pessimistic lock during cascade calculation) for CORE
- edge-cost-analyst cascade file maps: simple move → cascade move → overflow → user decision → SMS batch
- Risk Register has CASCADE OVERFLOW as HIGH with mitigation: "calculate full chain before any DB write; present before/after to solopreneur; YES fires all writes atomically"

**Compliance check:**
- [ ] CASCADE_RISK = yes → cascade file produced
- [ ] Overflow scenario is SECONDARY not EDGE (happens regularly when schedule is full)
- [ ] Cascade chain shows ATOMIC write requirement
- [ ] Non-technical user interaction described in cascade file

---

## T2 — Auth Feature (generic validation)

**Input:**
- APP: generic-saas
- FEATURE: user-login
- GOAL: User authenticates with email + password, receives JWT
- TARGET USER: end consumer
- STACK: Node.js, PostgreSQL, JWT
- CASCADE_RISK: no

**Expected behavior:**
- Happy path: email + password match → JWT issued
- Input variation: wrong password, non-existent email, SQL injection attempt, empty fields
- Concurrency: two simultaneous login attempts from same account
- State conflict: account locked, email unverified, password reset in progress
- External failure: DB down during login, JWT secret rotation mid-session
- Security: brute force, credential stuffing, timing attack on password comparison
- Risk Register: timing attack = CRITICAL → mitigation: constant-time comparison (bcrypt in worker thread)
- CORE optimisation: bcrypt in worker thread to avoid blocking event loop
- FRINGE + CRITICAL: JWT secret compromised → ESCALATE (not SKIP)

**Compliance check:**
- [ ] Security scenarios include timing attack
- [ ] FRINGE + CRITICAL escalated regardless of P_use
- [ ] No cascade file produced (CASCADE_RISK = no)

---

## T3 — Edge Case Calibration

**Verify Expected_impact formula is applied correctly:**

| ID | P_occ | P_fail | Risk | Severity | Expected_impact | Expected decision |
|---|---|---|---|---|---|---|
| E1 | 2% | 80% | HIGH | 1.0 | 0.016 | SKIP (< 0.05, cost High) |
| E2 | 10% | 50% | CRITICAL | 2.0 | 0.10 | MONITOR (0.05–0.15) |
| E3 | 15% | 60% | HIGH | 1.0 | 0.09 | MONITOR (0.05–0.15) |
| E4 | 20% | 75% | CRITICAL | 2.0 | 0.30 | IMPLEMENT MVP (> 0.15, cost Low) |
| E5 | 1% | 90% | CRITICAL | 2.0 | 0.018 | ESCALATE (CRITICAL — never SKIP without sign-off) |

**Compliance check:**
- [ ] E1 correctly SKIP (low impact, high cost)
- [ ] E5 correctly ESCALATE (CRITICAL risk overrides low P_occurrence)
- [ ] No CRITICAL scenario marked SKIP

---

## T4 — Gate Completion Check

Before writing any output file, lead-scenario must confirm all 7 gates in criteria.md pass.

**Simulate:** agent marks Gate 3 as failed (negative case says "returns error" for S4).

**Expected behavior:**
- lead-scenario sends S4 back to scenario-classifier for revision
- scenario-classifier produces specific negative case: "DB write fails → appointment stays at original time → solopreneur sees: 'Could not move Julie, please try again'"
- Gate 3 re-checked → PASS
- File write proceeds

**Compliance check:**
- [ ] Agent does not write files with a failed gate
- [ ] Revision loops back to the responsible agent, not to lead-scenario to fix directly
