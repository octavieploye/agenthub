# Kanban Card Detail Popover — Design Spec
Date: 2026-06-21

## Problem

Kanban cards are compact by design — title is capped at 2 lines, `description`, `epicName`, `sprintName`, `sectionTargetDate` are invisible, and long `note` content is only partially visible via a CSS tooltip. Users have no way to read or edit the full card content without opening a separate modal.

## Solution

A hover-triggered, portal-rendered popover that floats beside the card, shows all fields, and allows full inline editing. It does not interrupt the kanban layout and does not conflict with the existing compact inline edit (✏ button).

---

## Architecture

### New files

```
src/renderer/src/widgets/kanban/KanbanCardPopover.tsx   — the floating popup component
```

### Modified files

```
src/renderer/src/widgets/kanban/KanbanCard.tsx          — hover timers, card ref, popover trigger
```

### Unchanged files

```
KanbanBoard.tsx     — onEdit / onDelete already wired, no changes needed
KanbanColumn.tsx    — no changes
ProjectManagerModal.tsx — no changes
```

### Rendering strategy

`KanbanCardPopover` renders via `ReactDOM.createPortal` into `document.body`. This guarantees it is never clipped by the kanban column's `overflow-y: auto` scroll container. It uses `position: fixed` so page scroll never displaces it.

Hover state and timer refs live inside `KanbanCard` — no external store or hook. Since only one card can be hovered at a time, this is safe and self-contained.

---

## Hover & Timer Behaviour

| Event | Action |
|---|---|
| `onMouseEnter` card (not editing, not action buttons) | Start 650ms open timer |
| Mouse leaves card before 650ms fires | Cancel open timer — no popup |
| 650ms fires | Capture `getBoundingClientRect()` → set position → show popover |
| `onMouseLeave` card (popover open) | Start 150ms close timer |
| `onMouseEnter` popover | Cancel close timer |
| `onMouseLeave` popover | Start 150ms close timer |
| Any field inside popover is focused | Suppress close on mouse-leave |
| ✕ button clicked | Immediate close |
| Card enters inline `editing` mode | Cancel any open timer; close popover if open |

### Open delay rationale

650ms is long enough that a user moving toward the ✏ or ✕ action buttons will have clicked before the popup fires. It clearly separates "reviewing a card" intent from "clicking an action" intent.

### Close delay rationale

150ms gives the mouse time to travel from the card edge to the popover edge without the popup collapsing mid-transit.

---

## Conflict Prevention

**Inline edit mode (`editing === true`):**
`onMouseEnter` on the card checks `if (editing) return` before starting any timer. The popover never opens while the compact inline edit form is active.

**Action buttons (✏ ✕):**
Footer action buttons receive `onMouseEnter={(e) => e.stopPropagation()}`. This prevents the event from bubbling to the card root, so the 650ms timer never starts when the user's mouse enters via the action area.

**Popover already open → card re-entered:**
If the popover is already visible, `onMouseEnter` on the card is a no-op (open timer guard checks `popoverVisible` state).

---

## Smart Positioning

Coordinates captured at the moment the 650ms timer fires via `cardRef.current.getBoundingClientRect()`.

```
popoverWidth  = 340px (fixed)
rightSpace    = window.innerWidth - card.right

if rightSpace >= popoverWidth + 12  →  place RIGHT  (left = card.right + 12)
else                                 →  place LEFT   (left = card.left - popoverWidth - 12)

top           = card.top
top           = min(top, window.innerHeight - popoverHeight - 12)   // clamp bottom
```

**Narrow screen fallback** (both sides too tight): centered horizontally via `left: 50%; transform: translateX(-50%)`. Unlikely in normal use since the kanban board requires a wide viewport.

**Height:** `max-h-[80vh] overflow-y-auto` — content scrolls inside the panel rather than pushing it off screen.

---

## Popover Content & Layout

Width: 340px fixed. Scrollable vertically.

```
[ Task title                          ✕ ]

Title          [ text input, full width     ]
Description    [ textarea, 3 rows           ]
───────────────────────────────────────────
Priority       [ select: High / Medium / Low ]
Status         [ select: all 6 statuses     ]
Category       [ input + datalist           ]
───────────────────────────────────────────
Note           [ textarea, 2 rows           ]
Epic           [ text input                 ]
Sprint         [ text input                 ]
Target date    [ date input                 ]
───────────────────────────────────────────
Created        2026-06-21  (read-only)
Updated        2026-06-21  (read-only)
───────────────────────────────────────────
                          [ Cancel ] [ Save ]
```

### All editable fields

| Field | Input type | Maps to `UpdateTaskInput` |
|---|---|---|
| Title | `<input>` | `title` |
| Description | `<textarea>` | `description` |
| Priority | `<select>` | `priority` |
| Status | `<select>` | `status` |
| Category | `<input>` + `<datalist>` | `category` |
| Note | `<textarea>` | `note` |
| Epic | `<input>` | `epicName` |
| Sprint | `<input>` | `sprintName` |
| Target date | `<input type="date">` | `sectionTargetDate` |

### Read-only metadata

`createdAt`, `updatedAt` — displayed as formatted date strings, not editable.

### Save behaviour

Explicit Save button calls `onEdit(changedFields)` then closes the popover. Cancel discards changes and closes. While any field inside the popover is focused, `onMouseLeave` close is suppressed — the user can safely type without the popup vanishing.

### Note tooltip removal

The existing `hidden group-hover:block` CSS tooltip on the card (showing raw note text) is removed. The `✎` indicator in the footer stays as a visual hint. The popover renders the full note content, making the tooltip redundant.

---

## Relationship to Existing Inline Edit

The compact ✏ inline edit (title / category / note only) is kept as-is. It serves a different purpose:

| | Inline edit (✏) | Popover |
|---|---|---|
| Trigger | Explicit click | Hover (650ms) |
| Fields | Title, category, note | All fields |
| Use case | Quick rename / note tweak | Full review + edit |
| Layout impact | Replaces card in-column | Floats beside card |

---

## Files Changed Summary

| File | Change |
|---|---|
| `KanbanCard.tsx` | Add `cardRef`, hover timer refs, `onMouseEnter`/`onMouseLeave`, suppress rules, popover state, remove note tooltip |
| `KanbanCardPopover.tsx` | New component — portal, fixed positioning, all fields, Save/Cancel |
| `KanbanBoard.tsx` | No changes |
| `KanbanColumn.tsx` | No changes |
| `task.types.ts` | No changes |
