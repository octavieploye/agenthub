# AgentHub — Commercial Security & Build Requirements
_Source: 4-agent review (Architect, Senior Backend, Senior Frontend, Security/DevOps)_
_Date: 2026-07-13_
_Security verdict: DO NOT BUILD AS SPECCED — resolve all Critical items before writing implementation code_

---

## Security Features to Add (AgentHub)

These must be resolved before any developer writes implementation code. Items marked CRITICAL are independently sufficient paths to remote code execution.

### CRITICAL — Blocks implementation start

1. **[CRITICAL] ZIP path traversal guard (Zip Slip — CWE-22)** — before writing any ZIP entry to disk, resolve the full output path and assert it begins with `path.resolve(userData, 'workflows', workflowId) + path.sep`. Abort the entire extraction and delete the temp file if any entry fails. Never use shell `unzip` — use `yauzl` which exposes filenames before writing

2. **[CRITICAL] ZIP integrity verification** — after download completes, compute SHA256 of the temp file and compare against the `X-Content-SHA256` header from Opeidos. Verify the Opeidos ECDSA signature against the public key embedded in the app bundle. Abort extraction if mismatch. Do not extract a ZIP that has not been verified

3. **[CRITICAL] Marketplace skill injection boundary** — marketplace `.md` files must NOT auto-inject via `--append-system-prompt-file`. They must only be invocable when the user explicitly selects and runs them from the Skills dropdown. The third `SkillsService` origin still scans and indexes them, but they never reach the agent system prompt automatically. A malicious `.md` file injected into all agent sessions under `--dangerously-skip-permissions` is full RCE

4. **[CRITICAL] OAuth state/nonce (PKCE)** — generate a cryptographic nonce locally before calling `shell.openExternal(oauthUrl)`. Store it in memory. Validate it on `handleCallback()`. Discard any callback that arrives without a matching nonce. Discard any callback arriving more than 5 minutes after `connect()` was initiated

5. **[CRITICAL] Token storage via OS Keychain** — use `safeStorage.encryptString(token)` / `safeStorage.decryptString()` instead of `settings.set('opeidos_token', token)`. The Bearer token must never touch the SQLite `settings` table. It must never be visible in `settings:get-all`, `settings:export`, or any log file

6. **[CRITICAL] Token excluded from renderer** — remove `token: string | null` from `AuthState` and `AuthStore`. The renderer only knows `connected: boolean` and `user: OpeidsUser`. All token-bearing requests go through IPC to the main process only. A renderer with access to the token is a credential leak vector

### HIGH — Must fix before paid workflows ship

7. **[HIGH] `settings:get-all` / `settings:export` blocklist** — strip any key matching `*_token`, `*_secret`, `*_key`, `*_password` before returning to the renderer or export file

8. **[HIGH] `settings:import` blocklist** — reject writes to any key matching `*_token` via the import path. A crafted import payload can otherwise silently overwrite credentials

9. **[HIGH] `setWindowOpenHandler` URL allowlist** — validate `details.url` is `https://` scheme and hostname ends in `.lemonsqueezy.com` or `.opeidos.com` before calling `shell.openExternal`. Reject everything else silently

10. **[HIGH] `checkoutUrl` validation** — validate scheme + hostname of the URL returned by `POST /checkout` before opening in browser. Same allowlist as above

11. **[HIGH] Deep link session window** — discard any `agenthub://oauth/callback` that arrives without an active connect session or more than 5 minutes after one was initiated. Discard any `agenthub://payment/success` that arrives without an active checkout session. Log all rejected deep links

12. **[HIGH] WorkflowId format validation** — validate `workflowId` against `/^[a-z0-9][a-z0-9-]{0,63}$/` before any file operation. Reject any ID containing `.`, `/`, `\`, or `..`. This prevents path traversal at the directory level, separate from the ZIP entry traversal in item 1

13. **[HIGH] 401 handling in `syncLicenses()`** — on 401 response from `/licenses`, clear the stored token and user, emit `on-auth:state-changed` with `{ connected: false }`. Do not silently swallow auth errors. Distinguish 401 (must notify user) from 5xx/network errors (silent retry acceptable)

14. **[HIGH] `app.requestSingleInstanceLock()`** — must be called before `app.whenReady()` in `src/main/index.ts`. Without it, the `second-instance` event never fires on Windows/Linux and the payment deep link never reaches the running app

15. **[HIGH] Remove `allow-dyld-environment-variables` entitlement** — remove from `build/entitlements.mac.plist`. This entitlement allows `DYLD_INSERT_LIBRARIES` injection into the main process. Verify `allow-unsigned-executable-memory` is also required before keeping it

16. **[HIGH] Notarization** — `notarize: false` in `electron-builder.yml:36` must become a completed Apple Developer ID signing + notarization flow before any paid user installs the app. Hard blocker for macOS commercial distribution

17. **[HIGH] ZIP bomb protection** — track cumulative decompressed bytes during extraction. Abort and delete the temp file if total exceeds 100MB or 500 files per workflow

18. **[HIGH] HTTP timeout on all Opeidos calls** — wrap every `fetch()` to `api.opeidos.com` with `AbortController` and a 10-second timeout. Without this, a slow or unreachable Opeidos API blocks the startup sync indefinitely

### MEDIUM — Fix before public launch

19. **[MEDIUM] CSP headers** — add `session.defaultSession.webRequest.onHeadersReceived` in `src/main/index.ts` to enforce a Content-Security-Policy on the renderer. Prevents renderer-side script injection

20. **[MEDIUM] `checkoutUrl` scheme validation** — already in HIGH #10, but also add at the IPC handler level before the value reaches the renderer

21. **[MEDIUM] Token redaction in error logs** — add `opeidos_*` key patterns to the token redaction list already used in `agent-manager.ts` line 219. All Opeidos service error paths must strip `Authorization: Bearer ...` before logging

22. **[MEDIUM] `navigator.clipboard` availability check** — in `DiscountUnlockModal`, verify `navigator.clipboard` is available in the Electron sandbox before using it. Fall back to `electron.clipboard.writeText()` via an IPC call if not

23. **[MEDIUM] `publish.url` placeholder** — `electron-builder.yml:51` has `url: https://example.com/auto-updates`. Replace with the real signed update endpoint before any build is distributed. Auto-updates pulling from `example.com` is a takeover risk if that domain is ever acquired

---

## Architecture Changes (Resolve Before Building)

### 1. Marketplace Skill Injection Boundary (CRITICAL redesign)

The sprint plan routes all three skill origins into `--append-system-prompt-file`. This must change.

**Current (unsafe):**
```
plugin/skills/      → --append-system-prompt-file (always)
.claude/skills/     → --append-system-prompt-file (always)
userData/workflows/ → --append-system-prompt-file (always) ← CRITICAL RISK
```

**Required (safe):**
```
plugin/skills/      → --append-system-prompt-file (always — trusted, bundled)
.claude/skills/     → --append-system-prompt-file (always — trusted, user-owned)
userData/workflows/ → Skills dropdown only — explicit user invocation required
                      Never auto-appended to agent system prompt
```

`SkillsService` still scans `userData/workflows/` and indexes the skills (so they appear in the dropdown). The difference is that marketplace skills are never passed to `--append-system-prompt-file` on agent spawn. They are only injected when the user explicitly selects and runs them from the Skills dropdown.

### 2. Fallback Poll Moved to Main Process

**Current spec (unsafe — renderer owns interval):**
```typescript
// cart-store.ts — WRONG
checkout: async () => {
  await window.agentHub.marketplace.createCheckout(items)
  setInterval(() => syncLicenses(), 5000)  // ← lost on unmount
}
```

**Required (main process owns interval):**
```typescript
// marketplace-service.ts — CORRECT
async createCheckout(items, discountCode?) {
  const url = await this.callOpeidos('POST /checkout', { items, discountCode })
  this.startFallbackPoll()   // internal, cancellable
  return url
}

private startFallbackPoll() {
  let elapsed = 0
  const poll = setInterval(async () => {
    elapsed += 5000
    if (elapsed >= 120000) { clearInterval(poll); return }
    await this.syncLicenses()
  }, 5000)
  this.activePoll = poll
}

handlePaymentSuccess(orderId) {
  if (this.activePoll) clearInterval(this.activePoll)
  // ... fetch order licenses and install
}
```

### 3. Token Never in Renderer

Remove `token` field from `AuthState` (auth.types.ts) and `AuthStore` (auth-store.ts). The renderer should never hold or see the raw Bearer token.

**In `auth.types.ts`:**
```typescript
// Remove this:
export interface AuthState {
  connected: boolean
  user: OpeidsUser | null
  token: string | null  // ← DELETE
}

// Replace with:
export interface AuthState {
  connected: boolean
  user: OpeidsUser | null
}
```

The `on-auth:state-changed` IPC event must broadcast only the above shape — never include the token.

---

## Backend Service Requirements

### `opeidos-auth-service.ts`

```typescript
class OpeidsAuthService {
  getState(): AuthState                         // connected + user only, no token
  connect(): void                               // generates nonce, stores in memory, opens browser
  disconnect(): void                            // clears keychain token + user from settings
  getToken(): string | null                     // reads from safeStorage — main process only
  handleCallback(url: string): Promise<void>    // validates nonce, calls /me, stores via safeStorage
}
```

`connect()` must:
1. Generate a cryptographic nonce (`crypto.randomBytes(32).toString('hex')`)
2. Store nonce + timestamp in memory (not DB)
3. Call `shell.openExternal(oauthUrl + `&state=${nonce}&code_challenge=...`)`

`handleCallback(url)` must:
1. Parse `state` from URL — reject immediately if missing or not matching in-memory nonce
2. Reject if nonce is older than 5 minutes
3. Parse `access_token` — reject if missing, emit `on-auth:callback-error`
4. `GET /me` with token — if fails, emit `on-auth:callback-error`, do NOT store token
5. On success: `safeStorage.encryptString(token)` → store encrypted buffer as base64 in settings
6. Store `opeidos_user` (non-sensitive) in settings
7. Clear nonce from memory
8. Emit `on-auth:state-changed` with `{ connected: true, user }`

### `marketplace-service.ts`

```typescript
class MarketplaceService {
  getCatalog(): MarketplaceCatalog
  getInstalled(): InstalledWorkflow[]
  install(workflowId: string): Promise<void>          // two-path: bundled copy OR download+verify+extract
  uninstall(workflowId: string): void                 // checks inProgress guard first
  getLicenses(): Promise<WorkflowLicense[]>           // reads from local DB
  syncLicenses(): Promise<void>                       // GET /licenses + auto-install gaps
  createCheckout(items: CartItem[], discount?: string): Promise<string>
  handlePaymentSuccess(orderId: string): Promise<void>
  submitReview(workflowId: string, rating: number, reviewText: string): Promise<WorkflowReview>
  getReviews(): WorkflowReview[]
  getReview(workflowId: string): WorkflowReview | null
  getIncentiveStatus(): IncentiveStatus
}
```

`install(workflowId)` must:
1. Validate `workflowId` against `/^[a-z0-9][a-z0-9-]{0,63}$/` — throw on invalid
2. Check `inProgress` set — return early if already installing (idempotent)
3. Check `.installed-at` file — return early if already installed (idempotent)
4. Add to `inProgress`
5. If `entry.bundled`: copy from `plugin/marketplace/<id>/`
6. If not bundled: call `downloadAndVerifyAndExtract(workflowId)`
7. Write `.installed-at` timestamp
8. Add to `installed_workflows` DB table
9. Remove from `inProgress`
10. Emit `on-marketplace:install-complete`
11. Trigger skills refresh

`downloadAndVerifyAndExtract(workflowId)` must:
1. `GET /workflows/<id>/manifest` → get expected SHA256 + ECDSA signature
2. Verify ECDSA signature against embedded Opeidos public key — abort if invalid
3. Write temp file to `userData/downloads-in-progress/<id>.zip`
4. Stream `GET /workflows/<id>/download`, emit progress events (max 10/sec), enforce 100MB size limit
5. After download: compute SHA256 of temp file — abort if mismatch with manifest
6. Extract ZIP entries one by one — validate each entry path before writing (zip-slip guard)
7. Track cumulative extracted bytes — abort if > 100MB or > 500 files
8. On any error: `fs.unlink(tempFilePath)` in `finally` block, remove partial `userData/workflows/<id>/`
9. On success: delete temp file

`syncLicenses()` must:
1. Skip if not authenticated
2. Skip if last sync was < 60 seconds ago (check `last_license_sync_at` in settings)
3. `GET /licenses` with 10s timeout
4. On 401: clear token, emit `on-auth:state-changed` with `connected: false`, return
5. On 5xx/network error: log, return (silent)
6. Compare owned IDs vs `installed_workflows` table
7. For each gap: call `install(workflowId)` (respects inProgress guard)
8. Update `last_license_sync_at` in settings
9. Emit `on-marketplace:licenses-synced` only if license set changed

`submitReview()` must:
1. Validate `rating` in 1–5, `reviewText.trim().length >= 20`
2. Write to `workflow_reviews` table (`INSERT OR REPLACE ... ON CONFLICT(workflow_id) DO UPDATE`)
3. Return the saved review immediately (synchronous local write)
4. In background: `POST /reviews` to Opeidos. On success: set `synced = 1`. On failure: leave `synced = 0` for retry
5. Check `getIncentiveStatus()` — if newly unlocked, call `GET /incentives/discount`, store code, emit unlock event

---

## Database Requirements

### Migration 035 — `onboarding_events`
```sql
CREATE TABLE IF NOT EXISTS onboarding_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  workflow_id  TEXT,
  payload_json TEXT,
  occurred_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_workflow_id
  ON onboarding_events(workflow_id);

CREATE INDEX IF NOT EXISTS idx_onboarding_events_occurred_at
  ON onboarding_events(occurred_at);
```

### Migration 036 — `workflow_reviews`
```sql
CREATE TABLE IF NOT EXISTS workflow_reviews (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text  TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  synced       INTEGER NOT NULL DEFAULT 0
);

-- One review per workflow (upsert model — edit replaces, does not duplicate)
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_reviews_workflow_id
  ON workflow_reviews(workflow_id);

-- For background sync retry queries
CREATE INDEX IF NOT EXISTS idx_workflow_reviews_synced
  ON workflow_reviews(synced);
```

`submitReview()` insert pattern:
```sql
INSERT INTO workflow_reviews (id, workflow_id, rating, review_text, submitted_at, synced)
VALUES (?, ?, ?, ?, ?, 0)
ON CONFLICT(workflow_id) DO UPDATE SET
  rating = excluded.rating,
  review_text = excluded.review_text,
  submitted_at = excluded.submitted_at,
  synced = 0;
```

### Migration 037 — `installed_workflows`
```sql
CREATE TABLE IF NOT EXISTS installed_workflows (
  id           TEXT PRIMARY KEY,   -- workflowId
  installed_at TEXT NOT NULL,      -- ISO 8601
  version      TEXT,
  origin       TEXT NOT NULL DEFAULT 'marketplace'
);
```
`install()` writes to this table AND writes `.installed-at` file. `getInstalled()` reads from this table. Filesystem tracking alone is fragile (Time Machine restores, userData path changes).

### Migration numbering
Migration 034 (`034-agent-spawn-metadata.sql`) exists. Before adding 035, verify the migration runner handles the sequence correctly. If a migration 034 was not yet merged, add a no-op placeholder.

---

## IPC Requirements

### New channels to add to `src/shared/constants/ipc-channels.ts`

```typescript
// Add to IPC_CHANNELS:
MARKETPLACE: {
  GET_CATALOG:       'marketplace:get-catalog',
  GET_INSTALLED:     'marketplace:get-installed',
  INSTALL:           'marketplace:install',
  UNINSTALL:         'marketplace:uninstall',
  GET_LICENSES:      'marketplace:get-licenses',    // read local DB only — no network
  SYNC_LICENSES:     'marketplace:sync-licenses',   // fetch from API + install gaps
  SUBMIT_REVIEW:     'marketplace:submit-review',
  GET_REVIEWS:       'marketplace:get-reviews',
  GET_INCENTIVE:     'marketplace:get-incentive',
  CREATE_CHECKOUT:   'marketplace:create-checkout',
},
AUTH: {
  GET_STATE:         'auth:get-state',
  CONNECT:           'auth:connect',
  DISCONNECT:        'auth:disconnect',
},
ONBOARDING: {
  LOG_EVENT:         'onboarding:log-event',
  GET_EVENTS:        'onboarding:get-events',
  EXPORT:            'onboarding:export',
},

// Add to IPC_EVENTS:
MARKETPLACE: {
  DOWNLOAD_PROGRESS: 'on-marketplace:download-progress',
  INSTALL_COMPLETE:  'on-marketplace:install-complete',
  LICENSES_SYNCED:   'on-marketplace:licenses-synced',
  REVIEW_SYNCED:     'on-marketplace:review-synced',
},
AUTH: {
  STATE_CHANGED:     'on-auth:state-changed',
  CALLBACK_ERROR:    'on-auth:callback-error',
},
```

### `marketplace:get-licenses` vs `marketplace:sync-licenses`
These are distinct and must never be conflated:
- `GET_LICENSES` = read from `installed_workflows` local DB table only. No network call. Fast
- `SYNC_LICENSES` = `GET /licenses` from Opeidos API + compare + auto-install gaps + emit `licenses-synced`

### `register-all.ts`
Add `marketplace.ipc.ts` and `auth.ipc.ts` imports to `src/main/ipc/register-all.ts`. If this is missed, zero marketplace or auth IPC handlers will register and no commercial feature will function.

### `on-marketplace:download-progress` throttle
Throttle progress event emissions to max 10 per second on the main-process emitter side. Download chunks on a fast local network can arrive dozens of times per second. Without throttling, this approaches the IPC flood threshold documented in crash debugging (100 msg/s).

### `on-marketplace:licenses-synced` emit condition
Only emit this event when the license set actually changes compared to the previous sync. Do NOT emit on every poll tick. The fallback poll fires 24 times in 2 minutes — emitting `licenses-synced` on every tick causes 48 unnecessary renderer refreshes.

---

## Frontend Requirements

### Auth Store (`auth-store.ts`)
```typescript
interface AuthStore {
  connected: boolean
  user: OpeidsUser | null          // no token field
  loading: boolean
  error: string | null             // must be present — used when callback fails
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  init: () => () => void           // returns cleanup function for IPC listener teardown
}
```

`init()` registers `on-auth:state-changed` and `on-auth:callback-error` listeners. Returns an unsubscribe function. `App.tsx` calls `init()` in a `useEffect` and uses the return value as the cleanup.

### Marketplace Store (`marketplace-store.ts`)

Replace `loading: boolean` with per-operation flags:
```typescript
loadingOps: {
  catalog: boolean
  installed: boolean
  licenses: boolean
  reviews: boolean
  incentive: boolean
}
```

All `Set` and `Map` mutations must use copy-on-write — never mutate in place:
```typescript
// WRONG:
state.installed.add(id)

// CORRECT:
set({ installed: new Set([...state.installed, id]) })
```

```typescript
// WRONG:
state.downloadProgress.set(id, progress)

// CORRECT:
set({ downloadProgress: new Map([...state.downloadProgress, [id, progress]]) })
```

`init()` registers all marketplace IPC push event listeners and returns a cleanup function. `App.tsx` calls it in `useEffect`.

### Cart Store (`cart-store.ts`)
- No `setInterval` in cart store — poll lives in main process (`MarketplaceService`)
- Remove `total: () => number` method — compute total in component via selector on `items` and `discountCode`
- Discount code pre-apply side effect lives in `marketplaceStore.fetchIncentive()` which calls `cartStore.applyDiscount(code)` if a code is returned. Document this cross-store dependency explicitly

### WorkflowCard (`WorkflowCard.tsx`)
- Must use `React.memo` with a custom equality function comparing only its own `workflowId`'s entry in `downloadProgress`. Without this, every download progress update re-renders all 20+ cards in the grid
- Add state 8: Install failed — show red border, error message, `[Retry]` button that calls `marketplaceStore.install(id)`
- `aria-pressed` for onboarding selection state
- `aria-label="Rating: {avgRating} out of 5 ({reviewCount} reviews)"` on the star rating element

### WorkflowReviewModal (`WorkflowReviewModal.tsx`)
- Show character counter: `{reviewText.trim().length} / 20 minimum`
- Submit button disabled until `rating >= 1 && reviewText.trim().length >= 20`
- Show incentive progress: `■ ■ □ □  2 of 4 workflows reviewed`

### SABar (`SABar.tsx`)
- Group marketplace + cart icons, or hide them below a minimum window width threshold
- Adding 2 icons to the existing 6-icon right zone will overflow at narrow window widths
- Cart badge: use DaisyUI `indicator` pattern — `<div class="indicator"><span class="indicator-item badge badge-primary badge-xs">{count}</span><button>...</button></div>`
- Marketplace and Cart icons should appear AFTER Skills Index, not before (preserve muscle memory for existing users)

### OnboardingScreen (`OnboardingScreen.tsx`)
- Default `isFirstLaunch` to `false` if settings load fails — fail open (show the app, not the gate)
- Cap initial render to 20 workflows with a "Show more" button if catalog grows beyond that
- `role="dialog"` `aria-modal="true"` on the full-screen container
- ARIA live region announcing selection count: `{selected} of 4 selected`
- Keyboard navigation: Tab through cards, Space/Enter to select, arrow keys to navigate grid

### IPC Listener Cleanup Pattern
All store `init()` functions must follow this pattern:
```typescript
// In store:
init: () => {
  const unsub1 = window.agentHub.on['marketplace:download-progress']((progress) => { ... })
  const unsub2 = window.agentHub.on['marketplace:install-complete']((data) => { ... })
  return () => { unsub1(); unsub2() }   // cleanup function
}

// In App.tsx:
useEffect(() => {
  const cleanup = useMarketplaceStore.getState().init()
  return cleanup
}, [])
```

---

## Electron Configuration Checklist

### Already correct (verify before launch)
- [x] `sandbox: true` — `src/main/index.ts` line 60
- [x] `contextIsolation: true` — line 61
- [x] `nodeIntegration: false` — line 62
- [x] `webSecurity: true` — line 63
- [x] DevTools disabled in production — lines 73–77

### Must add/fix
- [ ] `app.requestSingleInstanceLock()` before `app.whenReady()` — deep links broken on Windows/Linux without this
- [ ] `setWindowOpenHandler` URL allowlist — currently passes all URLs to `shell.openExternal`
- [ ] CSP via `session.defaultSession.webRequest.onHeadersReceived`
- [ ] `agenthub://` protocol registration in `electron-builder.yml` under `mac.protocols`, `win.protocols`, `linux.protocols`
- [ ] Linux deep link note: AppImage and snap require a `.desktop` file — if Linux is supported, document or descope deep link support for Linux users. Fallback: "Sync licenses" button that calls `marketplace:sync-licenses`
- [ ] `notarize: false` → complete Apple notarization
- [ ] Remove `allow-dyld-environment-variables` from `build/entitlements.mac.plist`
- [ ] Replace `publish.url: https://example.com/auto-updates` with real signed endpoint

---

## Phase Ordering Constraints (for dev agent)

1. Phase 0 (types + migrations) → must complete before any other phase
2. Phase 1 (auth service) → must complete before Phase 2 (marketplace service needs auth token)
3. Phase 2 (marketplace service) → must complete before Phase 3 (stores call marketplace IPC)
4. Phase 3 (stores) → can be built in parallel with Phase 4 (auth UI) after Phase 2
5. Phase 5 (marketplace panel) + Phase 6 (onboarding) → require Phase 3 stores complete
6. Phase 6 paid-workflow-in-onboarding path → gates on Phase 2 complete AND Opeidos backend live. Ship Phase 6 with free-only selection first. Paid selection is Phase 6B
7. Phase 7 (reviews + incentive) → requires `GET /incentives/discount` on Opeidos side. Add fallback state to `DiscountUnlockModal` if endpoint unreachable
8. Phase 8 (startup sync) → wire into `mainWindow.on('ready-to-show')` callback, not before window exists. Merge into Phase 2 service wiring — do not touch `service-orchestrator.ts` twice
