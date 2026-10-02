# Code Best Practices & Testing
_Last reviewed: 2026-10-02_

## Code Best Practices

- **NEVER place source files (JS/TS) in `resources/bin/`** — that directory is gitignored and reserved for compiled native binaries (piper, whisper-cli, espeak-ng). Source belongs in `src/`. Sidecar scripts live in `src/main/<name>/index.js`. No exceptions.
- **Do not be conservative** — write complete MVP code; minimal code leaves functions and wiring incomplete.
- **Once functionality is coded, verify it is wired properly and migrations pass.**
- **Do not nest beyond level 1.**
- **Name folders and files according to functionality or task.**
- **1 function = 1 functionality.**

### Code Organization (enforce from first line)

When a section exceeds 1000 lines, create `helpers/` (reusable utilities), `middleware/` (request/response processing), `adapters/` (external integrations), `handlers/` (business logic entry points). Extract a function when it is: used across multiple files, nested beyond level 2, reusable, or when it would keep a file under 1000 lines.

## Testing Philosophy — Real Tests, No Mocks

- **NEVER mock modules with `vi.mock()` / `jest.mock()`.** Tests exercise real code paths with real side effects. Mock boundaries only: external HTTP APIs, third-party SaaS, and Electron's `BrowserWindow` (which needs a running Electron process).
- **Use `vi.fn()` for callbacks and spies** — observe, don't fake.
- **If a test is hard to write without mocks, the code has a design problem** — fix the design (dependency injection, interfaces, smaller functions) instead of papering over it.
- **Integration tests over unit tests.**
- **Test files clean up after themselves** — create temp dirs/sockets/files in `beforeEach`, remove in `afterEach`.
- **ALWAYS run via `npm test`, never `npx vitest`** — the `pretest` script rebuilds `better-sqlite3` for the system Node; `npx vitest` bypasses it and fails with a `NODE_MODULE_VERSION` mismatch. Use `npm test` or `npm test -- path/to/file.test.ts`.
