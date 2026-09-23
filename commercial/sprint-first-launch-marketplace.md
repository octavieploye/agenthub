# Sprint: First-Launch Onboarding + Bundled Workflow Marketplace

_Date: 2026-07-13_
_Status: READY TO BUILD_

---

## Goal

Ship a complete commercial workflow marketplace inside AgentHub:
- First-launch onboarding: browse all workflows with ratings and download counts, pick any 4
- Opeidos OAuth account connection: verified identity for reviews, licenses, purchases
- In-app purchase: add workflows to cart → checkout in browser → workflows auto-install in AgentHub the moment payment is confirmed, with no user action required
- Review incentive: rate and review all 4 installed workflows → unlock 50% off next purchase

---

## Product Decisions (locked)

| Decision | Answer |
|---|---|
| Workflows shown in onboarding | ALL — featured controls sort order only |
| Selection cap | Any 4 |
| Skip allowed | Yes |
| Auth method | Opeidos OAuth via browser + `agenthub://` deep link |
| Free workflow install | Copy from bundled `plugin/marketplace/<id>/` |
| Paid workflow install | Download ZIP from Opeidos CDN (requires valid license) |
| Auto-install after purchase | Yes — zero user action, triggered by deep link + fallback poll |
| Startup sync | Yes — on every launch, compare owned licenses vs installed, auto-install gaps |
| Review requirement for incentive | Star rating (1–5) + written text ≥ 20 chars for all 4 installed workflows |
| Incentive delivery | Opeidos generates unique code per user (applied at cart checkout) |
| Analytics | Local SQLite event log + opt-in export to Opeidos |

---

## Key Architectural Decisions

### 1. Two install modes
```
Free workflow:   plugin/marketplace/<id>/  →  copy  →  userData/workflows/<id>/
Paid workflow:   Opeidos CDN /download     →  unzip →  userData/workflows/<id>/
```
`WorkflowEntry.bundled: boolean` determines which path `MarketplaceService.install()` takes.
`WorkflowEntry.price: number | null` — null = free.

### 2. OAuth deep link
Custom protocol `agenthub://` registered at OS level. Two uses:
- `agenthub://oauth/callback?access_token=xxx` — auth completion
- `agenthub://payment/success?order_id=xxx` — purchase confirmation → auto-install trigger

### 3. Token storage
`settings.set('opeidos_token', token)` and `settings.set('opeidos_user_id', userId)`. All API calls carry `Authorization: Bearer <token>`.

### 4. License sync on launch
On every app start: `GET /licenses` → compare with installed workflows → auto-install any owned but not installed (handles cross-device purchases, interrupted installs).

### 5. SkillsService third origin
```
plugin/skills/       → origin: 'agenthub'    (bundled built-in skills)
.claude/skills/      → origin: 'project'     (project-local)
userData/workflows/  → origin: 'marketplace' (free + paid, installed)
```

---

## Files Touched

### New files
```
plugin/marketplace-catalog.json
plugin/marketplace/<workflow-id>/                          — free workflow skill files
src/main/db/migrations/035-onboarding-events.sql
src/main/db/migrations/036-workflow-reviews.sql
src/main/services/marketplace-service.ts
src/main/services/opeidos-auth-service.ts
src/main/services/onboarding-analytics-service.ts
src/main/ipc/marketplace.ipc.ts
src/main/ipc/auth.ipc.ts
src/renderer/src/widgets/onboarding-screen/OnboardingScreen.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowCard.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowReviewModal.tsx
src/renderer/src/widgets/onboarding-screen/WorkflowFeedbackCard.tsx
src/renderer/src/widgets/onboarding-screen/DiscountUnlockModal.tsx
src/renderer/src/widgets/marketplace-panel/MarketplacePanel.tsx
src/renderer/src/widgets/cart-panel/CartPanel.tsx
src/renderer/src/widgets/auth-connect/OpeidsConnectBanner.tsx
src/renderer/src/stores/marketplace-store.ts
src/renderer/src/stores/auth-store.ts
src/renderer/src/stores/cart-store.ts
src/shared/types/marketplace.types.ts
src/shared/types/auth.types.ts
```

### Modified files
```
src/shared/constants/ipc-channels.ts
src/main/index.ts                           — deep link handler registration
src/main/services/skills-service.ts         — third origin scan
src/main/services/service-orchestrator.ts   — wire new services
electron-builder.yml                        — register agenthub:// protocol
src/renderer/src/widgets/sa-bar/SABar.tsx   — marketplace + cart icons
src/renderer/src/App.tsx                    — onboarding gate + auth init
```

---

## Sprint Phases

---

### Phase 0 — Types, Catalog, Migrations

**0A — Shared types** (`src/shared/types/marketplace.types.ts`)

```typescript
export type WorkflowCategory =
  | 'code-quality' | 'market-intel' | 'competitor-analysis'
  | 'content-voice' | 'legal' | 'security' | 'onboarding'
  | 'icon-builder' | 'teams'

export interface WorkflowEntry {
  id: string
  name: string
  tagline: string              // ≤ 80 chars
  description: string
  category: WorkflowCategory
  agentCount: number
  estimatedMinutes: number
  featured: boolean            // sort order only
  avgRating: number            // 0–5
  reviewCount: number
  downloadCount: number
  price: number | null         // null = free; number = EUR cents (e.g. 1900 = €19)
  bundled: boolean             // true = files in plugin/marketplace/<id>/; false = download from Opeidos
}

export interface MarketplaceCatalog {
  version: string
  updatedAt: string
  workflows: WorkflowEntry[]
}

export interface InstalledWorkflow {
  id: string
  installedAt: string
  skillCount: number
}

export interface WorkflowLicense {
  workflowId: string
  owned: boolean
  purchasedAt: string | null
}

export interface WorkflowReview {
  id: string
  workflowId: string
  rating: number               // 1–5
  reviewText: string           // ≥ 20 chars
  submittedAt: string
  synced: boolean
}

export interface CartItem {
  workflowId: string
  name: string
  price: number                // EUR cents
}

export interface DownloadProgress {
  workflowId: string
  percent: number              // 0–100
  status: 'downloading' | 'extracting' | 'done' | 'error'
  error?: string
}

export type OnboardingEventType =
  | 'onboarding_started' | 'step_advanced'
  | 'workflow_selected' | 'workflow_deselected'
  | 'onboarding_completed' | 'onboarding_skipped'
  | 'workflow_run' | 'workflow_review_submitted'
  | 'incentive_unlocked' | 'discount_code_copied'
  | 'purchase_initiated' | 'purchase_completed'
  | 'auto_install_triggered' | 'auto_install_completed'

export interface IncentiveStatus {
  installedCount: number
  reviewedCount: number
  unlocked: boolean
  discountCode: string | null
}
```

**`src/shared/types/auth.types.ts`**

```typescript
export interface OpeidsUser {
  id: string
  email: string
  displayName: string
  avatarUrl?: string
}

export interface AuthState {
  connected: boolean
  user: OpeidsUser | null
  token: string | null
}
```

**0B — IPC channels**

```typescript
MARKETPLACE: {
  GET_CATALOG:         'marketplace:get-catalog',
  GET_INSTALLED:       'marketplace:get-installed',
  INSTALL:             'marketplace:install',
  UNINSTALL:           'marketplace:uninstall',
  GET_LICENSES:        'marketplace:get-licenses',
  SUBMIT_REVIEW:       'marketplace:submit-review',
  GET_REVIEWS:         'marketplace:get-reviews',
  GET_INCENTIVE:       'marketplace:get-incentive',
  CREATE_CHECKOUT:     'marketplace:create-checkout',
  SYNC_LICENSES:       'marketplace:sync-licenses',   // manual re-sync trigger
},
AUTH: {
  GET_STATE:           'auth:get-state',
  CONNECT:             'auth:connect',                // opens browser OAuth
  DISCONNECT:          'auth:disconnect',
},
ONBOARDING: {
  LOG_EVENT:           'onboarding:log-event',
  GET_EVENTS:          'onboarding:get-events',
  EXPORT:              'onboarding:export',
}
```

IPC Events (push from main → renderer):
```typescript
MARKETPLACE: {
  DOWNLOAD_PROGRESS:   'on-marketplace:download-progress',  // DownloadProgress
  INSTALL_COMPLETE:    'on-marketplace:install-complete',   // { workflowId }
  LICENSES_SYNCED:     'on-marketplace:licenses-synced',    // WorkflowLicense[]
},
AUTH: {
  STATE_CHANGED:       'on-auth:state-changed',             // AuthState
}
```

**0C — Migration 035** (`src/main/db/migrations/035-onboarding-events.sql`)

```sql
CREATE TABLE IF NOT EXISTS onboarding_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  workflow_id  TEXT,
  payload_json TEXT,
  occurred_at  TEXT NOT NULL
);
```

**0D — Migration 036** (`src/main/db/migrations/036-workflow-reviews.sql`)

```sql
CREATE TABLE IF NOT EXISTS workflow_reviews (
  id           TEXT PRIMARY KEY,
  workflow_id  TEXT NOT NULL,
  rating       INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  review_text  TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  synced       INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_reviews_workflow_id
  ON workflow_reviews(workflow_id);
```

**0E — Bundled catalog** (`plugin/marketplace-catalog.json`)

Free workflows have `"bundled": true, "price": null`. Paid workflows have `"bundled": false, "price": 1900` (cents). For Phase 1, all workflows are free and bundled. Paid flag is set when Opeidos payment infra is live.

---

### Phase 1 — Backend: Auth Service

**`src/main/services/opeidos-auth-service.ts`**

```typescript
class OpeidsAuthService {
  getState(): AuthState
  connect(): void              // opens browser OAuth URL
  disconnect(): void           // clears token + user from settings
  getToken(): string | null
  handleCallback(url: string): Promise<void>   // parses agenthub://oauth/callback
}
```

`connect()`: calls `shell.openExternal('https://opeidos.com/auth/agenthub?redirect_uri=agenthub://oauth/callback')`.

`handleCallback(url)`:
1. Parse `access_token` and `user_id` from URL params
2. `GET https://api.opeidos.com/me` with token → validate + get user profile
3. `settings.set('opeidos_token', token)`
4. `settings.set('opeidos_user', JSON.stringify(user))`
5. Emit `on-auth:state-changed` to all renderer windows

`disconnect()`: deletes `opeidos_token` and `opeidos_user` from settings, emits state change.

**Modify `src/main/index.ts`** — register protocol + deep link handler:

```typescript
// Register custom protocol (dev mode only — production handles via electron-builder)
if (process.defaultApp) {
  app.setAsDefaultProtocolClient('agenthub', process.execPath, [path.resolve(process.argv[1])])
} else {
  app.setAsDefaultProtocolClient('agenthub')
}

// Mac: app already running
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleDeepLink(url)
})

// Windows/Linux: second instance
app.on('second-instance', (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith('agenthub://'))
  if (url) handleDeepLink(url)
})

function handleDeepLink(url: string): void {
  if (url.startsWith('agenthub://oauth/callback')) {
    authService.handleCallback(url)
  } else if (url.startsWith('agenthub://payment/success')) {
    const orderId = new URL(url).searchParams.get('order_id')
    if (orderId) marketplaceService.handlePaymentSuccess(orderId)
  }
}
```

**Modify `electron-builder.yml`** — register protocol:

```yaml
mac:
  protocols:
    - name: AgentHub
      schemes: [agenthub]
win:
  protocols:
    - name: AgentHub
      schemes: [agenthub]
linux:
  protocols:
    - name: AgentHub
      schemes: [agenthub]
```

---

### Phase 2 — Backend: MarketplaceService (full)

**`src/main/services/marketplace-service.ts`**

```typescript
class MarketplaceService {
  // Catalog
  getCatalog(): MarketplaceCatalog

  // Install
  getInstalled(): InstalledWorkflow[]
  install(workflowId: string): Promise<void>     // async — may download
  uninstall(workflowId: string): void

  // Licenses
  getLicenses(): Promise<WorkflowLicense[]>      // GET /licenses from Opeidos
  syncLicenses(): Promise<void>                  // fetch owned → auto-install any gap

  // Purchase
  createCheckout(items: CartItem[], discountCode?: string): Promise<string>  // returns checkout URL
  handlePaymentSuccess(orderId: string): Promise<void>

  // Reviews
  submitReview(workflowId: string, rating: number, reviewText: string): WorkflowReview
  getReviews(): WorkflowReview[]
  getReview(workflowId: string): WorkflowReview | null

  // Incentive
  getIncentiveStatus(): IncentiveStatus
}
```

**`install(workflowId)`** — two-path logic:

```typescript
async install(workflowId: string): Promise<void> {
  const entry = this.getCatalog().workflows.find(w => w.id === workflowId)
  if (!entry) throw new WorkflowNotFoundError(workflowId)

  if (entry.bundled) {
    // Free: copy from plugin/marketplace/<id>/
    await copyDir(
      path.join(this.pluginPath, 'marketplace', workflowId),
      path.join(this.userDataPath, 'workflows', workflowId)
    )
  } else {
    // Paid: download ZIP from Opeidos CDN
    await this.downloadAndExtract(workflowId)
  }

  fs.writeFileSync(
    path.join(this.userDataPath, 'workflows', workflowId, '.installed-at'),
    new Date().toISOString()
  )
}
```

**`downloadAndExtract(workflowId)`**:
1. `GET https://api.opeidos.com/workflows/<id>/download` with Bearer token
2. Stream response to temp file, emit `on-marketplace:download-progress` at each chunk
3. On complete: extract ZIP to `userData/workflows/<id>/`
4. Delete temp file
5. Emit `on-marketplace:install-complete` with `{ workflowId }`
6. Trigger `skills:refresh` broadcast to all renderer windows

**`syncLicenses()`** — called on every app launch:
1. If not authenticated: skip
2. `GET /licenses` → array of `WorkflowLicense`
3. Compare owned workflow IDs vs installed workflow IDs
4. For each owned but not installed: call `install(workflowId)` silently
5. Emit `on-marketplace:licenses-synced`

**`handlePaymentSuccess(orderId)`**:
1. `GET /orders/<orderId>/licenses` → new licenses from this order
2. Call `install(workflowId)` for each (shows progress toast per workflow)
3. Stop fallback poll if running

**`createCheckout(items, discountCode?)`**:
1. `POST /checkout` with `{ items: [{ workflowId, price }], discountCode }` + Bearer
2. Returns `checkoutUrl` from LemonSqueezy
3. Caller does `shell.openExternal(checkoutUrl)`
4. Caller starts fallback poll: `setInterval(() => syncLicenses(), 5000)` — runs for 2min max

---

### Phase 3 — Frontend Stores

**`src/renderer/src/stores/auth-store.ts`**

```typescript
interface AuthStore {
  connected: boolean
  user: OpeidsUser | null
  loading: boolean
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  init: () => Promise<void>      // called on app mount — loads saved state
}
```

Listens to `on-auth:state-changed` IPC event and updates store.

**`src/renderer/src/stores/cart-store.ts`**

```typescript
interface CartStore {
  items: CartItem[]
  discountCode: string | null
  add: (item: CartItem) => void
  remove: (workflowId: string) => void
  applyDiscount: (code: string) => void
  removeDiscount: () => void
  total: () => number            // computed: sum of prices minus discount
  clear: () => void
  checkout: () => Promise<void>  // calls marketplace:create-checkout → shell.openExternal
}
```

**`src/renderer/src/stores/marketplace-store.ts`**

```typescript
interface MarketplaceStore {
  catalog: WorkflowEntry[]
  installed: Set<string>
  licenses: Map<string, WorkflowLicense>
  installing: Set<string>
  downloadProgress: Map<string, DownloadProgress>
  reviews: Map<string, WorkflowReview>
  incentiveStatus: IncentiveStatus | null
  loading: boolean
  fetchCatalog: () => Promise<void>
  fetchInstalled: () => Promise<void>
  fetchLicenses: () => Promise<void>
  fetchReviews: () => Promise<void>
  fetchIncentive: () => Promise<void>
  install: (id: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
  submitReview: (id: string, rating: number, text: string) => Promise<void>
  logEvent: (event: OnboardingEvent) => void
}
```

Listens to:
- `on-marketplace:download-progress` → updates `downloadProgress` map
- `on-marketplace:install-complete` → moves id from `installing` to `installed`, refreshes skills
- `on-marketplace:licenses-synced` → refreshes `licenses` + `installed`

---

### Phase 4 — Frontend: Auth UI

**`src/renderer/src/widgets/auth-connect/OpeidsConnectBanner.tsx`**

Shown in `MarketplacePanel` header when not authenticated:

```
┌──────────────────────────────────────────┐
│ Connect your Opeidos account to purchase │
│ workflows and sync your reviews.         │
│                  [Connect Opeidos →]     │
└──────────────────────────────────────────┘
```

When connected, banner is replaced by:
```
● octavie@opeidos.com        [Disconnect]
```

**Modify SABar** — right zone additions:

```
[🏪 Marketplace]  [🛒 2]  [📖 Skills]  [⚙ Settings]  [? Help]
                    ↑
              cart badge count (hidden when empty)
```

---

### Phase 5 — Frontend: Marketplace Panel + Cart

**`src/renderer/src/widgets/marketplace-panel/MarketplacePanel.tsx`**

```
┌──────────────────────────────────────────┐
│  WORKFLOW MARKETPLACE              [×]   │
│  ────────────────────────────────────── │
│  [OpeidsConnectBanner or user badge]     │
│  ────────────────────────────────────── │
│  [Search workflows...]                   │
│  ────────────────────────────────────── │
│  FEATURED                                │
│  [WorkflowCard] [WorkflowCard]           │
│  ────────────────────────────────────── │
│  CODE QUALITY       ▸                   │
│  MARKET INTEL       ▼                   │
│    [WorkflowCard]                        │
│  ...                                     │
│  ────────────────────────────────────── │
│  [Export feedback data →]  (opt-in)      │
└──────────────────────────────────────────┘
```

**`WorkflowCard` states:**

| State | Button shown |
|---|---|
| Not authenticated + paid | `[Connect to buy]` |
| Authenticated, not owned, free | `[Install ▸]` |
| Authenticated, not owned, paid | `[Add to cart  €19]` |
| In cart | `[✓ In cart]  [Remove]` |
| Downloading | `[▓▓▓░░ 42%]` progress bar |
| Owned + not installed | `[Installing...]` (auto, no button needed) |
| Installed, no review | `[Write a Review ★]` |
| Installed + reviewed | `★ Your rating: 4  [Edit]` |

Card always shows: `★ avgRating (reviewCount reviews) · downloadCount installs`

**`src/renderer/src/widgets/cart-panel/CartPanel.tsx`**

Slide-in panel from SABar cart icon:

```
┌──────────────────────────────────────────┐
│  YOUR CART                          [×]  │
│  ────────────────────────────────────── │
│  Market Intelligence               €19   │
│  Landing Page Lab                  €14   │
│  ────────────────────────────────────── │
│  [Discount code...]         [Apply]      │
│  ────────────────────────────────────── │
│  Subtotal                          €33   │
│  Discount (REVIEW50 -50%)        -€16.50 │
│  ────────────────────────────────────── │
│  Total                           €16.50  │
│                                          │
│  [Checkout →]                            │
│  Opens opeidos.com in your browser       │
│  Workflows install automatically         │
│  after payment is confirmed.             │
└──────────────────────────────────────────┘
```

"Checkout →": calls `cart.checkout()` → main process `createCheckout()` → `shell.openExternal(url)`. AgentHub remains open in background. No spinner — the user is in the browser. When payment completes, workflows auto-install and a toast appears.

**Auto-install toast sequence** (one per workflow, bottom-right):
```
⟳ Downloading Market Intelligence...
✓ Market Intelligence installed — ready in Skills dropdown
⟳ Downloading Landing Page Lab...
✓ Landing Page Lab installed — ready in Skills dropdown
```

---

### Phase 6 — Onboarding Screen

Same as previously scoped, with these additions:

- `OpeidsConnectBanner` shown at top of Step 2 when not authenticated (non-blocking — user can still pick free workflows without connecting)
- Free workflows in onboarding: install on "Install & Launch" (bundled copy, instant)
- Paid workflows selected in onboarding: if not authenticated → prompt to connect; if authenticated and owned → install; if authenticated and not owned → redirect to checkout first, then onboarding completes after install

Incentive reminder banner (Step 2):
```
★ Rate all 4 workflows after use → unlock 50% off your next purchase
```

---

### Phase 7 — Review Flow + Incentive

Same as previously scoped. Key addition: when `submitReview()` syncs to Opeidos (`POST /reviews`), the Opeidos backend updates the live `avgRating` and `reviewCount` for that workflow on the marketplace listing. The bundled catalog stub values are replaced by live data on next catalog fetch.

`WorkflowReviewModal` progress tracker:
```
Progress toward your 50% discount:
■ ■ □ □   2 of 4 workflows reviewed
```

`DiscountUnlockModal`: discount code is now fetched from Opeidos (`GET /incentives/discount`) rather than hard-coded. Opeidos generates a unique single-use code per user. Code is pre-applied in cart automatically when detected.

---

### Phase 8 — Startup License Sync

In `service-orchestrator.ts`, after services are initialized and window is ready:

```typescript
// Non-blocking background sync on every launch
if (authService.getState().connected) {
  marketplaceService.syncLicenses().catch((err) => {
    logInfo('License sync failed on launch', { err })
    // silent — user sees no error, retry on next launch
  })
}
```

If any gap found (owned but not installed): install silently, emit toast when done.
If all in sync: no UI feedback.

---

### Phase 9 — Tests

**`opeidos-auth-service.test.ts`**:
- `connect()` calls `shell.openExternal` with correct Opeidos OAuth URL
- `handleCallback()` with valid URL stores token and user in settings
- `handleCallback()` with missing token throws `AuthCallbackError`
- `disconnect()` clears token and user, emits state change
- `getState()` returns `connected: false` when no token stored

**`marketplace-service.test.ts`**:
- `install()` on bundled workflow copies files from `plugin/marketplace/<id>/`
- `install()` on non-bundled workflow calls `downloadAndExtract`
- `install()` writes `.installed-at` file
- `downloadAndExtract()` emits `download-progress` events at intervals
- `downloadAndExtract()` emits `install-complete` on success
- `downloadAndExtract()` emits `install-complete` with error on failure
- `syncLicenses()` calls `install()` for each owned-but-not-installed workflow
- `syncLicenses()` skips already-installed workflows
- `handlePaymentSuccess()` fetches order licenses and installs each
- `createCheckout()` POST to Opeidos and returns URL
- `submitReview()` rejects rating out of range or text < 20 chars
- `getIncentiveStatus()` unlocked only when all 4 installed workflows are reviewed

**`CartPanel.test.tsx`**:
- Shows all cart items with prices
- Discount code field applies discount to total
- Total updates correctly with and without discount
- "Checkout" button calls `cart.checkout()`
- Shows "Workflows install automatically after payment" copy

**`WorkflowCard.test.tsx`**:
- Shows correct button state for each of the 7 states
- Download progress bar renders when `downloadProgress` present
- "Add to cart" adds item to `cartStore`
- "Install" triggers `marketplaceStore.install()`
- Shows `avgRating`, `reviewCount`, `downloadCount`

**`OnboardingScreen.test.tsx`** — same as previous scope.

---

## What Is NOT in This Sprint

- Opeidos backend (API endpoints, webhook handlers, license DB) — parallel build, not AgentHub work
- Subscription/recurring billing (all workflows are one-time purchase for now)
- Workflow versioning and update notifications
- Analytics dashboard view
- Uninstall from Skills dropdown (MarketplacePanel only)

---

## Opeidos API Contract (what AgentHub expects)

These endpoints must exist on the Opeidos side for the integration to work:

```
GET  /me                                    → OpeidsUser
GET  /licenses                              → WorkflowLicense[]
GET  /orders/<orderId>/licenses             → WorkflowLicense[]
GET  /workflows/<id>/download               → ZIP stream (requires valid license)
POST /checkout                              → { checkoutUrl: string }
POST /reviews                               → { ok: true }
GET  /incentives/discount                   → { code: string } or 404
GET  /catalog                               → MarketplaceCatalog (Phase 2 — replaces bundled JSON)
```

Auth header on all requests: `Authorization: Bearer <token>`

---

## Open Questions (all answered)

| Question | Answer |
|---|---|
| Auth method | Opeidos OAuth, browser-based, `agenthub://` deep link callback |
| Free workflow install | Bundled copy — instant, no download |
| Paid workflow install | Download from Opeidos CDN — streamed with progress |
| Auto-install after payment | Yes — deep link primary, 5s poll fallback, startup sync as safety net |
| User action required after payment | None — fully automatic |
| Incentive code source | Opeidos API generates unique per-user code |
| Cart | Local Zustand store, multi-item, single checkout call |
| Discount pre-applied | Yes — fetched from Opeidos and pre-filled in cart when available |
