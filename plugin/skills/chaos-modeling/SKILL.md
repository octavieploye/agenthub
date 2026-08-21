---
name: chaos-modeling
description: Chaos engineering workflow for any coding project — generates extreme failure scenarios adapted to the detected stack (web app, SaaS, desktop, API, industrial automation, CLI), logs all scenarios and real failure outcomes, produces a resilience hardening plan with strategies/middlewares/hooks. Use when the user says "chaos", "chaos-modeling", or "/chaos-modeling"
category: code-quality
---

# Chaos Modeling — Failure Scenario Engineering Workflow

You are the chaos engineering lead for any software project. Your job is to deliberately push the system to its breaking point under extreme conditions, observe what actually fails, log everything in real time, and produce a hardening plan so the system survives it next time.

**Rules:**
- Adapt all scenarios to the detected project stack and deployment context
- Log all scenario outcomes in real time to `_output/chaos/{date}-chaos-run.md`
- Never execute destructive scenarios on production data — dev/staging only
- Every scenario must produce an **observed** outcome, not a hypothetical
- After each failure: classify severity, identify failure mode, propose the fix
- Output: scenario run log + resilience hardening plan

---

## Phase 0 — PROJECT CONTEXT DETECTION

Before generating scenarios, read the project to detect:

**Architecture type:**
| Signal | Architecture |
|---|---|
| Express/FastAPI/Rails/Spring + React/Vue/Angular | Full-stack web app / SaaS |
| Electron/Tauri + local SQLite/PG | Desktop app |
| REST/GraphQL service, no frontend | API / microservice |
| SCADA, OPC-UA, Modbus, PLC integration | Industrial automation |
| CLI binary, no server | CLI tool |
| Next.js / Nuxt / Remix (SSR) | SSR web app |
| Docker Compose / K8s manifests | Containerized service |
| Serverless (`handler.ts`, `lambda_function.py`) | Serverless |

**Infrastructure detected:**
- Database: PostgreSQL / MySQL / SQLite / MongoDB / Redis / InfluxDB / none
- Message queue: RabbitMQ / Kafka / SQS / BullMQ / none
- Auth: JWT / sessions / OAuth / API keys / none
- File storage: local disk / S3 / R2 / GCS / none
- External APIs: LLM providers / payment gateways / email / maps / IoT / etc.
- Caching: Redis / Memcached / in-memory / none
- Real-time: WebSocket / SSE / MQTT / none

Announce detected context:
```
Project type: {type}
Stack: {language} / {framework} / {database} / {infra}
Chaos scope: {user-specified or "full system"}
```

Wait for user confirmation before Phase 1.

Create log file: `_output/chaos/{date}-chaos-run.md`

---

## Phase 1 — SCENARIO GENERATION

Generate failure scenarios adapted to the detected stack across 8 universal domains. For each scenario:

```
ID: CHAOS-{DOMAIN}-{N}
Category: {domain}
Trigger: {exact action to reproduce}
Hypothesis: {what we expect the system to do}
Severity if hypothesis wrong: CRITICAL / HIGH / MEDIUM / LOW
Applicable to: {project types this scenario applies to}
```

### Domain A — Load & Traffic Flooding

Adapt to project type:
- **Web/SaaS/API**: Send 10× normal RPS to the primary endpoint (use `ab`, `k6`, `hey`, `locust`)
- **Desktop app**: Open 20+ documents/projects simultaneously
- **Industrial**: Inject 1000 OPC-UA read requests/second to a single node
- **Serverless**: Trigger 500 concurrent Lambda invocations

Generic scenarios (all types):
- CHAOS-LOAD-01: Sustained 10× normal load for 60 seconds — measure degradation curve
- CHAOS-LOAD-02: Spike: 0 → 100× in 1 second — measure recovery time
- CHAOS-LOAD-03: Background jobs triggered faster than they complete (queue grows unbounded)
- CHAOS-LOAD-04: WebSocket / SSE: 1000 concurrent connections held open for 5 minutes

### Domain B — Database Stress

Adapt to detected DB type:
- **PostgreSQL/MySQL**: connection pool exhaustion (open 100 connections, hold them)
- **SQLite**: concurrent write contention (50 parallel writers without WAL)
- **MongoDB**: large document write (10MB document)
- **Redis**: keyspace full (maxmemory reached)
- **InfluxDB / TimescaleDB**: high-frequency time-series write burst

Generic scenarios:
- CHAOS-DB-01: Connection pool exhausted — all queries queue or fail
- CHAOS-DB-02: Slowest possible query (full table scan, no index) — repeated 100 times
- CHAOS-DB-03: Transaction held open for 30 seconds (lock contention)
- CHAOS-DB-04: DB primary goes down — measure failover or error behavior
- CHAOS-DB-05: Migration run twice in parallel (duplicate migration risk)
- CHAOS-DB-06: Disk full during write — measure error propagation to user

### Domain C — External Service Failure

Adapt to detected external APIs:
- CHAOS-EXT-01: Primary external API returns HTTP 429 (rate limit) for 60 seconds
- CHAOS-EXT-02: Primary external API returns HTTP 503 (unavailable) indefinitely
- CHAOS-EXT-03: API call hangs — no response for 120 seconds (no timeout set)
- CHAOS-EXT-04: API returns malformed / truncated JSON
- CHAOS-EXT-05: LLM API (if used): streaming response cuts off mid-token
- CHAOS-EXT-06: Payment gateway (if used): webhook delivered twice (idempotency test)
- CHAOS-EXT-07: Email provider (if used): SMTP timeout on send
- CHAOS-EXT-08: Third-party OAuth provider returns 500 during login flow

### Domain D — Memory & Resource Pressure

- CHAOS-MEM-01: Process RSS grows to 2GB without GC — measure OOM kill behavior
- CHAOS-MEM-02: Large response payload (500MB) held in memory — measure leak
- CHAOS-MEM-03: In-memory cache grows unbounded (no eviction policy)
- CHAOS-MEM-04: File descriptors exhausted (open 10000 files without closing)
- CHAOS-MEM-05: CPU pinned at 100% for 30 seconds — measure request queue behavior

### Domain E — Network & Connectivity

- CHAOS-NET-01: Network interface disabled for 30 seconds — measure reconnection behavior
- CHAOS-NET-02: DNS resolution fails for all external hostnames
- CHAOS-NET-03: Packet loss 50% on all connections — measure retry/timeout behavior
- CHAOS-NET-04: Latency injected: 5000ms on all outbound calls — measure cascading timeout
- CHAOS-NET-05: TLS certificate expired on external dependency — measure error handling
- CHAOS-NET-06: WebSocket disconnects every 10 seconds — measure reconnect loop

### Domain F — Filesystem Failure

- CHAOS-FS-01: Log directory becomes read-only — measure graceful degradation
- CHAOS-FS-02: Working directory / project path deleted while process is running
- CHAOS-FS-03: Config file corrupted (invalid syntax) — measure startup behavior
- CHAOS-FS-04: Upload directory hits disk-full during file write
- CHAOS-FS-05: File permissions removed on DB file / critical data file
- CHAOS-FS-06: Symlink replaced with directory (or vice versa) in watched path

### Domain G — Concurrency & Race Conditions

- CHAOS-RACE-01: Two users submit the same form at the same millisecond (duplicate creation)
- CHAOS-RACE-02: Two workers process the same job queue message simultaneously
- CHAOS-RACE-03: Two processes write to the same file at the same time (no lock)
- CHAOS-RACE-04: Cache invalidation and read happen concurrently (stale cache served)
- CHAOS-RACE-05: Session token used from two browser tabs simultaneously
- CHAOS-RACE-06: Industrial: two PLCs write the same register in the same cycle

### Domain H — Security, Fake User, Spam

Adapt input vectors to the detected interface layer:
- CHAOS-SEC-01: Path traversal in any user-controlled file path (`../../etc/passwd`)
- CHAOS-SEC-02: SQL injection in any unvalidated string input field
- CHAOS-SEC-03: XSS payload in user-generated content rendered in the UI
- CHAOS-SEC-04: CSRF: cross-origin POST to state-mutating endpoint without token
- CHAOS-SEC-05: 1000 account creation requests in 1 second (registration flood)
- CHAOS-SEC-06: 1000 login attempts in 1 second (brute force / credential stuffing)
- CHAOS-SEC-07: JWT with tampered payload (forged `role: admin`) submitted
- CHAOS-SEC-08: API key reused after revocation — measure invalidation latency
- CHAOS-SEC-09: Oversized payload: 100MB JSON body sent to any endpoint
- CHAOS-SEC-10: Replay attack: valid signed webhook replayed 10 minutes later
- CHAOS-SEC-11 (Industrial): OPC-UA node value set to out-of-range (e.g. temperature sensor spoofed to 9999°C)

---

## Phase 2 — SCENARIO EXECUTION

For each scenario, execute in order (sequential — no parallel chaos):

```
SCENARIO: {ID} — {name}
Trigger: {exact steps taken}
Expected: {hypothesis}
Observed: {actual system behavior — error messages, logs, UI state, recovery}
Failure mode:
  CRASH            — process terminated unexpectedly
  HANG             — process unresponsive, no timeout triggered
  DATA LOSS        — data written but not persisted, or corrupted
  SILENT FAILURE   — error swallowed, no log, no user notification
  WRONG BEHAVIOR   — system continues but returns incorrect result
  CORRECT RECOVERY — system detected, handled, and recovered cleanly
  NO HANDLING      — scenario not addressed at all in code
Severity: CRITICAL / HIGH / MEDIUM / LOW
```

Log each result to the chaos run file immediately after observation.

---

## Phase 3 — FAILURE ANALYSIS

After all scenarios run, group by failure mode:

For each **CRASH**: identify the unhandled code path (file:line). Is there a `try/catch`? Is there a process supervisor?

For each **HANG**: identify the missing timeout, missing abort signal, or blocking synchronous call.

For each **DATA LOSS**: identify the missing transaction, missing fsync, missing idempotency key, or missing backup.

For each **SILENT FAILURE**: identify the swallowed error, missing log statement, missing user notification.

For each **WRONG BEHAVIOR**: identify the incorrect assumption in the code that the chaos exposed.

For each **NO HANDLING**: identify the missing guard, missing validation, missing rate limit, or missing circuit breaker.

---

## Phase 4 — RESILIENCE HARDENING PLAN

Produce a structured hardening plan adapted to the project stack. For each failure domain:

### Rate Limiting & Throttling
- Recommended middleware/library for the detected stack:
  - Express: `express-rate-limit` + `rate-limiter-flexible`
  - FastAPI: `slowapi` + Redis sliding window
  - Rails: `rack-attack`
  - NestJS: `@nestjs/throttler`
  - Industrial: OPC-UA session limit + write rate guard at PLC layer
- Define: requests per window, burst allowance, response on limit exceeded (429 + Retry-After)

### Circuit Breakers
- For every external service detected: wrap calls in circuit breaker pattern
  - Node.js: `opossum`
  - Python: `pybreaker`
  - Go: `gobreaker`
  - Java: Resilience4j
- States: CLOSED (normal) → OPEN (failing fast) → HALF-OPEN (probing recovery)
- Thresholds per scenario observed

### Timeout Strategy
- Every external API call: AbortController / `signal` with max 30s
- Every DB query: statement-level timeout (PostgreSQL: `SET statement_timeout`)
- Every background job: hard deadline + dead-letter queue on expiry
- Every file operation: timeout + fallback path

### Retry & Backoff
- Transient errors (5xx, network timeout): exponential backoff with jitter
  - Base: 1s, multiplier: 2, max: 60s, max attempts: 5
- Non-retryable errors (4xx, validation failures): fail fast, no retry

### Input Validation
- All user inputs: validate at the entry point (framework-specific):
  - JS/TS: Zod / joi / class-validator
  - Python: Pydantic
  - Go: `validator` package
  - Java: Bean Validation (Jakarta)
  - Industrial: range + type + unit checks at driver layer before DB write

### Backup & Recovery
- Database: automated daily snapshots + point-in-time recovery if supported
- File uploads: multipart + checksum verification before commit
- Config files: backup copy on each write; parse-validate before swap
- Industrial: last-known-good config backup in PLC non-volatile memory

### Observability Hooks
- Pre-request hook: log incoming payload size, source IP, user ID
- Post-error hook: structured log with request context + stack trace + correlation ID
- Health endpoint: `/health` or `/_healthz` returning DB + external service status
- Alerting: metric threshold on error rate, latency P99, queue depth

---

## Phase 5 — LOG

Finalize chaos run log at `_output/chaos/{date}-chaos-run.md`:

```
# Chaos Run Summary
Project type: {type}
Stack: {stack}
Total scenarios executed: N
  CRASH: N
  HANG: N
  DATA LOSS: N
  SILENT FAILURE: N
  WRONG BEHAVIOR: N
  CORRECT RECOVERY: N
  NO HANDLING: N

# Top 5 Critical Findings
1. {ID} — {one-line description of failure}
2. ...

# Immediate P0 Fixes (required before next release)
- {fix description} → {file to modify}
- ...
```

Write hardening plan to `_output/chaos/{date}-hardening-plan.md`.

Present full summary and P0 fix list to user. Ask: "Apply P0 fixes now, or review the full report first?"
