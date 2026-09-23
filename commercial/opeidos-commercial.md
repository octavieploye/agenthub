# Opeidos — Commercial Build Requirements
_Source: 4-agent review (Architect, Senior Backend, Senior Frontend, Security/DevOps)_
_Date: 2026-07-13_

---

## Security Features to Add (Opeidos Backend)

These must be implemented before any AgentHub integration goes live. They are not optional hardening — they are the security contract that AgentHub depends on.

1. **Server-side price validation** — never trust the price sent by AgentHub in `POST /checkout`. Always look up the canonical price from your own catalog using `workflowId`. Reject the request if the client-supplied price does not match
2. **orderId ownership check** — `GET /orders/<orderId>/licenses` must verify the order belongs to the authenticated user before returning any data. Return 403 if the order belongs to a different user
3. **License gate on download** — `GET /workflows/<id>/download` must verify a valid license exists for the authenticated user before serving the ZIP. Return 403 if not owned
4. **Signed hash for ZIP integrity** — every workflow ZIP must have a corresponding SHA256 hash signed with an Opeidos ECDSA private key. The signed hash must be served from a separate endpoint (`GET /workflows/<id>/manifest`), NOT from the same CDN bucket that serves the ZIP. A CDN compromise that replaces the ZIP must not also be able to replace the hash
5. **OAuth PKCE support** — the `/auth/agenthub` OAuth endpoint must support PKCE (`code_challenge`, `code_challenge_method=S256`). Validate the `state` parameter on every callback redirect. Reject callbacks with missing or mismatched state
6. **Rate limiting on all endpoints** — `GET /licenses` will be called on every AgentHub app launch per authenticated user. Apply rate limiting with `Retry-After` and `X-RateLimit-*` response headers across all endpoints
7. **Content security review gate** — all workflow `.md` files submitted by creators must pass a mandatory security review before appearing in the catalog. A creator account delivering a malicious prompt injection payload is a mass-RCE vector against all AgentHub users. No workflow may be listed without review approval
8. **CDN write protection** — the CDN bucket serving workflow ZIPs must not be publicly writable. Rotate signing keys immediately on any suspected CDN compromise. Use content-addressed storage (hash-named objects) so a replaced file at the same path is detectable
9. **`GET /incentives/discount` response contract** — return `{ unlocked: false }` (HTTP 200) when the incentive is not yet earned. Do NOT return 404 — AgentHub cannot distinguish "not yet earned" from "endpoint does not exist" on a 404
10. **Unique discount codes** — generate a unique single-use LemonSqueezy coupon code per user when all 4 workflows are reviewed. Hard-coded shared codes (`REVIEW50`) are not acceptable in production — they can be shared and abused
11. **HTTPS enforcement** — all API endpoints must be HTTPS only. The domain `api.opeidos.com` must use a valid TLS certificate from a recognised CA. No endpoint should be reachable over plain HTTP
12. **Domain ownership continuity** — if `opeidos.com` ever lapses, AgentHub's `handleCallback()` will send user tokens to whoever acquires the domain. Maintain domain registration proactively. Implement certificate pinning guidance for AgentHub once the domain is established

---

## API Endpoints to Build

All endpoints require `Authorization: Bearer <token>` except the OAuth initiation route.

### Authentication
```
GET  /auth/agenthub
     → Initiates OAuth flow. Accepts: ?redirect_uri=agenthub://oauth/callback&state=<nonce>&code_challenge=<pkce>
     → Redirects to: agenthub://oauth/callback?access_token=<token>&user_id=<id>&state=<nonce>

GET  /me
     → Returns: { id: string, email: string, displayName: string, avatarUrl?: string }
     → Used by AgentHub immediately after callback to validate the token
     → Returns 401 if token is invalid or expired
```

### Licenses
```
GET  /licenses
     → Returns: WorkflowLicense[]  — all workflows owned by the authenticated user
     → Shape: [{ workflowId: string, owned: true, purchasedAt: string }]
     → Note: only return owned licenses. The `owned` field is always true in this response (no false entries)
     → Called on every AgentHub launch — must be fast and rate-limited

GET  /orders/<orderId>/licenses
     → Returns: WorkflowLicense[]  — licenses from a specific order
     → Must verify orderId belongs to the authenticated user — return 403 if not
     → Called by AgentHub immediately after payment confirmation deep link
```

### Workflow Download
```
GET  /workflows/<id>/download
     → Returns: ZIP file stream (Content-Type: application/zip)
     → Required headers on response:
         Content-Length: <bytes>
         X-Content-SHA256: <sha256-hex>          ← AgentHub verifies this before extraction
     → Must verify the authenticated user holds a valid license for <id>
     → Return 403 if no license. Return 404 if workflow does not exist

GET  /workflows/<id>/manifest
     → Returns: { workflowId, version, sha256, signature, size }
     → `signature` is ECDSA(sha256, opeidos_private_key) in base64
     → Served separately from CDN — must come from the signing authority, not the CDN bucket
     → AgentHub verifies signature against a hardcoded Opeidos public key embedded in the app bundle
```

### Checkout
```
POST /checkout
     Body: { items: [{ workflowId: string }], discountCode?: string }
     → Note: items must NOT include price. Opeidos looks up canonical price from its own catalog
     → Creates a LemonSqueezy checkout session with the correct items and prices
     → After payment: LemonSqueezy webhook fires → Opeidos grants licenses
     → Opeidos then redirects the browser to: agenthub://payment/success?order_id=<id>
     → Returns: { checkoutUrl: string }  — must be an https://app.lemonsqueezy.com URL
```

### Reviews
```
POST /reviews
     Body: { workflowId: string, rating: number, reviewText: string, submittedAt: string }
     → Stores the review under the authenticated user
     → Recalculates avgRating and reviewCount for the workflow listing
     → One review per user per workflow (upsert)
     → Returns: { ok: true }
```

### Incentive
```
GET  /incentives/discount
     → Returns { code: string } when the user has reviewed all installed workflows (≥ 4)
     → Returns { unlocked: false } (HTTP 200) when not yet earned — never return 404
     → `code` is a unique single-use LemonSqueezy coupon generated per user
     → Once generated, the same code is returned on subsequent calls (idempotent)
```

### Catalog (Phase 2 — replaces bundled JSON)
```
GET  /catalog
     → Returns: MarketplaceCatalog — full workflow catalog with live avgRating, reviewCount, downloadCount
     → Include a Cache-Control header (suggested: max-age=300)
     → AgentHub falls back to bundled catalog if this endpoint is unreachable
```

---

## LemonSqueezy Integration

- `POST /checkout` creates a LemonSqueezy checkout session server-side using the LS API key (never exposed to AgentHub)
- The LemonSqueezy success redirect URL must be set to `agenthub://payment/success?order_id={order_id}` in the LS checkout config
- Implement a LemonSqueezy webhook handler to receive `order_created` events. On receipt: grant licenses, mark order as fulfilled
- The `POST /checkout` call from AgentHub serves as the primary purchase initiation. The webhook is the authoritative license grant — never grant licenses based on the AgentHub deep link alone
- Validate LemonSqueezy webhook signatures using the LS webhook secret

---

## Review & Rating System

- `avgRating` and `reviewCount` per workflow must be recalculated on every `POST /reviews` call
- Live values returned from `GET /catalog` in Phase 2
- For Phase 1: seed values are bundled in `plugin/marketplace-catalog.json` in AgentHub. These will diverge from real data — live catalog endpoint is required before review system goes public
- One review per user per workflow. Allow edits (upsert by `(userId, workflowId)`)
- Do not display reviews from users who have not completed a purchase (prevent spam before purchase gate is live)

---

## Incentive System

- Track: for each user, which of their installed workflows have a submitted review
- Trigger condition: `reviewedCount >= 4 AND reviewedWorkflows ⊆ installedWorkflows`
- On trigger: generate a unique single-use LemonSqueezy coupon at 50% discount for that user
- Store the generated code so `GET /incentives/discount` returns the same code idempotently
- AgentHub will call this endpoint after every review submission to check for unlock
- The coupon should have an expiry (suggested: 90 days from generation)

---

## API Contract Requirements (for AgentHub integration)

These response shapes are what AgentHub expects. Any deviation will break the integration:

```typescript
// GET /me
{ id: string, email: string, displayName: string, avatarUrl?: string }

// GET /licenses
Array<{ workflowId: string, owned: true, purchasedAt: string }>

// GET /orders/<orderId>/licenses
Array<{ workflowId: string, owned: true, purchasedAt: string }>

// GET /workflows/<id>/manifest
{ workflowId: string, version: string, sha256: string, signature: string, size: number }

// POST /checkout → response
{ checkoutUrl: string }

// POST /reviews → response
{ ok: true }

// GET /incentives/discount → responses
{ code: string }              // earned
{ unlocked: false }           // not yet earned (HTTP 200, not 404)

// Standard error shape (all endpoints)
{ error: string, code: string }
// HTTP 400: validation error
// HTTP 401: token invalid or expired
// HTTP 403: action not permitted for this user
// HTTP 404: resource not found
// HTTP 429: rate limit — include Retry-After header
// HTTP 500: server error
```
