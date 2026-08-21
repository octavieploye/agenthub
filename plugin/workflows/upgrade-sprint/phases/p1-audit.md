# Phase 1 — Dependency Audit

**Agent:** `scout-frontend`

## Inputs

- Target dependency name and current version (from `package.json`)
- Target version to upgrade to (from user or lead)

## Task

1. **Read `package.json`** — record exact current version of the target dependency and all related dependencies (e.g., if upgrading DaisyUI, also record Tailwind CSS version and `tailwind.config`)
2. **Read the official changelog/migration guide** for the target version — use `WebSearch` or `WebFetch` on the official docs site
3. **Map affected components** — search the codebase for:
   - All files importing from the target dependency
   - All files using class names, utilities, or APIs that the migration guide flags as changed/removed
   - Theme configuration files (tailwind.config, daisy themes, CSS custom properties)
4. **Produce the Audit Report:**
   - Current version → target version
   - List of breaking changes from the migration guide
   - Complete component inventory: file path, DaisyUI/Tailwind classes used, risk level (HIGH if uses deprecated API, MEDIUM if uses changed API, LOW if unaffected)
   - Total affected file count
   - Estimated effort (small: <10 files, medium: 10-30, large: 30+)

## Output

Structured audit report delivered to lead. Lead reviews and decides go/no-go for P2.

## Constraints

- Do NOT modify any files
- Do NOT run `npm install` or change versions
- Research only — read and report
