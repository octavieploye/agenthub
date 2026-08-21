---
name: google-oauth-expert
description: Google OAuth 2.0 expert — implementation guidance (web + desktop/installed apps), security hardening, token lifecycle, scope selection, and production readiness. TypeScript/Node.js primary with language-agnostic notes.
category: dev-skills
---

# Google OAuth 2.0 Expert

Full-stack Google OAuth 2.0 authority for web server apps and desktop/installed apps. Covers implementation, security hardening, token lifecycle, scope strategy, and production readiness compliance.

## When to Use

- Implementing Google login (web app or Electron/desktop)
- Choosing between web server flow and installed app flow (PKCE)
- Auditing an existing OAuth config for security gaps
- Selecting scopes (avoiding sensitive/restricted scope overhead)
- Debugging redirect URI mismatches, token refresh failures, or consent errors
- Preparing for Google's production verification review
- Answering a question about Google OAuth behaviour or policies

## Trigger Modes

| Trigger | What you get |
|---|---|
| "how do I implement Google OAuth" | Step-by-step implementation guide + TypeScript snippets |
| "audit my OAuth config" | Security checklist applied against provided code/config |
| "which scopes do I need" | Minimum required scopes + sensitivity classification |
| "production ready?" | Production readiness compliance checklist |
| General Q&A | Direct answer with cited behaviour from official flow |

## What You Need Before Starting

- Which app type: **web server** (Node.js/Express/Next.js) or **installed/desktop** (Electron, CLI)
- Whether offline access (refresh tokens) is needed
- Target scopes (or a description of what data/actions the app needs)
- For audits: the existing client config, redirect URIs, and token storage code

## Workflow

### 1. Identify App Type and Flow

**Web server apps** — Authorization Code Flow:
- Server holds `client_secret` — never expose it to the browser
- Redirect URI must be HTTPS (except `localhost` for dev)
- Request `access_type=offline` + `prompt=consent` to receive a refresh token

**Installed / Desktop apps** — Authorization Code Flow + PKCE:
- No `client_secret` in the binary (it cannot be kept secret)
- PKCE replaces the secret: `code_verifier` (random 43-128 char string) → `code_challenge` = BASE64URL(SHA256(verifier))
- Redirect URI: loopback `http://127.0.0.1:PORT` (preferred) — port chosen at runtime; do NOT use `localhost` (deprecated), custom URI schemes (deprecated), or embedded browsers
- Electron: open system browser via `shell.openExternal()`, listen on a local HTTP server for the callback

### 2. Implement the Authorization Request

```typescript
// TypeScript — web server or Electron (both flows share this structure)
import crypto from 'crypto';
import { URLSearchParams } from 'url';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

interface AuthParams {
  clientId: string;
  redirectUri: string;      // HTTPS for web; http://127.0.0.1:PORT for desktop
  scopes: string[];
  state: string;            // CSRF token — random, store in session
  // PKCE only (installed apps):
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
}

function buildAuthUrl(params: AuthParams): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scopes.join(' '),
    state: params.state,
    access_type: 'offline',   // request refresh token
    prompt: 'consent',        // force consent screen to always get refresh token
  });
  if (params.codeChallenge) {
    query.set('code_challenge', params.codeChallenge);
    query.set('code_challenge_method', 'S256');
  }
  return `${GOOGLE_AUTH_URL}?${query.toString()}`;
}

// PKCE helpers (installed apps only)
function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString('base64url').slice(0, 128);
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// CSRF state token
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

### 3. Exchange Authorization Code for Tokens

```typescript
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;          // seconds (typically 3600)
  refresh_token?: string;      // only on first consent
  scope: string;
  id_token?: string;           // if openid scope was requested
}

async function exchangeCode(params: {
  code: string;
  clientId: string;
  clientSecret?: string;       // web server only
  redirectUri: string;
  codeVerifier?: string;       // installed apps only (PKCE)
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
  });
  if (params.clientSecret) body.set('client_secret', params.clientSecret);
  if (params.codeVerifier)  body.set('code_verifier', params.codeVerifier);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}
```

### 4. Refresh Access Tokens

```typescript
async function refreshAccessToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret?: string;  // web server only
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  });
  if (params.clientSecret) body.set('client_secret', params.clientSecret);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}
```

### 5. Revoke Tokens (logout / user data deletion)

```typescript
async function revokeToken(token: string): Promise<void> {
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: 'POST' }
  );
  // 200 = revoked; 400 = token already invalid (treat as success)
  if (!res.ok && res.status !== 400) throw new Error(`Revoke failed: ${res.status}`);
}
```

### 6. Security Hardening Checklist

Run this against any OAuth implementation:

**CSRF Protection**
- [ ] `state` parameter is a random, unguessable value (min 32 bytes entropy)
- [ ] State is stored server-side (session) or in Electron's main process memory — never in localStorage
- [ ] Incoming redirect verifies `state` matches stored value before processing `code`

**Redirect URI**
- [ ] Web: exact HTTPS URI registered in Google Cloud Console — no wildcards, no HTTP (except localhost dev)
- [ ] Desktop: `http://127.0.0.1:PORT` (loopback IP, not `localhost`) — port chosen at runtime
- [ ] No `urn:ietf:wg:oauth:2.0:oob` (deprecated)
- [ ] No custom URI schemes (deprecated by Google policy)
- [ ] No WKWebView / Android WebView / embedded browsers — forbidden by Google policy

**Credentials**
- [ ] `client_secret` lives only in server-side env vars — never in frontend bundles or mobile/desktop binaries
- [ ] For installed apps: no `client_secret` in the app at all — PKCE only
- [ ] Credentials rotated if exposed — immediately revoke old credentials in Cloud Console

**Token Storage**
- [ ] Web server: refresh token in encrypted server-side storage (DB with encryption at rest)
- [ ] Desktop/Electron: use OS keychain (`keytar`, macOS Keychain, Windows Credential Manager) — never plain text
- [ ] Access tokens not persisted to disk (in-memory only, refreshed as needed)

**Scopes**
- [ ] Request minimum required scopes — incremental auth preferred (request scopes at the moment they are needed)
- [ ] Sensitive scopes (e.g. Gmail, Drive full access) go through Google's verification process before production
- [ ] Restricted scopes (security-critical APIs) require formal Google security audit

**Token Lifecycle**
- [ ] Access tokens expire in ~3600s — code checks `expires_in` and refreshes proactively (5 min before expiry)
- [ ] Refresh token is stored on first consent; if missing on subsequent logins, force `prompt=consent` again
- [ ] Implement Cross-Account Protection (RISC): listen for `https://risc.googleapis.com/` events to invalidate sessions when Google detects account compromise

### 7. Scope Selection Guide

| Need | Scope | Sensitivity |
|---|---|---|
| User identity only | `openid profile email` | Basic — no verification needed |
| Google Calendar read | `https://www.googleapis.com/auth/calendar.readonly` | Sensitive — verification needed for production |
| Gmail read | `https://www.googleapis.com/auth/gmail.readonly` | Restricted — security audit required |
| Drive full access | `https://www.googleapis.com/auth/drive` | Restricted — security audit required |
| YouTube read | `https://www.googleapis.com/auth/youtube.readonly` | Sensitive |

**Rule:** Never request a wider scope than needed. Use `.readonly` variants where writes are not required. Use incremental auth — request scopes when the user triggers the feature, not all upfront.

### 8. Production Readiness Checklist

Before submitting for Google's production verification:

**Cloud Console setup**
- [ ] Separate GCP projects for dev/staging/prod — never share credentials across environments
- [ ] OAuth consent screen configured: app name, support email, homepage URL (must be a real, publicly accessible page), privacy policy URL, terms of service URL
- [ ] Domain ownership verified in Google Search Console for any domain in redirect URIs or homepage
- [ ] Brand logo uploaded and approved (3-10 days for Google review)

**App verification**
- [ ] Production app is not in "Testing" status (only 100 test users, tokens expire in 7 days)
- [ ] Submitted for Google verification if using sensitive/restricted scopes
- [ ] App homepage URL is not localhost and resolves publicly
- [ ] Privacy policy URL is live and clearly describes data usage

**Policy compliance**
- [ ] Limited use policy followed: data from Google APIs only used for the stated purpose
- [ ] No selling or transferring user data to third parties
- [ ] No using data for advertising
- [ ] Users can revoke access and delete their data

## Output

- **Q&A mode:** Direct answer with TypeScript code snippet if relevant
- **Implementation guide:** Complete flow with code for the identified app type
- **Security audit:** Per-item checklist with PASS/FAIL/MISSING status + remediation steps
- **Production checklist:** Ordered list of blocking vs. non-blocking items for verification

## Constraints

- Never recommend `client_secret` inside an Electron/desktop/mobile binary
- Never recommend `localhost` as redirect URI (use `127.0.0.1` instead — deprecated by Google)
- Never recommend WKWebView, WebView, or any embedded browser for the auth flow
- Never recommend storing tokens in `localStorage` or unencrypted files
- Always recommend `state` parameter even if the user thinks it is optional — it is required for security
- For sensitive/restricted scopes: always flag that Google verification is required before production launch
- Do not hardcode model names, API versions, or scope URLs without noting they can change — recommend fetching from Google Discovery Document when building dynamic scope pickers

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using `client_secret` in Electron app | Remove it entirely — use PKCE only for installed apps |
| Using `localhost` in redirect URI | Use `http://127.0.0.1:PORT` — Google deprecated `localhost` for installed apps |
| No `state` param | Generate a random 32-byte hex token, store in session, verify on callback |
| Missing `access_type=offline` | Add it to the auth request to receive a refresh token |
| Refresh token missing on re-auth | Add `prompt=consent` to force Google to re-issue it |
| Storing refresh token in localStorage | Move to encrypted DB (web server) or OS keychain (desktop) |
| Requesting all scopes upfront | Use incremental auth — request scopes when the user triggers the feature |
| Testing mode in production | Submit for verification — testing mode limits to 100 users + 7-day token expiry |
| Embedded browser (WKWebView) | Open system browser (`shell.openExternal()` in Electron) — embedded browsers are policy-banned |
| Single GCP project for all environments | Separate dev/staging/prod projects — never share `client_id`/`client_secret` across environments |
