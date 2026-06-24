# How-To Panel — Design Spec

## Goal

Add a searchable, accordion-style in-app guide panel to AgentHub, discoverable via a dedicated icon button in the SABar. Content lives in `docs/how-to/*.md` (source of truth), is served to the renderer via IPC on panel open, and is also indexed in `.claude/` so any LLM agent working in the repo can find and read the guides. A rule in `CLAUDE.md` ensures agents keep the docs updated when adding or refactoring features.

## Architecture

```
docs/how-to/*.md          ← source of truth (human + LLM readable)
        ↓  IPC on panel open
main: system.ipc.ts       ← fs.readdirSync + fs.readFileSync → [{title, order, content}]
        ↓
renderer: HowToPanel.tsx  ← search field + accordion sections, markdown rendered via marked
```

### Content discovery

Files follow `NN-slug.md` naming convention (`01-kanban.md`, `02-sprint-automation.md`). The `NN` prefix controls render order. Section title is extracted from the file's first `# Heading` — no separate config file needed. Adding a new guide is dropping a new `.md` file; it appears on next panel open with no code change.

### Search

Client-side, runs on every keystroke against section titles and raw content strings. Sections with no match collapse and dim. Sections where the match is inside the body auto-expand. No indexing or debounce needed at this doc count.

### Markdown rendering

`marked` (lightweight, already available in Electron ecosystem) converts `.md` → HTML. Rendered via `dangerouslySetInnerHTML` inside a scoped `prose` wrapper class. No new heavy dependency.

### LLM discoverability

- `.claude/how-to-index.md` — lists every file in `docs/how-to/` with path and one-line description. Imported via `@.claude/how-to-index.md` in `CLAUDE.md`.
- `CLAUDE.md` Core Principles gains a rule: agents must update `docs/how-to/<feature>.md` when adding or refactoring a feature.

---

## Components

### 1. `HowToButton` — inline in `SABar.tsx`

A small icon button added immediately left of the existing `HelpPopover` `?` button. Uses an inline SVG (gear-on-document icon — technical manual). No new component file; added directly into `SABar.tsx`.

Props passed down from `App.tsx`: `onOpenHowTo: () => void`.

```tsx
<button
  onClick={onOpenHowTo}
  className="w-5 h-5 text-base-content/50 hover:text-base-content/80 hover:bg-base-content/10 transition-colors flex items-center justify-center rounded"
  title="AgentHub Guide"
  aria-label="Open how-to guide"
>
  {/* inline SVG: gear-document icon */}
</button>
```

### 2. `HowToPanel` — `src/renderer/src/widgets/how-to-panel/HowToPanel.tsx`

Self-contained drawer component. Receives `isOpen: boolean` and `onClose: () => void`.

**Layout — fixed right-side drawer, 360px wide:**

```
┌─────────────────────────────┐
│  AgentHub Guide         ✕  │  ← header
├─────────────────────────────┤
│  🔍 Search guides…          │  ← controlled input, filters on change
├─────────────────────────────┤
│  ▾ Kanban Board             │  ← accordion section (open by default if first)
│    … markdown content …     │
│  ▸ Sprint Automation        │  ← collapsed
│  ▸ Voice & TTS              │
│  ▸ Skills                   │
│  ▸ Agents                   │
└─────────────────────────────┘
```

**Behaviour:**
- Opens when `isOpen` becomes true; closes on `Esc` or click-outside
- On first open, fetches guide list via `window.agentHub.system.listHowTo()` — result cached in component state for the session (re-fetches if panel is unmounted and remounted)
- Each section toggles independently; state kept in a `Set<number>` of open indices
- Search term filters the list; unmatched sections collapse and render at `opacity-40`; matched sections where the term appears in body auto-expand
- `z-index` sits below modals (`z-40`) but above the main layout
- First section open by default when no search term

**State:**
```ts
const [docs, setDocs] = useState<HowToDoc[]>([])
const [search, setSearch] = useState('')
const [openSections, setOpenSections] = useState<Set<number>>(new Set([0]))
const [loading, setLoading] = useState(false)
```

**`HowToDoc` type** (in `src/shared/types/system.types.ts` or a new `how-to.types.ts`):
```ts
interface HowToDoc {
  title: string      // extracted from first # heading
  order: number      // parsed from filename prefix NN
  content: string    // raw markdown string
}
```

### 3. IPC — `system:list-how-to`

Added to `src/main/ipc/system.ipc.ts`.

```ts
ipcMain.handle(IPC_CHANNELS.SYSTEM.LIST_HOW_TO, () => {
  const dir = path.join(app.getAppPath(), 'docs/how-to')
  if (!fs.existsSync(dir)) return { success: true, data: [] }
  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
  const docs = files.map((filename) => {
    const raw = fs.readFileSync(path.join(dir, filename), 'utf-8')
    const titleMatch = raw.match(/^#\s+(.+)$/m)
    const order = parseInt(filename.slice(0, 2), 10) || 99
    return { title: titleMatch?.[1] ?? filename, order, content: raw }
  })
  return { success: true, data: docs }
})
```

**IPC channel constant** added to `src/shared/constants/ipc-channels.ts`:
```ts
SYSTEM: {
  // ... existing ...
  LIST_HOW_TO: 'system:list-how-to',
}
```

**Preload** (`src/preload/index.ts`):
```ts
listHowTo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.LIST_HOW_TO),
```

**Bridge type** (`src/shared/types/ipc.types.ts`):
```ts
listHowTo: () => Promise<IpcResponse<HowToDoc[]>>
```

### 4. `docs/how-to/` initial files

Seeded from `docs/HOW-TO-KANBAN.md` (already written), split into focused per-feature files. Each file starts with a single `# Title` heading so the panel can extract it.

| File | Title | Content |
|------|-------|---------|
| `01-kanban.md` | Kanban Board | Columns, creating tasks, editing cards, drag & drop, filters, projects |
| `02-sprint-automation.md` | Sprint Automation | Sprint ↑ full flow, draft-ready indicator, preview, import, brief format |
| `03-voice-tts.md` | Voice & TTS | Voice modes per agent, Piper setup, keyboard shortcuts |
| `04-skills.md` | Skills | What skills are, how to run them from the dropdown |
| `05-agents.md` | Agents | Spawn, dispatch, breakout terminals, Code Blue |

`docs/HOW-TO-KANBAN.md` (the combined guide written earlier) is kept as-is — it remains the full reference. The per-feature files in `docs/how-to/` are focused extracts tuned for the panel's accordion format.

### 5. `.claude/how-to-index.md`

```markdown
# AgentHub How-To Index

Each file below is a user-facing guide for one AgentHub feature area.
Read the relevant file before working on that feature.
Update the file (or create a new one) when you add or refactor the feature.

- [Kanban Board](../docs/how-to/01-kanban.md) — columns, cards, drag & drop, filters, projects
- [Sprint Automation](../docs/how-to/02-sprint-automation.md) — Sprint ↑ flow, draft-ready indicator, import to Kanban
- [Voice & TTS](../docs/how-to/03-voice-tts.md) — voice modes, Piper setup, shortcuts
- [Skills](../docs/how-to/04-skills.md) — prompt templates, running skills from the dropdown
- [Agents](../docs/how-to/05-agents.md) — spawn, dispatch, breakout terminals, Code Blue
```

Imported in `CLAUDE.md` by adding `@.claude/how-to-index.md` to the imports block at the top.

### 6. `CLAUDE.md` rule addition

Added to the **Core Principles** section:

```
- **UPDATE HOW-TO DOCS** — When adding a new feature or refactoring an existing one,
  update (or create) the corresponding `docs/how-to/<NN-slug>.md` file. This file feeds
  both the in-app guide panel and LLM context via `.claude/how-to-index.md`. If no file
  exists for the feature yet, create one with the next available `NN` prefix. Write it
  in plain user-facing language — step-by-step instructions, no implementation details.
```

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/renderer/src/widgets/sa-bar/SABar.tsx` |
| Create | `src/renderer/src/widgets/how-to-panel/HowToPanel.tsx` |
| Modify | `src/main/ipc/system.ipc.ts` |
| Modify | `src/shared/constants/ipc-channels.ts` |
| Modify | `src/preload/index.ts` |
| Modify | `src/shared/types/ipc.types.ts` |
| Create | `docs/how-to/01-kanban.md` |
| Create | `docs/how-to/02-sprint-automation.md` |
| Create | `docs/how-to/03-voice-tts.md` |
| Create | `docs/how-to/04-skills.md` |
| Create | `docs/how-to/05-agents.md` |
| Create | `.claude/how-to-index.md` |
| Modify | `.claude/CLAUDE.md` |

---

## Global Constraints

- Check if `marked` is already in `package.json` before adding; if absent, add it (`npm install marked`)
- `app.getAppPath()` in the IPC handler returns the project root in dev mode (`npm run dev`) — `docs/how-to/` is not bundled into production builds; this feature targets dev/local use
- Panel must not block or overlay the Kanban board — fixed right drawer, not a modal
- IPC response must return `IpcResponse<HowToDoc[]>` consistent with existing response shape
- `docs/how-to/` files use `NN-slug.md` naming strictly; panel sort order derived from `NN` only
- `HowToDoc` type shared between main and renderer via `src/shared/types/`
- `CLAUDE.md` rule wording must be imperative and unambiguous — agents must not skip it
- No hardcoded section list in the component — discovery is purely filesystem-driven
