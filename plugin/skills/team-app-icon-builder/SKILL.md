---
name: team-app-icon-builder
description: App Icon Builder Team Orchestrator — researches OS icon specs, converts SVG logo to all required formats (macOS icns, Windows ico, Android png set, iOS png set, Linux png), verifies output, self-updates OS knowledge base
category: dev-skills
---

# App Icon Builder Team

Converts a source SVG logo into a complete, verified icon set for any OS target (macOS, Windows, Android, iOS, Linux/Ubuntu). Self-updates its OS knowledge base after every new platform build.

## When to Use

- "Build the dock icon for [OS]"
- "Convert our logo SVG to app icons"
- "I need icons for macOS / Windows / Android / iOS / Linux"
- "Generate all icon sizes from this SVG"
- After creating or updating an app logo SVG

## What You Need Before Starting

1. **Source SVG path** — fully qualified path to the logo SVG file
2. **Target OS** — one or more of: macOS, Windows, Android, iOS, Linux/Ubuntu
3. **Output directory** — where to place the generated icons (defaults to `build/` for Electron apps)
4. **App type** — Electron desktop, native mobile, web, or standalone binary (affects which formats are required)

## Agent Sequence

```
icon-lead (orchestrator)
  └─► icon-researcher   — loads OS spec from os-knowledge/ or researches it
  └─► icon-builder      — converts SVG to all required formats for the OS
  └─► icon-verifier     — checks dimensions, color space, alpha, sizes
       └─► knowledge-append  — if new OS, appends spec to os-knowledge/
```

Max 3 active teammates at once. icon-lead does not count toward the cap.

## What This Team Produces

| OS | Formats | Key Files |
|---|---|---|
| macOS | `.icns` + `.png` | `icon.icns`, `icon.png` |
| Windows | `.ico` | `icon.ico` |
| Android | `.png` set | `mipmap-*dpi/ic_launcher.png` |
| iOS | `.png` set | `AppIcon.appiconset/` |
| Linux/Ubuntu | `.png` set | `hicolor/*x*/apps/` |

## Key Rules

- **Never use ImageMagick (`magick`) for SVG→PNG** — it silently converts to grayscale, stripping all color
- **Never use qlmanage** — adds white background, eliminating transparency
- **Always use `rsvg-convert`** — only tool verified to produce sRGB + transparent output on macOS
- **Check `rsvg-convert` is installed** before starting: `which rsvg-convert` — install via `brew install librsvg` if missing
- **Verify color space** after every conversion: `magick identify output.png` must show `sRGB`, not `Gray`
- **Verify alpha** at corner pixel (0,0): alpha must be 0 (transparent) for non-full-bleed icons
- After building a new OS for the first time, icon-verifier MUST trigger knowledge-append

## Self-Updating Knowledge Base

OS specs live in `.claude/workflow-team-library/app-icon-builder/os-knowledge/`.
When a new OS is built, icon-verifier appends a structured spec file there.
On subsequent runs for the same OS, icon-researcher loads from that file — no re-research needed.
