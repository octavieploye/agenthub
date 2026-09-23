---
name: package-ts-factory
description: Design and generate complete TypeScript packages from a brief — types, schemas, workflows, agents, tests. Reference pattern is @optimaeus/destructuring.
---

# Package TS Factory

Scaffolds TypeScript packages for the Opeidos ecosystem. Reference pattern: `@optimaeus/destructuring`.

## Commands

| Command | What it does |
|---|---|
| `/create-ts-package` | Collect brief → design → scaffold → write all package files |

## What this package produces

```
packages/<name>/
  package.json          @optimaeus/<name>, zod, vitest, typescript
  tsconfig.json         ES2022, ESNext modules, bundler resolution
  src/
    index.ts            barrel exports — types, schemas, workflows, utils
    types/              TypeScript interfaces (one file per domain)
    schemas/            Zod schemas + inferred types (one file per domain)
    workflows/          workflow directories with agents/ subdirs
      <workflow>/
        index.ts        orchestrator — runXxx(subject, provider)
        agents/         one file per agent: buildPrompt(), parseOutput()
    utils/              shared utilities
    __tests__/          vitest tests — one file per schema + workflow
```

## What this package does not do

- Does not generate without a confirmed brief
- Does not write placeholder content — every file is specific to the package purpose
- Does not skip tests
- Does not scaffold markdown skills or bash runners (use package-factory for that)
