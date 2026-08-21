---
name: frontend-wire-verifier
description: Verifies all frontend-to-backend wiring in any coding project — REST endpoints, GraphQL, WebSockets, IPC/Tauri, gRPC, SSE, event bus. Detects missing handlers, type mismatches, unguarded calls. Adapts to the project's detected communication layer. Use when the user says "verify wiring", "frontend-wire-verifier", or "/frontend-wire-verifier"
category: frontend
---

# Frontend–Backend Wire Verifier — 4-Phase Workflow

You are verifying the complete wiring contract between the frontend (UI layer) and the backend (data/service layer) in any project. Every frontend call must have a matching backend handler, the types must align, and errors must be handled on both sides.

**Rules:**
- Read-only audit first. Fix only after user approves the mismatch list.
- Output report to `_output/wire-report-{date}.md` (or `docs/` if that convention exists)
- All mismatches ranked: CRITICAL (broken/missing) → HIGH (type unsafe) → MEDIUM (missing guard) → LOW (unused/dead)

---

## Phase 0 — COMMUNICATION LAYER DETECTION

Read the project files to detect the communication pattern(s) in use:

| Signal | Layer detected |
|---|---|
| `fetch`, `axios`, `ky`, `got` + route files | REST HTTP |
| `graphql`, `apollo`, `urql`, `relay` | GraphQL |
| `WebSocket`, `socket.io`, `ws`, `ably` | WebSockets / real-time |
| `ipcRenderer.invoke`, `ipcMain.handle` | Electron IPC |
| `invoke` (Tauri) | Tauri commands |
| `grpc-web`, `@grpc/grpc-js` | gRPC |
| `EventSource`, `readableStream` | Server-Sent Events (SSE) |
| `EventEmitter`, `mitt`, `tiny-emitter` | In-process event bus |
| Database SDK called directly from frontend | Direct DB (flag as CRITICAL risk) |

A project may use multiple layers simultaneously. Map all of them.

Announce to user:
```
Communication layers detected:
  - REST HTTP (axios — src/api/*.ts → src/routes/*.ts)
  - WebSocket (socket.io — src/socket/client.ts → src/socket/server.ts)
  - [additional layers]
Proceed? (yes / correct me)
```

---

## Phase 1 — MAP

For each detected communication layer, dispatch a mapper agent:

### mapper-frontend
Scope: frontend source directory (auto-detected)

Collect every outbound call from the frontend:

**REST:** URL string + HTTP method + request body type + response type expected
**GraphQL:** operation name + variables type + expected response shape
**WebSocket:** event names emitted + payload types, event names listened + expected payload types
**Electron IPC:** channel names invoked + payload type + expected return type
**Tauri:** command names + argument types + expected return type
**gRPC:** service + method + request message type
**SSE:** endpoint URL + event types listened

For each call, also record:
- Is the error case handled? (`.catch()`, `try/catch`, error state, toast/notification)
- Is a loading state shown while the call is in-flight?
- Is the call made at module scope (before framework mounts)?
- File:line

Output: `frontend-call-map.json`

### mapper-backend
Scope: backend/server source directory (auto-detected)

Collect every handler registered on the backend:

**REST:** route path + HTTP method + input validation (Zod/Joi/Pydantic/class-validator) + response type
**GraphQL:** resolver name + input type + return type + auth guard
**WebSocket:** event names listened on server + payload type, events emitted from server
**Electron IPC:** channel names handled + input validation + return type
**Tauri:** command names + parameter types + return type + permissions
**gRPC:** service + method + request/response message types
**SSE:** endpoint + event types emitted

For each handler, record:
- Is input validated?
- Is authentication/authorization checked?
- Is the error case returned with a typed error response?
- File:line

Output: `backend-handler-map.json`

---

## Phase 2 — DIFF

Single agent compares both maps for each communication layer:

**For each frontend call:**
1. No matching backend handler → **CRITICAL**: orphaned frontend call (will fail at runtime)
2. Handler exists, payload types mismatch → **HIGH**: type contract broken
3. Handler exists, no input validation → **HIGH**: unvalidated input (security + reliability risk)
4. Handler exists, no auth guard on protected resource → **CRITICAL**: authorization gap
5. Error not handled on frontend → **MEDIUM**: unguarded call (silent failure)
6. Call at module scope → **HIGH**: race condition on mount
7. Handler exists, all checks pass → OK

**For each backend handler:**
1. No frontend caller found → **LOW**: dead handler (flag, do not delete without confirmation)
2. Handler has auth guard but frontend sends no credentials → **HIGH**: will 401 at runtime

**Additional cross-cutting checks:**
- Are all API base URLs environment-variable driven (not hardcoded)?
- Are all WebSocket/SSE connections closed on component unmount?
- Do all long-polling or streaming calls have timeout/abort signals?
- Are all GraphQL mutations optimistic-updated on frontend if backend is slow?
- Are response shapes validated on the frontend before use? (runtime type narrowing)

Output: full diff report in `_output/wire-report-{date}.md` with all findings ranked.

---

## Phase 3 — FIX (gated by user approval)

Present the diff report to user. Ask: "Fix all mismatches now, or review first?"

On approval, dispatch fix agents:
- **fix-types** — aligns types on both sides of each mismatch
- **fix-handlers** — adds missing handlers or marks dead ones for removal (user confirms each removal)
- **fix-guards** — adds missing error handling on frontend calls, adds input validation on backend handlers, adds auth checks where missing
- **fix-wiring** — closes open connections on unmount, moves module-scope calls inside lifecycle hooks, adds abort signals

After fixes:
- Run type check (if TypeScript): must be 0 errors
- Run test suite: no new failures

---

## Phase 4 — LOG

Write final report to `_output/wire-report-{date}.md`:

| Finding Type | Count | Fixed | Deferred |
|---|---|---|---|
| Orphaned frontend calls | — | — | — |
| Type mismatches | — | — | — |
| Missing auth guards | — | — | — |
| Unvalidated inputs | — | — | — |
| Unguarded error paths | — | — | — |
| Race conditions (module scope) | — | — | — |
| Unclosed connections | — | — | — |
| Dead handlers | — | — | — |

Present table to user.
