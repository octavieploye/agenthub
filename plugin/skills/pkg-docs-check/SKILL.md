---
name: pkg-docs-check
description: Verify the latest version and official docs URL for any package/library/framework before writing code. Auto-triggered by hook on install commands; also callable manually for any import or dependency decision.
category: code-quality
---

# Package Docs Check

Use before writing any code that depends on a new or updated package, library, language feature, or framework.

## When to Use

- When a `PKG-DOCS-CHECK` signal appears in context (hook auto-triggered by install command)
- Before writing a new `import`, `require`, `use`, or `#include` for an unfamiliar package
- When updating a dependency to a new major version
- Before recommending a library to the user
- When training data may be stale (any package over 6 months old)

## Workflow

1. **Identify the package/library** from the task, hook signal, or import statement
2. **Check url-registry.md** in this folder for the official docs URL
3. **Fetch current version** from the package registry:
   - npm: `https://registry.npmjs.org/{package}/latest` → parse `.version`
   - PyPI: `https://pypi.org/pypi/{package}/json` → parse `.info.version`
4. **If URL found in registry**: fetch it, check HTTP status, note key API points relevant to the task
5. **If URL not in registry**: WebSearch `{package} official documentation site:{domain}` — use the most authoritative result (official site, not blogs or tutorials)
6. **If URL is broken** (404 / permanent redirect / domain gone):
   - Report: `BROKEN_URL | {name} | was: {old-url} | status: {http-code}`
   - WebSearch for the new URL and use it
   - Flag the registry entry for update

## Output Format

```
PKG-DOCS-CHECK RESULT
─────────────────────
Package:   {name}
Latest:    v{version}
Docs:      {url}  [OK | BROKEN]
Install:   {install command}
Breaking:  {breaking changes vs previous major, if any — else "none known"}
Notes:     {1-2 key API points relevant to the current task}
```

If not in registry or URL broken:
```
PKG-DOCS-CHECK RESULT
─────────────────────
Package:   {name}
Status:    NOT_IN_REGISTRY | BROKEN_URL
Found:     {new url via WebSearch}
Action:    registry needs update → add/fix entry in url-registry.md
```

## Rules

- Never write import statements based on training data alone — API surfaces change
- If version found differs significantly from what was previously used, flag it explicitly
- Do not skip this check with "I'll use what I know" — stale API usage causes silent bugs
- Only mark a URL as OK after an actual HTTP fetch, not from memory

## Pitfalls

- `@tanstack/react-query` ≠ `react-query` — package was renamed in v4; always check npm name
- `next` installs Next.js; the docs URL is `nextjs.org`, not `next.js.org`
- Scoped packages like `@anthropic-ai/sdk` include the `@scope/` in the npm registry URL
- PyPI package names are case-insensitive but canonical form matters (e.g., `Pillow` not `pillow`)
- Tauri v1 and v2 have different APIs — always confirm which version is installed
