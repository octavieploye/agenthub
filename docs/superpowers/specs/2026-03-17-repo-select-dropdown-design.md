# Repo Select Dropdown — Design Spec

## Problem

The current repository selection in SpawnDialog uses a native `<select>` element that:
- Opens upward with a transparent background, making text unreadable
- Offers no search/filter capability
- Cannot show visual differentiation between repos
- Cannot support inline removal of repos
- Provides no control over styling or animations

## Solution

Replace the native `<select>` with a custom **command-palette style floating dropdown** featuring liquid glass aesthetics, search/filter, color-coded folder icons, and inline repo removal with undo.

## Component: `RepoSelectDropdown`

### Structure

```
[Trigger Button]
  └─ [Floating Panel]  (opens DOWNWARD, repositions upward if clipped by viewport)
       ├─ [Search Input] (auto-focused)
       ├─ [Section: Recent]
       │    └─ [RepoListItem] ...
       ├─ [Section: All Repositories]  (excludes repos already shown in Recent)
       │    └─ [RepoListItem] ...
       └─ [Footer: "Custom path..."]
```

### Trigger Button
- Displays currently selected repo: colored folder icon + bold name
- Placeholder text "Select repository..." when nothing selected
- Clicking toggles the floating panel

### Floating Panel — Liquid Glass
- **Background:** `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0.08) 100%)`
- **Backdrop:** `backdrop-filter: blur(20px) saturate(1.8)`
- **Border:** `1px solid rgba(255,255,255,0.15)`
- **Radius:** `rounded-2xl`
- **Shadow:** `0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.2)`
- **Specular stripe:** `h-px` at top with `bg-gradient-to-r from-transparent via-white/20 to-transparent`
- **Max height:** 350px, width matches trigger (min 300px)
- **Scroll:** list area only, search stays fixed
- **Direction:** opens downward by default; repositions upward if insufficient viewport space below
- **Fallback:** solid `bg-base-200` when `prefers-reduced-transparency` is active
- **Open animation:** 150ms opacity + translateY(-4px -> 0), ease-out
- **Close animation:** 100ms opacity fade

### Search Input
- Small search icon on the left
- `bg-base-300/50 rounded-lg` with 8px padding
- Auto-focused on panel open
- Filters both "Recent" and "All" sections
- Case-insensitive, partial match on name and path
- Empty results: "No repositories found" muted text

### List Item Layout (48px height)
- **Left:** 20x20 folder icon filled with repo's `glowColor` (repurposed as folder color — see Data Changes)
- **Center line 1:** `text-sm font-semibold text-base-content` — repo name
- **Center line 2:** `text-xs text-base-content/50` — repo path (truncated with ellipsis)
- **Right:** hover-revealed X button (`text-base-content/30` → `text-error` on hover, 16x16)
- **Hover:** `bg-base-content/10` immediate highlight (no delay)
- **Active/pressed:** `bg-base-content/15`
- **Selected:** subtle checkmark on the right

### Section Headers
- `text-xs text-base-content/40 uppercase tracking-wide` with 4px bottom margin
- "Recent" — max 3 repos, sorted by `lastUsedAt` DESC
- "All Repositories" — alphabetical sort, **excludes repos already in Recent section**

### Footer
- "Custom path..." option at bottom
- Selecting it closes dropdown and reveals the manual CWD input field

### Accessibility (ARIA)
- Panel root: `role="combobox"` with `aria-expanded`, `aria-haspopup="listbox"`
- Search input: `role="searchbox"` with `aria-controls` pointing to the list
- List: `role="listbox"`
- Items: `role="option"` with `aria-selected`
- Active item tracked via `aria-activedescendant` on the search input

## Color Picker

- **Trigger:** right-click on folder icon in list item (desktop-only interaction)
- **Popover:** small inline palette with 5-8 swatches from existing agent color palette + custom color input
- **Behavior:** click swatch → saves `glowColor` to DB immediately, popover closes
- Does not interfere with normal item click (select repo)

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Click trigger | Toggle panel open/close |
| Escape | Close panel |
| Click outside | Close panel |
| Arrow Up/Down | Navigate list items |
| Enter | Select highlighted item |
| Type in search | Filter list in real-time |

## Data Changes

### RepoConfig — Reuse `glowColor`, Add `lastUsedAt`

The existing `glowColor` field on `RepoConfig` is repurposed as the folder icon color. No new color field needed — this avoids confusion from having two color fields.

Add to `src/shared/types/config.types.ts`:
- `lastUsedAt?: string` — ISO timestamp, updated on each spawn with this repo

### DB Migration (010-repo-last-used.sql)
```sql
ALTER TABLE repos ADD COLUMN last_used_at TEXT;
```

Only one column added. `glowColor` already exists (mapped to `glow_color` column from migration 005).

### `lastUsedAt` Update Mechanism
Updated in the main process spawn handler (`agent-manager.ts`) after successful agent creation. The spawn flow already has `repoId` — add a `UPDATE repos SET last_used_at = ? WHERE id = ?` call with the current ISO timestamp.

### Sorting Logic
1. "Recent" section: top 3 repos with `lastUsedAt` set, sorted by `lastUsedAt` DESC
2. "All Repositories" section: remaining repos alphabetical by name (excludes those in Recent)

## Removal Flow

1. User hovers list item → X button appears on right
2. Click X → repo removed from list immediately (optimistic UI)
3. Undo toast appears at bottom-center: `bg-base-300 rounded-lg shadow-lg`
   - Text: "Repo removed." + accent-colored "Undo" link
   - Auto-dismiss after 6 seconds
4. If "Undo" clicked → repo restored to list
5. If timer expires → repo row deleted from `repos` table

**Cascade behavior:** Removing a repo does NOT affect existing agents or history. Agents store their `repoId` and `cwd` independently — the repo entry is only used for the dropdown list. Historical agent records remain intact with their original `repoId` as a string reference.

## File Plan

| File | Action |
|------|--------|
| `src/renderer/src/widgets/spawn-dialog/RepoSelectDropdown.tsx` | New — main component |
| `src/renderer/src/widgets/spawn-dialog/RepoListItem.tsx` | New — list item with folder icon + delete |
| `src/renderer/src/widgets/spawn-dialog/FolderColorPicker.tsx` | New — inline color palette popover |
| `src/renderer/src/widgets/spawn-dialog/SpawnDialog.tsx` | Edit — replace native `<select>` with `RepoSelectDropdown` |
| `src/shared/types/config.types.ts` | Edit — add `lastUsedAt` to RepoConfig |
| `src/main/db/migrations/010-repo-last-used.sql` | New — add `last_used_at` column |
| `src/main/services/agent-manager.ts` | Edit — update `last_used_at` on spawn |
| `src/renderer/src/components/UndoToast.tsx` | New — reusable undo toast component |

## Out of Scope

- Drag-to-reorder repos
- Repo grouping/tagging
- Multi-select repos
- Repo settings beyond folder color
