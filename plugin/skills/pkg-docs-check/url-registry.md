# Package Docs URL Registry
Last updated: 2026-08-31

## How to Use

1. Find the package/tool by name in the tables below
2. Fetch the URL — check HTTP status (200/301 = OK, 404/timeout = BROKEN)
3. **BROKEN_URL**: report `BROKEN_URL | {name} | was: {url} | status: {code}` and WebSearch for new URL
4. **NOT_IN_REGISTRY**: WebSearch `{package} official documentation` then request addition to this file

---

## Package Registries — Version Lookup APIs

| Tool | URL Pattern | Format |
|---|---|---|
| npm registry (JS) | `https://registry.npmjs.org/{package}/latest` | JSON → `.version` |
| npm package page | `https://www.npmjs.com/package/{package}` | Human-readable |
| PyPI (Python) | `https://pypi.org/pypi/{package}/json` | JSON → `.info.version` |
| Packagist (PHP) | `https://packagist.org/packages/{vendor}/{package}` | Human-readable |
| crates.io (Rust) | `https://crates.io/crates/{crate}` | Human-readable |
| pub.dev (Flutter/Dart) | `https://pub.dev/packages/{package}` | Human-readable |

---

## Package Managers

| Tool | Official Docs URL |
|---|---|
| npm | `https://docs.npmjs.com/` |
| Yarn | `https://yarnpkg.com/getting-started` |
| pnpm | `https://pnpm.io/motivation` |
| Bun | `https://bun.sh/docs` |
| npx | `https://docs.npmjs.com/cli/v10/commands/npx` |
| Composer (PHP) | `https://getcomposer.org/doc/` |
| pip | `https://pip.pypa.io/en/stable/` |
| Poetry | `https://python-poetry.org/docs/` |

---

## Languages

| Language | Official Docs URL |
|---|---|
| TypeScript | `https://www.typescriptlang.org/docs/` |
| JavaScript (MDN) | `https://developer.mozilla.org/en-US/docs/Web/JavaScript` |
| Python | `https://docs.python.org/3/` |
| PHP | `https://www.php.net/docs.php` |
| Swift | `https://www.swift.org/documentation/` |
| Kotlin | `https://kotlinlang.org/docs/` |
| Go | `https://pkg.go.dev/` |
| Rust | `https://doc.rust-lang.org/book/` |
| Java | `https://docs.oracle.com/en/java/javase/21/` |
| C# / .NET | `https://learn.microsoft.com/en-us/dotnet/csharp/` |
| Ruby | `https://ruby-doc.org/` |
| Elixir | `https://elixir-lang.org/docs.html` |
| CSS (MDN) | `https://developer.mozilla.org/en-US/docs/Web/CSS` |
| HTML (MDN) | `https://developer.mozilla.org/en-US/docs/Web/HTML` |
| GraphQL (spec) | `https://graphql.org/learn/` |

---

## JS / TS — Runtimes & Build Tools

| Package / Tool | Official Docs URL |
|---|---|
| Node.js | `https://nodejs.org/docs/latest/api/` |
| Vite | `https://vitejs.dev/guide/` |
| Vitest | `https://vitest.dev/` |
| Jest | `https://jestjs.io/docs/getting-started` |
| Playwright | `https://playwright.dev/docs/intro` |
| ESLint | `https://eslint.org/docs/latest/` |
| Prettier | `https://prettier.io/docs/en/` |
| esbuild | `https://esbuild.github.io/` |
| Rollup | `https://rollupjs.org/introduction/` |
| Storybook | `https://storybook.js.org/docs` |

---

## JS / TS — Frontend Frameworks

| Package | npm name | Official Docs URL |
|---|---|---|
| React | `react` | `https://react.dev/` |
| Next.js | `next` | `https://nextjs.org/docs` |
| Vue.js | `vue` | `https://vuejs.org/guide/` |
| Nuxt | `nuxt` | `https://nuxt.com/docs` |
| Angular | `@angular/core` | `https://angular.dev/` |
| Svelte / SvelteKit | `svelte` | `https://kit.svelte.dev/docs` |
| Astro | `astro` | `https://docs.astro.build/` |
| Solid.js | `solid-js` | `https://docs.solidjs.com/` |

---

## JS / TS — Desktop & Cross-Platform

| Package | npm name | Official Docs URL |
|---|---|---|
| Electron | `electron` | `https://www.electronjs.org/docs/latest/` |
| Tauri v2 | `@tauri-apps/api` | `https://v2.tauri.app/` |

---

## JS / TS — State, Data, Validation

| Package | npm name | Official Docs URL |
|---|---|---|
| Zustand | `zustand` | `https://zustand.docs.pmnd.rs/` |
| TanStack Query | `@tanstack/react-query` | `https://tanstack.com/query/latest/docs/` |
| Zod | `zod` | `https://zod.dev/` |
| Jotai | `jotai` | `https://jotai.org/docs/introduction` |
| Redux Toolkit | `@reduxjs/toolkit` | `https://redux-toolkit.js.org/introduction/getting-started` |

---

## JS / TS — Backend Frameworks

| Package | npm name | Official Docs URL |
|---|---|---|
| Fastify | `fastify` | `https://fastify.dev/docs/latest/` |
| Express | `express` | `https://expressjs.com/en/5x/api.html` |
| Hono | `hono` | `https://hono.dev/docs/` |
| NestJS | `@nestjs/core` | `https://docs.nestjs.com/` |

---

## JS / TS — GraphQL

| Package | npm name | Official Docs URL |
|---|---|---|
| GraphQL.js | `graphql` | `https://graphql.org/graphql-js/` |
| Apollo Client | `@apollo/client` | `https://www.apollographql.com/docs/react/` |
| Apollo Server | `@apollo/server` | `https://www.apollographql.com/docs/apollo-server/` |
| GraphQL Yoga | `graphql-yoga` | `https://the-guild.dev/graphql/yoga-server/docs` |
| Pothos | `@pothos/core` | `https://pothos-graphql.dev/docs/` |

---

## JS / TS — ORMs & Database Clients (free/open-source)

| Package | npm name | Official Docs URL |
|---|---|---|
| Drizzle ORM | `drizzle-orm` | `https://orm.drizzle.team/docs/overview` |
| MikroORM | `@mikro-orm/core` | `https://mikro-orm.io/docs/` |
| TypeORM | `typeorm` | `https://typeorm.io/` |
| better-sqlite3 | `better-sqlite3` | `https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md` |

---

## JS / TS — UI & Styling

| Package | npm name | Official Docs URL |
|---|---|---|
| Tailwind CSS | `tailwindcss` | `https://tailwindcss.com/docs/` |
| DaisyUI | `daisyui` | `https://daisyui.com/components/` |
| shadcn/ui | *(CLI-based)* | `https://ui.shadcn.com/docs` |

---

## JS / TS — AI / LLM SDKs

| Package | npm name | Official Docs URL |
|---|---|---|
| Anthropic TS SDK | `@anthropic-ai/sdk` | `https://github.com/anthropics/anthropic-sdk-typescript` |
| OpenAI TS SDK | `openai` | `https://github.com/openai/openai-node` |
| Mistral TS SDK | `@mistralai/mistralai` | `https://docs.mistral.ai/` |

---

## Python Frameworks & Tools

| Package | pip name | Official Docs URL |
|---|---|---|
| FastAPI | `fastapi` | `https://fastapi.tiangolo.com/` |
| Pydantic | `pydantic` | `https://docs.pydantic.dev/latest/` |
| SQLAlchemy | `sqlalchemy` | `https://docs.sqlalchemy.org/en/20/` |
| Alembic | `alembic` | `https://alembic.sqlalchemy.org/en/latest/` |
| Pytest | `pytest` | `https://docs.pytest.org/en/stable/` |
| Uvicorn | `uvicorn` | `https://www.uvicorn.org/` |
| Django | `django` | `https://docs.djangoproject.com/en/stable/` |
| Flask | `flask` | `https://flask.palletsprojects.com/en/stable/` |
| Anthropic Python SDK | `anthropic` | `https://github.com/anthropics/anthropic-sdk-python` |

---

## PHP Frameworks

| Tool | Official Docs URL |
|---|---|
| Laravel | `https://laravel.com/docs/` |
| Symfony | `https://symfony.com/doc/current/` |
| WordPress Dev | `https://developer.wordpress.org/` |

---

## Mobile

| Tool / Framework | Official Docs URL |
|---|---|
| SwiftUI | `https://developer.apple.com/documentation/swiftui/` |
| Swift | `https://www.swift.org/documentation/` |
| Android (Kotlin) | `https://developer.android.com/docs` |
| React Native | `https://reactnative.dev/docs/` |
| Flutter | `https://docs.flutter.dev/` |
| Expo | `https://docs.expo.dev/` |

---

## Databases (free / open-source only)

| DB | Official Docs URL | Replaces |
|---|---|---|
| PostgreSQL | `https://www.postgresql.org/docs/current/` | — |
| SQLite | `https://www.sqlite.org/docs.html` | — |
| Valkey | `https://valkey.io/docs/` | Redis (SSPL/paid) |
| MongoDB | `https://www.mongodb.com/docs/manual/` | — |
| MariaDB | `https://mariadb.com/kb/en/documentation/` | — |
| MySQL | `https://dev.mysql.com/doc/` | — |
| Memgraph | `https://memgraph.com/docs` | — |
| Qdrant | `https://qdrant.tech/documentation/` | — |
| MeiliSearch | `https://www.meilisearch.com/docs/` | — |

---

## Infrastructure / DevOps

| Tool | Official Docs URL | Replaces |
|---|---|---|
| Docker | `https://docs.docker.com/reference/` | — |
| Kubernetes | `https://kubernetes.io/docs/` | — |
| Helm | `https://helm.sh/docs/` | — |
| GitHub Actions | `https://docs.github.com/en/actions` | — |
| Forgejo | `https://forgejo.org/docs/latest/` | — |
| Coolify | `https://coolify.io/docs` | Vercel (paid) |
| Dokku | `https://dokku.com/docs/` | Vercel (paid) |

---

## AI / LLM APIs & Tools

| Tool | Official Docs URL |
|---|---|
| Anthropic API | `https://docs.anthropic.com/en/api/getting-started` |
| Ollama API | `https://github.com/ollama/ollama/blob/main/docs/api.md` |
| Mistral API | `https://docs.mistral.ai/` |
| OpenAI API | `https://platform.openai.com/docs/api-reference` |
| HuggingFace | `https://huggingface.co/docs` |
| Model Context Protocol | `https://modelcontextprotocol.io/docs/` |

---

## Paid / Proprietary — DO NOT USE (free alternatives listed above)

| Tool | Status | Free Alternative |
|---|---|---|
| Redis | SSPL (non-OSI) | Valkey |
| Prisma Cloud / Accelerate | Paid | Drizzle ORM, MikroORM |
| Vercel | Paid / vendor lock-in | Coolify, Dokku |
| PlanetScale | Paid | PostgreSQL + Drizzle |
| Supabase | Paid tiers | PostgreSQL + FastAPI |
| Firebase | Google / proprietary | PostgreSQL + Valkey |
