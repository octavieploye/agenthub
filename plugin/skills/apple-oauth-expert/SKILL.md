---
name: apple-oauth-expert
description: Apple OAuth & Authentication expert — Sign in with Apple (native + web JS SDK + portal config), private email relay, ASWebAuthenticationSession, MDM Account-Driven Enrollment OAuth2, Platform SSO (attended/unattended/enrollment SSO)
category: dev-skills
---

# Apple OAuth & Authentication Expert

Expert reference on Apple's full authentication stack: Sign in with Apple, ASWebAuthenticationSession, Account-Driven MDM Enrollment OAuth2 flow, authenticating through web views, and Platform Single Sign-On (Platform SSO) including attended, unattended, and Enrollment SSO variants.

## When to Use

- Implementing Sign in with Apple — native (iOS/macOS) or web (JS SDK, Next.js, server-side)
- Configuring Sign in with Apple in the Apple Developer portal (Services ID, domains, return URLs)
- Integrating or debugging the Sign in with Apple JS SDK on a webpage
- Troubleshooting private email relay delivery failures (SPF, DKIM, domain registration)
- Building or debugging `ASWebAuthenticationSession` OAuth flows
- Integrating with Apple MDM OAuth2 Account-Driven Enrollment
- Configuring Platform SSO for MDM-managed devices (attended or unattended)
- Handling Enrollment SSO flows (BYOD / personal device enrollment)
- Diagnosing auth redirects, token errors, callback failures, or identity token validation issues on Apple platforms

## What You Need Before Starting

- Target platform: iOS native / macOS native / web (Next.js or similar) / MDM server
- Auth method in scope: Sign in with Apple / generic OAuth via browser / MDM enrollment / Platform SSO
- Any error codes, symptoms, or specific endpoints involved

---

## Reference: Authentication Services Framework

### Core Classes

| Class / Protocol | Purpose |
|---|---|
| `ASWebAuthenticationSession` | Web-based OAuth/OIDC flows — opens browser, handles redirect |
| `ASAuthorizationController` | Unified controller for all authorization request types |
| `ASAuthorizationAppleIDProvider` | Produces Sign in with Apple authorization requests |
| `ASAuthorizationAppleIDCredential` | Credential returned after successful Apple ID auth |
| `ASAuthorizationPasswordProvider` | Requests keychain credentials (AutoFill integration) |
| `ASAuthorizationSingleSignOnProvider` | Enterprise SSO via extensible SSO extension |
| `ASCredentialProviderViewController` | Password manager extension base class |
| `ASPasskeyRegistrationCredential` | Passkey creation credential |
| `ASPasskeyAssertionCredential` | Passkey assertion (login) credential |

---

### ASWebAuthenticationSession

**Initializers:**
```swift
// Preferred (iOS 17.4+, macOS 14.4+)
let session = ASWebAuthenticationSession(url: authURL, callback: .customScheme("myapp")) { url, error in
    // handle callback
}

// Legacy (all versions)
let session = ASWebAuthenticationSession(url: authURL, callbackURLScheme: "myapp") { url, error in
    // handle callback
}
```

**Key properties:**
- `prefersEphemeralWebBrowserSession: Bool` — `true` = no cookie sharing (private/incognito-like); use for sensitive flows where you don't want pre-filled credentials
- `presentationContextProvider` — **Required on macOS**; must return an `ASPresentationAnchor` (a window)

**Lifecycle:**
1. Instantiate with authorization URL + callback scheme
2. Set `presentationContextProvider` (macOS — non-negotiable) and `prefersEphemeralWebBrowserSession`
3. Call `start()` — opens browser/embedded view
4. User authenticates; IdP redirects to callback URL
5. Session calls completion handler with callback URL or error
6. Parse authorization code from callback URL query parameters
7. Exchange code for tokens on your server (never in the client)

**Error codes (`ASWebAuthenticationSessionError`):**
| Code | Constant | Meaning |
|---|---|---|
| 1 | `.canceledLogin` | User tapped Cancel OR app called `cancel()` — not a fatal error |
| 2 | `.presentationContextNotProvided` | macOS: no `presentationContextProvider` set |
| 3 | `.presentationContextInvalid` | macOS: the window is not on screen |

**Platform behavior:**
- **iOS**: Embedded browser view using Safari's cookies (when `prefersEphemeralWebBrowserSession = false`) or isolated (when `true`)
- **macOS**: Opens user's default browser (if it implements `ASWebAuthenticationSessionWebBrowserSessionManager`) or Safari
- **macOS 15+**: WebAuthN / Passkeys / security keys supported in Automated Device Enrollment context

**Callback URL forms:**
- Custom scheme: `myapp://auth/callback?code=...&state=...`
- Universal Link (HTTPS): requires Associated Domains entitlement + AASA file at `https://example.com/.well-known/apple-app-site-association`

---

### Sign in with Apple — Native Flow (iOS / macOS)

```swift
let provider = ASAuthorizationAppleIDProvider()
let request = provider.createRequest()
request.requestedScopes = [.fullName, .email]
request.state = generateCSRFToken()        // validate in delegate
request.nonce = sha256(rawNonce)           // raw nonce sent to server for JWT verification

let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.presentationContextProvider = self
controller.performRequests()
```

**Credential fields — CRITICAL: Apple sends name and email on the FIRST authentication only:**
| Field | Always present | Notes |
|---|---|---|
| `user` | YES | Stable user identifier (sub); store immediately — never changes |
| `fullName` | First auth only | `nil` on all subsequent authentications |
| `email` | First auth only | May be private relay address; `nil` on re-auth |
| `identityToken` | YES | JWT; must be validated server-side |
| `authorizationCode` | YES | Short-lived; exchange for refresh token server-side |
| `realUserIndicator` | YES | `.likelyReal` / `.unknown` / `.unsupported` — use for fraud signals |

**Identity Token (JWT) claims:**
```json
{
  "iss": "https://appleid.apple.com",
  "sub": "<stable user identifier>",
  "aud": "<your client_id>",
  "exp": 1700000000,
  "iat": 1699996400,
  "email": "user@privaterelay.appleid.com",
  "email_verified": "true",
  "is_private_email": "true",
  "nonce": "<your SHA256 nonce>",
  "real_user_status": 2
}
```

**Server-side identity token validation steps:**
1. Fetch Apple's public keys: `GET https://appleid.apple.com/auth/keys`
2. Find the key matching the JWT `kid` header
3. Verify JWT signature (RS256) using the matching public key
4. Verify `iss == "https://appleid.apple.com"`
5. Verify `aud == your_client_id`
6. Verify `exp` is in the future
7. Verify `nonce` matches your hashed nonce (if used)
8. Use `sub` as the stable user identifier in your database

---

### Sign in with Apple — Web / Server Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `https://appleid.apple.com/auth/authorize` | GET | Authorization initiation |
| `https://appleid.apple.com/auth/token` | POST | Token exchange and refresh |
| `https://appleid.apple.com/auth/revoke` | POST | Token revocation |
| `https://appleid.apple.com/auth/keys` | GET | Public keys for JWT verification (JWKS) |

**Authorization URL parameters:**
```
response_type=code
client_id=<Service ID>           # format: com.example.app.web
redirect_uri=<registered URI>    # must be registered in Apple Developer portal
scope=name%20email               # optional; space-separated
state=<CSRF token>               # required; validate on callback
nonce=<SHA256 hashed nonce>      # strongly recommended
response_mode=form_post          # recommended over query — prevents token leakage in URL
```

**Client secret (JWT signed with your `.p8` private key):**
```
Algorithm: ES256
Header: { "alg": "ES256", "kid": "<Key ID from portal>" }
Claims:
  iss: "<Team ID>"
  iat: <now>
  exp: <now + max 15777000 seconds (6 months)>
  aud: "https://appleid.apple.com"
  sub: "<client_id>"
```

**Token exchange (POST to `/auth/token`):**
```
grant_type=authorization_code
code=<auth code from callback>
redirect_uri=<same URI used in authorize>
client_id=<Service ID>
client_secret=<generated JWT>
```

**Token response:**
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "id_token": "<JWT>"
}
```

**Private relay email:** Addresses end in `@privaterelay.appleid.com`. See the full relay configuration section below.

---

### Sign in with Apple — Web Configuration (Developer Portal)

Before any web integration works, the Apple Developer portal must be configured correctly.

**Step 1 — Create a Services ID:**
1. Certificates, Identifiers & Profiles → Identifiers → (+) → Services IDs
2. Enter a description and a **unique reverse-domain identifier** (e.g. `com.example.opeidos.web`) — this becomes your `client_id` for web flows
3. Register, then select the Services ID from the list

**Step 2 — Enable and configure Sign in with Apple:**
1. Check Sign in with Apple → Configure
2. Select the **Primary App ID** from the dropdown (links to your native app's App ID if you have one)
3. **Domains and Subdomains** — enter WITHOUT `https://` (e.g. `opeidos.com`, `www.opeidos.com`)
4. **Return URLs** — enter WITH full `https://` and exact path (e.g. `https://opeidos.com/auth/apple/callback`)
5. Save and register

**Critical rules:**
- Return URL in the portal must match `redirect_uri` in your authorize request **exactly** (including path, no trailing slash difference)
- You can register multiple return URLs; all must be on registered domains
- Localhost is allowed for development: `http://localhost:3000/auth/apple/callback`

---

### Sign in with Apple — JS SDK (Web Pages / Next.js)

Apple provides a JavaScript SDK for web-based Sign in with Apple.

**Load the SDK:**
```html
<script type="text/javascript" src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"></script>
```

**Option A — Render the official button:**
```html
<div
  id="appleid-signin"
  data-color="black"
  data-border="true"
  data-type="sign in"
  data-width="200"
  data-height="44"
></div>
```
The SDK auto-renders the button and handles the flow when loaded with the script above.

**Option B — Configure via meta tags (simpler setup):**
```html
<meta name="appleid-signin-client-id" content="com.example.opeidos.web">
<meta name="appleid-signin-scope" content="name email">
<meta name="appleid-signin-redirect-uri" content="https://opeidos.com/auth/apple/callback">
<meta name="appleid-signin-state" content="<CSRF_TOKEN>">
<meta name="appleid-signin-nonce" content="<SHA256_NONCE>">
<meta name="appleid-signin-use-popup" content="false">
```

**Option C — Programmatic init (recommended for frameworks like Next.js):**
```javascript
AppleID.auth.init({
  clientId: 'com.example.opeidos.web',
  scope: 'name email',
  redirectURI: 'https://opeidos.com/auth/apple/callback',
  state: csrfToken,
  nonce: hashedNonce,
  usePopup: false,   // true = popup flow; false = redirect flow
});
```

**Popup flow vs redirect flow:**
| Mode | `usePopup` | Behavior |
|---|---|---|
| Redirect | `false` | Full-page redirect to Apple then back to `redirectURI`; response via `form_post` |
| Popup | `true` | Opens a popup window; response returned as JS event |

**Listening to events (popup mode):**
```javascript
document.addEventListener('AppleIDSignInOnSuccess', (event) => {
  const { code, id_token, state, user } = event.detail.authorization;
  // user object only present on first auth: { name: { firstName, lastName }, email }
  // send code + state to your server for token exchange
});

document.addEventListener('AppleIDSignInOnFailure', (event) => {
  console.error(event.detail.error); // e.g. "user_cancelled_authorize"
});
```

**Redirect mode response (form_post to your `redirectURI`):**
```
POST /auth/apple/callback
Content-Type: application/x-www-form-urlencoded

code=<auth_code>&state=<state>&id_token=<JWT>&user=<JSON_string_first_auth_only>
```
Note: `user` field is a JSON string only on the first authentication. Parse it and store immediately.

**Next.js implementation pattern:**
- Use an API route (`/api/auth/apple/callback`) as the `redirectURI`
- Parse the `form_post` body with `content-type: application/x-www-form-urlencoded`
- Exchange `code` for tokens server-side using your client secret
- Set a session cookie and redirect to the app

---

### Private Email Relay — Full Configuration

When a user chooses to hide their email, Apple issues an address at `@privaterelay.appleid.com`. To send transactional email to these users, your outbound email domains must be registered and SPF-authenticated.

**Register outbound email domains:**
1. Certificates, Identifiers & Profiles → Services → Sign in with Apple for Email Communication
2. Email Sources → (+)
3. Enter comma-delimited list of domains/subdomains used as your sender domain
4. No file upload or domain verification file required — just DNS records

**Limits:**
- Individual enrollment: up to 32 email sources
- Organization enrollment: up to 100 email sources

**DNS requirements (both required):**
- **SPF:** Add a TXT record: `v=spf1 include:_spf.apple.com ... ~all`
  - Apple's relay checks that your envelope sender domain (`MAIL FROM`) is registered and passes SPF
  - The registered domain must **exactly match** the `MAIL FROM` / Return-Path domain
- **DKIM:** Recommended in addition to SPF; Apple's relay accepts either but both increases deliverability

**How the relay works:**
1. Your server sends to `<hash>@privaterelay.appleid.com`
2. Apple relay validates that your sending domain is registered + SPF-authenticated
3. Apple relay forwards to the user's real inbox — your server never sees the real address
4. User can disable relay forwarding per app in their Apple ID settings (email stops arriving)

**Common relay failures:**
| Symptom | Cause | Fix |
|---|---|---|
| Relay rejects your email silently | Sending domain not registered | Register the `MAIL FROM` domain in portal |
| SPF check fails | `MAIL FROM` domain doesn't include Apple's SPF record | Add `include:_spf.apple.com` to your SPF record |
| Domain mismatch | Registered domain ≠ envelope sender domain | They must match exactly (e.g. both `mail.opeidos.com`) |
| Emails delivered then stop | User disabled relay for your app | Expected behavior — respect it; do not retry |

---

## Reference: Account-Driven MDM Enrollment — OAuth2 Flow

Account-Driven Enrollment lets users enroll personal devices using their Managed Apple ID (or a corporate IdP) with a privacy-preserving MDM profile.

### Step 1 — Discovery via Well-Known Endpoint

Device queries:
```
GET https://{managed-apple-id-domain}/.well-known/com.apple.remotemanagement
```

Required response format:
```json
{
  "Servers": [
    {
      "Version": "mdm-byod",
      "BaseURL": "https://mdm.example.com/enroll"
    }
  ]
}
```

**Rules:**
- Must be served from the **exact domain** of the Managed Apple ID email — `company.com`, not `mdm.company.com`
- Fallback: if the domain endpoint fails, Apple queries Apple Business Manager / Apple School Manager for the enrollment URL (new in 2025)
- Must be HTTPS; no self-signed certificates

### Step 2 — MDM Auth Configuration

MDM server returns the OAuth2 IdP configuration:
```json
{
  "authentication": "OAuth2",
  "authorization-endpoint": "https://idp.example.com/oauth2/authorize",
  "token-endpoint": "https://idp.example.com/oauth2/token",
  "client-id": "mdm_client_id"
}
```

### Step 3 — OAuth2 Enrollment Flow (Full Sequence)

1. User opens Settings → General → VPN & Device Management, enters Managed Apple ID
2. Device queries well-known endpoint on user's email domain
3. Device receives MDM server URL + OAuth2 auth config
4. Device opens `ASWebAuthenticationSession` to `authorization-endpoint` with:
   ```
   response_type=code
   client_id=<mdm_client_id>
   state=<device-generated CSRF token>
   login_hint=<managed_apple_id_email>
   redirect_uri=<mdm-specific redirect URI>
   scope=mdm
   code_challenge=<PKCE challenge, S256>
   code_challenge_method=S256
   ```
5. User authenticates with IdP (Managed Apple ID, LDAP, SAML-federated, etc.)
6. IdP redirects back with `?code=<auth_code>&state=<state>`
7. Device or MDM server exchanges code at `token-endpoint`:
   ```
   POST /oauth2/token
   grant_type=authorization_code
   code=<auth_code>
   redirect_uri=<redirect_uri>
   client_id=<client_id>
   code_verifier=<PKCE verifier>
   ```
8. MDM server returns `access_token` (device session token)
9. Device uses `Authorization: Bearer <access_token>` for all MDM requests
10. MDM server delivers signed `.mobileconfig` enrollment profile
11. Device installs profile — enrollment complete

**Security requirements:**
- PKCE with `S256` method is mandatory — never use `plain`
- MDM server must validate `state` parameter on callback (CSRF protection)
- Access tokens act as session tokens — implement rotation and expiry handling

---

## Reference: Authenticating Through Web Views

### Always Use ASWebAuthenticationSession, Never WKWebView

`WKWebView` exposes cookies to the host app — this breaks the OAuth security model and risks App Store rejection.

`ASWebAuthenticationSession` benefits:
- Runs in an isolated process; host app cannot access cookies
- Shows a system consent dialog (user is informed)
- On iOS, can reuse Safari's existing sessions for faster re-auth
- On macOS 15+: supports WebAuthN (Passkeys, security keys)

### macOS 15 (Sequoia) — WebAuthN in Enrollment

Automated Device Enrollment on macOS 15 supports WebAuthN authentication:
- Uses public key cryptography (security keys + Passkeys) during MDM enrollment
- Implemented via `ASWebAuthenticationSession` with WebAuthN extension
- Benefits: no password, stronger security, hardware-backed keys

### Certificate-Based Auth During MDM Enrollment — Known Issue

If a client certificate was installed via an MDM profile before enrollment completes, `ASWebAuthenticationSession` may not pick up the certificate for TLS mutual auth.

**Workaround:** Ensure the certificate is in the **system keychain** before the session starts, or use a two-phase enrollment where the certificate is pre-staged.

---

## Reference: Platform Single Sign-On (Platform SSO)

Platform SSO (macOS 13+) extends SSO to the macOS login window and system-level authentication using OAuth 2.0 / OpenID Connect via an SSO Extension.

### Architecture

| Component | Role |
|---|---|
| SSO Extension | Vendor-supplied app extension implementing the Platform SSO protocol |
| `ExtensibleSingleSignOn` MDM payload | Configures which extension handles which domains |
| `ExtensibleSingleSignOnKerberos` payload | Kerberos-specific SSO configuration |
| `EnrollmentSSODocument` payload | Enrollment SSO flow parameters |

### Authentication Methods

| Method | When to use |
|---|---|
| Password | User's IdP password synced to macOS login window |
| Secure Enclave Key | Passwordless; device-bound private key registered with IdP — recommended |
| SmartCard | PIV/CAC card-based authentication |
| Kerberos | Active Directory / MIT KDC environments; TGT retrieved and shared |

### Platform SSO Protocol — OIDC Flow

1. **Registration:** Device generates Secure Enclave key pair; registers public key with IdP via vendor `/registration` endpoint
2. **Token issuance:** IdP returns access token + refresh token bound to the device key
3. **Login window:** SSO Extension intercepts macOS login event, authenticates against IdP token
4. **Kerberos (optional):** TGT retrieved from IdP, imported to credential cache, optionally shared with Kerberos extension
5. **Token refresh:** Silent background refresh using refresh token + device key assertion — no user prompt

### Enrollment SSO (BYOD — Newer Flow)

Enrollment SSO streamlines personal device (BYOD) enrollment:
- User authenticates **once** during enrollment
- Same session reused for MDM enrollment + organizational app/website access
- Configured via `EnrollmentSSODocument` MDM payload
- Implemented by the SSO Extension vendor
- Reduces sign-in friction; improves security by reducing credential exposure

### Platform SSO During Automated Device Enrollment (Attended)

- Device enrolls via Apple Business Manager / Apple School Manager
- During Setup Assistant, Platform SSO authenticates the user before login window
- SSO Extension app must be pushed before the user reaches the login window
- **Correct order:** ADE enrollment → MDM pushes SSO Extension app → MDM pushes `ExtensibleSingleSignOn` profile → Setup Assistant invokes SSO Extension → user authenticates with IdP → Platform SSO registered

### Platform SSO for Unattended Enrollment

Target: shared devices, kiosks, labs — no user at keyboard.

- MDM provisions a **bootstrap token** or **device-level credential**
- SSO Extension uses the device credential (Secure Enclave key) without user presence
- Access tokens refreshed automatically by the SSO Extension
- **Requires macOS 14+** with Secure Enclave key method

### WWDC 2025 Updates

- Sign into Mac with **iPhone or Apple Watch tap** (Continuity-based, macOS 15+)
- Platform SSO supports device migration between MDM servers
- New Services APIs for Apple Business Manager and Apple School Manager
- Fallback MDM discovery via ABM/ASM when well-known endpoint is unreachable

---

## Workflow

When investigating an Apple OAuth or authentication issue:

1. **Identify the auth type** — Sign in with Apple? Generic OAuth via `ASWebAuthenticationSession`? MDM Account-Driven Enrollment? Platform SSO?
2. **Identify the platform** — iOS native? macOS native? Web (Next.js)? MDM server-side?
3. **Locate the failure point** — authorization request construction? Token exchange? Callback redirect? JWT validation? Profile delivery?
4. **Check error codes** — `ASWebAuthenticationSessionError` code; JWT claim mismatch; MDM enrollment status
5. **Review token handling** — server-side JWT validation; token storage; refresh logic; client secret expiry
6. **For MDM flows** — verify well-known endpoint domain; confirm PKCE `S256`; validate `state`/CSRF

## Output

- Root cause identification with the exact Apple API class, endpoint, or MDM payload involved
- Correct implementation pattern with code or request examples
- List of constraints, edge cases, and known Apple-specific bugs relevant to the issue

## Constraints

- Apple sends `fullName` and `email` **only on the first Sign in with Apple authentication** — if not persisted immediately, they cannot be retrieved again
- `ASWebAuthenticationSession` on macOS requires `presentationContextProvider` to be set before `start()` — omitting it crashes the app
- Never use `WKWebView` for OAuth flows — App Store rejection risk and security violation
- Well-known endpoint for MDM enrollment must be on the exact Managed Apple ID email domain (not a subdomain)
- Platform SSO unattended enrollment requires macOS 14+
- Sign in with Apple client secrets expire after a maximum of 6 months — rotate before expiry
- PKCE must use `S256` method; `plain` is deprecated and rejected by Apple MDM

## Common Mistakes

| Mistake | Fix |
|---|---|
| Not storing email/name on first auth | Persist `credential.user` (sub) + email + name immediately on the first callback; they will be `nil` on every subsequent auth |
| macOS crash on `session.start()` | Set `presentationContextProvider` before calling `start()` |
| Using `WKWebView` for OAuth flows | Replace with `ASWebAuthenticationSession` — WKWebView exposes cookies to the host app |
| Well-known endpoint on `mdm.company.com` | Must be on `company.com` (exact email domain); subdomains are not checked |
| Identity token trusted without server validation | Always validate JWT signature + `iss` + `aud` + `exp` server-side; never trust client-only |
| Client secret never rotated | Set a recurring reminder; Sign in with Apple secrets expire in max 6 months |
| PKCE method set to `plain` | Use `code_challenge_method=S256`; Apple MDM requires it |
| Treating `.canceledLogin` as a fatal error | It means the user tapped Cancel — show a retry option; do not log as an error or crash |
| SSO profile pushed before SSO Extension app installed | Push the SSO Extension app first; then push the `ExtensibleSingleSignOn` profile; reverse order breaks registration |
| Attempting unattended Platform SSO on macOS 13 | Unattended Platform SSO with Secure Enclave key requires macOS 14+ |
| Sending email to private relay addresses without domain registration | Register your outbound email domain in the Apple Developer portal before emailing `@privaterelay.appleid.com` addresses |
