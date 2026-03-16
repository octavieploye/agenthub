# Typecheck Issues — Deferred

> Added during Docker isolation Phase 1 (Sprint 1-2). All issues below are **pre-existing** (present before this branch). None were introduced by the Docker implementation.
> Tackle after Docker implementation is complete.

## Root cause

`@electron-toolkit/tsconfig` and React type resolution fail when `node_modules` is not fully installed or when the tsconfig base files are missing. `zod/v4` similarly fails without deps installed. Most errors below cascade from this.

## Issues

### tsconfig resolution (blocks all typechecks)
- `tsconfig.node.json` — `@electron-toolkit/tsconfig/tsconfig.node.json` not found
- `tsconfig.web.json` — `@electron-toolkit/tsconfig/tsconfig.web.json` not found

### React / JSX type resolution (cascade from tsconfig)
- `TerminalToolbar.tsx` — JSX element implicitly `any` (no `JSX.IntrinsicElements`)
- `ThemeSwitcher.tsx` — Cannot find namespace `React`; JSX errors
- `UnifiedView.tsx` — Cannot find namespace `React`; JSX errors
- `VoiceInputButton.tsx` — Cannot find module `react`

### Zod / shared schemas (deps not installed)
- `src/shared/schemas/agent.schemas.ts` — Cannot find module `zod/v4`
- `src/shared/schemas/config.schemas.ts` — Cannot find module `zod/v4`
- `src/shared/schemas/ipc.schemas.ts` — Cannot find module `zod/v4`
- `src/shared/schemas/usage.schemas.ts` — Cannot find module `zod/v4`

### Lib target too low
- `src/shared/types/health.types.ts` — Cannot find name `Map` (need `lib: es2015+`)
- `src/shared/types/usage.types.ts` — Cannot find name `Map` (need `lib: es2015+`)

### Test setup
- `tests/setup.ts` — Cannot find module `vitest`

## Fix

```bash
npm install          # restores node_modules + @electron-toolkit deps
npm run typecheck    # should clear cascade errors
```

Remaining issues after `npm install` (if any) should be addressed individually.
