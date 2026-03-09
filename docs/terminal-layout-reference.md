# Claude Code Terminal Layout Reference

> Extracted from Claude Code v2.1.69 (compiled binary wrapping Ink-based React TUI).
> Source: `/opt/homebrew/Caskroom/claude-code/2.1.69/claude` + npm package `@anthropic-ai/claude-code@2.1.71`.

---

## 1. Rendering Stack

Claude Code uses **Ink** (React for CLI terminals) as its rendering engine. Ink uses Yoga (flexbox) for layout and outputs ANSI escape sequences. The binary bundles:

- **Ink** — React-based terminal UI framework (flexbox layout via Yoga)
- **Chalk** — ANSI color/style library
- **cli-highlight** — syntax highlighting for code blocks
- **Marked** — Markdown lexer/parser (rendered to ANSI, not raw)

The terminal's own font, character width, and line height are inherited from the host terminal emulator. Claude Code does NOT set fonts or pixel dimensions — it operates in character cells only.

---

## 2. Layout Model (Ink/Yoga Flexbox)

All layout is flexbox-based. Key patterns extracted from source:

### Primary Layout Direction
```
flexDirection: "column"   — 707 occurrences (dominant)
flexDirection: "row"      — 153 occurrences
```

### Common Spacing (in character cells)
| Property       | Common Values     | Frequency |
|----------------|-------------------|-----------|
| `marginTop`    | 1                 | 278       |
| `gap`          | 1                 | 154       |
| `marginBottom` | 1                 | 130       |
| `paddingLeft`  | 2                 | 44        |
| `marginLeft`   | 2                 | 40        |
| `marginLeft`   | 3                 | 25        |
| `paddingLeft`  | 1                 | 23        |
| `paddingLeft`  | 3                 | 8         |
| `paddingRight` | 1                 | 9         |
| `paddingBottom`| 1                 | 6         |
| `gap`          | 4                 | 9         |
| `gap`          | 2                 | 6         |
| `gap`          | 0                 | 8         |

### Width
```
width: "100%"   — 51 occurrences (full terminal width)
width: 28       — 13 occurrences
width: 10       — 6 occurrences
width: 2        — 10 occurrences
```

### Flex Properties
```
flexShrink: 0   — 23 occurrences
flexGrow: 1     — 15 occurrences
flexShrink: 1   — 13 occurrences
flexGrow: 0     — 8 occurrences
```

### Text Wrapping
```
wrap: "truncate"     — 44 occurrences (default for constrained areas)
wrap: "wrap"         — 18 occurrences
wrap: "truncate-end" — 5 occurrences
```

---

## 3. Border Styles

Claude Code uses Ink's built-in border styles. The **round** style is dominant.

### Border Style Frequency
| Style    | Count | Usage                         |
|----------|-------|-------------------------------|
| `round`  | 34    | Tool blocks, primary containers |
| `dashed` | 7     | Secondary/inactive containers |
| `single` | 3     | Minimal containers            |

### Round Border Characters (PRIMARY — used for tool blocks)
```
topLeft:     ╭
top:         ─
topRight:    ╮
right:       │
bottomRight: ╯
bottom:      ─
bottomLeft:  ╰
left:        │
```

### Single Border Characters
```
topLeft:     ┌
top:         ─
topRight:    ┐
right:       │
bottomRight: ┘
bottom:      ─
bottomLeft:  └
left:        │
```

### Dashed Border Characters
```
topLeft:     ┌
top:         ╌
topRight:    ┐
right:       │  (or ╎)
bottomRight: ┘
bottom:      ╌
bottomLeft:  └
left:        │  (or ╎)
```

### Border Colors (semantic names)
| Border Color   | Count | Usage                    |
|----------------|-------|--------------------------|
| `subtle`       | 8     | Default inactive borders |
| `planMode`     | 3     | Plan mode containers     |
| `permission`   | 3     | Permission request boxes |
| `warning`      | 2     | Warning boxes            |
| `error`        | 2     | Error boxes              |
| `success`      | 1     | Success boxes            |
| `inactive`     | 1     | Disabled state           |
| `claude`       | 1     | Claude branding          |
| `cyan_FOR_SUBAGENTS_ONLY` | 1 | Subagent containers |

---

## 4. Color Theme

Claude Code supports multiple theme variants (dark 256-color, dark truecolor, light 256-color, light truecolor, and ANSI fallback). Below are all semantic color names with their values across themes.

### Dark Terminal — ANSI Fallback (basic 16-color)
| Semantic Name              | ANSI Color        |
|----------------------------|--------------------|
| `claude`                   | `ansi:redBright`   |
| `text`                     | `ansi:whiteBright`  |
| `error`                    | `ansi:redBright`   |
| `warning`                  | `ansi:yellowBright` |
| `success`                  | `ansi:greenBright`  |
| `subtle`                   | `ansi:blackBright`  |
| `permission`               | `ansi:blueBright`   |
| `suggestion`               | `ansi:blueBright`   |
| `bashBorder`               | `ansi:magentaBright`|
| `promptBorder`             | `ansi:white`       |
| `planMode`                 | `ansi:cyanBright`   |
| `fastMode`                 | `ansi:redBright`   |
| `inactive`                 | `ansi:blackBright`  |
| `remember`                 | `ansi:blueBright`   |
| `ide`                      | `ansi:blueBright`   |
| `chromeYellow`             | `ansi:yellowBright` |
| `clawd_body`               | `ansi:redBright`   |
| `clawd_background`         | `ansi:black`       |
| `inverseText`              | `ansi:black`       |
| `userMessageBackground`    | `ansi:blackBright`  |
| `cyan_FOR_SUBAGENTS_ONLY`  | `ansi:cyanBright`   |
| `diffAdded`                | `ansi:green`       |
| `diffRemoved`              | `ansi:red`         |
| `diffAddedWord`            | `ansi:greenBright`  |
| `diffRemovedWord`          | `ansi:redBright`   |
| `professionalBlue`         | `ansi:blueBright`   |
| `background`               | `ansi:cyanBright`   |

### Dark Terminal — Truecolor (RGB)
| Semantic Name              | RGB Value            |
|----------------------------|----------------------|
| `claude`                   | `rgb(215,119,87)`    |
| `text`                     | `rgb(255,255,255)`   |
| `error`                    | `rgb(255,107,128)` or `rgb(255,102,102)` |
| `warning`                  | `rgb(255,204,0)` or `rgb(255,193,7)` |
| `success`                  | `rgb(78,186,101)` or `rgb(44,122,57)` |
| `subtle`                   | `rgb(175,175,175)` or `rgb(80,80,80)` |
| `permission`               | `rgb(177,185,249)` or `rgb(153,204,255)` |
| `suggestion`               | `rgb(177,185,249)` or `rgb(87,105,247)` |
| `bashBorder`               | `rgb(253,93,177)` or `rgb(255,0,135)` |
| `promptBorder`             | `rgb(136,136,136)` or `rgb(153,153,153)` |
| `planMode`                 | `rgb(72,150,140)` or `rgb(102,153,153)` |
| `fastMode`                 | `rgb(255,106,0)` or `rgb(255,120,20)` |
| `inactive`                 | `rgb(102,102,102)` or `rgb(153,153,153)` |
| `remember`                 | `rgb(177,185,249)` or `rgb(153,204,255)` |
| `ide`                      | `rgb(71,130,200)`    |
| `chromeYellow`             | `rgb(251,188,4)`     |
| `clawd_body`               | `rgb(215,119,87)`    |
| `clawd_background`         | `rgb(0,0,0)`         |
| `inverseText`              | `rgb(0,0,0)`         |
| `diffAdded`                | `rgb(105,219,124)`   |
| `diffRemoved`              | `rgb(255,168,180)`   |
| `diffAddedWord`            | `rgb(56,166,96)`     |
| `diffRemovedWord`          | `rgb(209,69,75)`     |
| `professionalBlue`         | `rgb(106,155,204)`   |
| `cyan_FOR_SUBAGENTS_ONLY`  | `rgb(102,204,204)`   |

### Light Terminal — Truecolor (RGB)
| Semantic Name              | RGB Value            |
|----------------------------|----------------------|
| `claude`                   | `rgb(255,153,51)`    |
| `text`                     | `rgb(0,0,0)`         |
| `error`                    | `rgb(204,0,0)` or `rgb(171,43,63)` |
| `warning`                  | `rgb(150,108,30)` or `rgb(255,153,0)` |
| `success`                  | `rgb(0,102,153)` or `rgb(51,153,255)` |
| `subtle`                   | `rgb(80,80,80)`      |
| `permission`               | `rgb(51,102,255)` or `rgb(87,105,247)` |
| `bashBorder`               | `rgb(0,102,204)` or `rgb(51,153,255)` |
| `promptBorder`             | `rgb(153,153,153)`   |
| `planMode`                 | `rgb(0,102,102)` or `rgb(51,102,102)` |
| `inactive`                 | `rgb(153,153,153)`   |
| `inverseText`              | `rgb(255,255,255)`   |
| `diffAdded`                | `rgb(34,92,43)` or `rgb(0,68,102)` |
| `diffRemoved`              | `rgb(122,41,54)` or `rgb(102,0,0)` |
| `diffAddedWord`            | `rgb(47,157,68)` or `rgb(0,119,179)` |
| `diffRemovedWord`          | `rgb(153,51,51)` or `rgb(179,0,0)` |
| `cyan_FOR_SUBAGENTS_ONLY`  | `rgb(8,145,178)`     |

> Note: Multiple RGB values for the same name indicate different sub-themes (e.g., dark-high-contrast vs dark-standard). The first value listed is the most common.

---

## 5. Markdown Rendering Rules

Claude Code renders Markdown to ANSI-styled terminal text using Marked's lexer + custom token renderer. The rules are:

### Headings
```
# H1   → bold + italic + underline + double newline after
## H2  → bold + double newline after
### H3+ → bold + double newline after
```

### Inline Styles
```
**bold**      → ANSI bold (ESC[1m)
*italic*      → ANSI italic (ESC[3m)
`code span`   → colored with "permission" theme color
```

### Code Blocks
````
```language
code here
```
````
- Rendered with syntax highlighting via `cli-highlight` (uses `highlight.js` language detection)
- Supported languages: full highlight.js set
- Highlight theme uses chalk colors:
  - `keyword` → blue
  - `built_in` → cyan
  - `type` → cyan dim
  - `literal` → blue
  - `number` → green
  - `regexp` → red
  - `string` → red
  - `comment` → green
  - `function` → yellow
  - `meta` → grey
  - `name` → blue
  - `attr` → cyan
  - `strong` → bold
  - `emphasis` → italic
  - `link` → underline
  - `addition` → green
  - `deletion` → red
- Followed by a single newline

### Lists
```
- Unordered: "- " prefix, 2-space indent per nesting level
- Ordered L0: "1." "2." etc (arabic numerals)
- Ordered L2: lowercase letters (a, b, c...)
- Ordered L3: lowercase roman (i, ii, iii...)
```

### Blockquotes
```
> text → dim + italic
```

### Links
```
[text](url) → rendered as OSC 8 hyperlinks (clickable in supporting terminals)
              Falls back to showing URL if hyperlinks unsupported
```

### Tables
```
| Header | Header |     → pipes with space padding, aligned to column width
|--------|--------|     → dash separator row
| Cell   | Cell   |     → aligned cells (supports left/center/right alignment)
```

### Horizontal Rules
```
---  → literal "---" string
```

### GitHub Issue References
```
#123 → automatically linked to repo's GitHub issues (OSC 8 hyperlink)
       Only when inside a git repository
```

---

## 6. Tool Use Blocks

Tool invocations (Bash, Read, Write, etc.) are rendered as bordered boxes:

### Structure
```
╭──────────────────────────────────────────╮
│  Tool Name  description text             │
│                                          │
│  [tool output content]                   │
│                                          │
╰──────────────────────────────────────────╯
```

### Formatting Details
- **Border style**: `round` (╭╮╯╰ corners, ─ horizontal, │ vertical)
- **Border color**: varies by tool type:
  - Bash/shell commands: `bashBorder` (magenta/pink family)
  - Permission requests: `permission` (blue family)
  - Errors: `error` (red family)
  - Success: `success` (green family)
  - Default: `subtle` (gray family)
- **Inner padding**: `paddingLeft: 2` (2 chars from left border to content)
- **Width**: `100%` of terminal width
- **Margin**: `marginTop: 1` (1 blank line above), sometimes `marginBottom: 1`

### Bash Tool Block Specifics
- Border color: `bashBorder` — `rgb(253,93,177)` (hot pink) in dark truecolor
- Description text shown on same line or below tool name
- Output content displayed with original formatting preserved

---

## 7. Prompt Area

### Input Prompt
- Uses the `❯` (U+276F) pointer character from the figures/symbols set
- Prompt border color: `promptBorder` — `rgb(136,136,136)` (medium gray)
- User input text color: `text` — white on dark, black on light

### Spinner / Loading Indicators
- macOS spinner frames: `["·|·", "·/·", "·—·", "·\\·"]`
- Recording indicator (macOS): `⏺` (U+23FA)
- Recording indicator (other): `●` (U+25CF)
- Status icons:
  - Success: `✔` (U+2714)
  - Error/cross: `✘` (U+2718)
  - Info: `ℹ` (U+2139)
  - Warning: `⚠` (U+26A0)
  - Bullet: `●` (U+25CF)
  - Lozenge: `◆` (U+25C6)
  - Play: `▶` (U+25B6)
  - Small triangle right: `▸` (U+25B8)

### Tool Progress Prefix
```
"  ▸ "  — 2 spaces + small right triangle + 1 space (4 chars total)
```

---

## 8. Status Elements

### Completion Indicators
```
✔︎  — success/done (with variation selector)
×   — failure/cancel
·   — separator dot in spinner
```

### iTerm2 Progress Integration
Claude Code sends iTerm2 proprietary escape sequences for progress bars:
- `SET` — set progress percentage (0-100)
- `CLEAR` — clear progress
- `ERROR` — show error state
- `INDETERMINATE` — show indeterminate progress

### Terminal Notifications
- **iTerm2**: proprietary escape sequences
- **Kitty**: `i=ID:d=0:p=title` / `i=ID:p=body` / `i=ID:d=1:a=focus`
- **Ghostty**: `notify` escape sequence
- **Fallback**: BEL character (`\x07`)

---

## 9. Diff Rendering

File diffs use semantic diff colors:

### Added Lines
- Background/text: `diffAdded` — `rgb(105,219,124)` (light green) dark / `rgb(34,92,43)` (dark green) light
- Highlighted words: `diffAddedWord` — `rgb(56,166,96)` (brighter green)

### Removed Lines
- Background/text: `diffRemoved` — `rgb(255,168,180)` (light pink) dark / `rgb(122,41,54)` (dark red) light
- Highlighted words: `diffRemovedWord` — `rgb(209,69,75)` (brighter red)

---

## 10. Terminal Behavior

### Text Wrapping
- Ink handles wrapping at the terminal width boundary
- Most constrained areas use `truncate` mode (ellipsis at end)
- Free-form content areas use `wrap` mode
- Terminal width is detected via `process.stdout.columns`

### Streaming
- Responses stream token-by-token from the API
- Ink re-renders the full React tree on each state change
- Ink uses a virtual terminal buffer and diffs against previous render to minimize ANSI output
- Cursor is hidden during render, shown during input

### Scrollback
- Claude Code writes to stdout — scrollback is handled entirely by the host terminal
- No internal scrollback buffer; relies on terminal emulator's scrollback

### Cursor Behavior
- Hidden during AI response streaming
- Shown at prompt input position
- Positioned via ANSI cursor movement sequences

---

## 11. Key Measurements Summary (Character Cells)

For xterm.js replication, these are the critical spacing values:

```
TOOL_BLOCK_PADDING_LEFT     = 2    chars
TOOL_BLOCK_MARGIN_TOP       = 1    line
TOOL_BLOCK_WIDTH            = 100% (terminal columns)
TOOL_BLOCK_BORDER           = round (╭─╮│╯─╰│)

INDENT_PER_LEVEL            = 2    chars ("  ")
LIST_BULLET                 = "- "  (2 chars)
TOOL_PROGRESS_PREFIX        = "  ▸ " (4 chars)

SECTION_GAP                 = 1    blank line (gap:1 or marginTop:1)
NESTED_MARGIN_LEFT          = 2-3  chars

PROMPT_CHAR                 = "❯"   (U+276F)

HEADING_TRAILING_NEWLINES   = 2    (all heading levels)
PARAGRAPH_TRAILING_NEWLINES = 1
CODE_BLOCK_TRAILING_NEWLINES = 1
```

---

## 12. ANSI Escape Sequences Used

### Text Styling
```
ESC[1m    — Bold
ESC[3m    — Italic
ESC[4m    — Underline
ESC[2m    — Dim
ESC[7m    — Inverse
ESC[0m    — Reset all
```

### Color (truecolor mode)
```
ESC[38;2;R;G;Bm  — Set foreground RGB
ESC[48;2;R;G;Bm  — Set background RGB
```

### Color (256-color mode)
```
ESC[38;5;Nm  — Set foreground 256-color
ESC[48;5;Nm  — Set background 256-color
```

### Color (basic ANSI)
```
ESC[30-37m    — Standard foreground colors
ESC[90-97m    — Bright foreground colors
ESC[40-47m    — Standard background colors
ESC[100-107m  — Bright background colors
```

### Cursor Control
```
ESC[?25h  — Show cursor
ESC[?25l  — Hide cursor
ESC[H     — Cursor home
ESC[A/B/C/D — Cursor up/down/forward/back
ESC[K     — Erase to end of line
ESC[J     — Erase to end of screen
```

### OSC Sequences
```
ESC]8;;URL\x07 TEXT ESC]8;;\x07  — Hyperlinks (OSC 8)
ESC]0;TITLE\x07                  — Set terminal title
```

---

## 13. Replication Notes for xterm.js

To replicate Claude Code's rendering in xterm.js:

1. **Font**: Use any monospace font. Claude Code does not specify a font — it inherits the terminal's. Common choices: `JetBrains Mono`, `Fira Code`, `Menlo`, `Monaco`.

2. **Color detection**: Claude Code auto-detects terminal color support (basic, 256, truecolor) and selects the appropriate theme variant. For xterm.js, use truecolor (RGB) values.

3. **Box drawing**: Use Unicode box drawing characters directly. xterm.js renders them natively. Ensure the font has full Unicode box drawing coverage.

4. **Layout**: Ink/Yoga flexbox translates to sequential line output with manual spacing. For xterm.js, implement spacing by inserting blank lines (marginTop/Bottom) and space characters (paddingLeft, marginLeft).

5. **Borders**: Build bordered boxes by composing corner and edge characters manually:
   ```
   ╭ + ─×(width-2) + ╮
   │ + content + padding + │
   ╰ + ─×(width-2) + ╯
   ```

6. **Streaming**: Write characters as they arrive. xterm.js handles incremental writes natively.

7. **Width**: Use `terminal.cols` for full-width calculations. Tool blocks span the full width.
