# AgentHub — Commercial Installation & Marketplace Strategy

_Date: 2026-07-13_

---

## Current Installation Reality

### Mac
- `electron-builder --mac` → `.dmg` with drag-to-Applications
- `notarize: false` is set in `electron-builder.yml:36` — **zero notarization currently**. Commercial release needs it or Gatekeeper blocks the app with "damaged app" error.
- Requires Apple Developer account ($99/yr) + `electron-notarize` package + App Store Connect API key.

### Windows
- `electron-builder --win` → NSIS `.exe` installer (configured in `electron-builder.yml:23-27`)
- **No code signing configured** — SmartScreen will flag every install with "Windows protected your PC" warning, directly harming conversion.
- Requires an EV code signing certificate (~$300-600/yr from DigiCert, Sectigo, etc.) — regular OV certs no longer suppress SmartScreen since 2023.

### Linux
- AppImage + snap + deb all configured (`electron-builder.yml:40-46`)
- No OS-level signing gate equivalent to Mac/Windows — AppImage is unsigned, snap uses Snapcraft's own signing.
- Lowest friction for distribution; no commercial blocker here.

---

## The Commercial Empty-State + Opeidos Marketplace Vision

Currently the app is entirely local-skill driven. `SkillsDropdown` reads from `plugin/skills/` (bundled) and `.claude/skills/` (project-local). There is no remote fetch layer, no install mechanism, and no empty-first-launch UX.

### Target commercial flow

```
Current:
  Launch app → empty agent list → user spawns agent manually

Commercial:
  Launch app → "Welcome / Choose your workflows" screen
               → browse Opeidos catalog (remote or bundled stub)
               → pick up to 4 → install locally
               → arrive at main UI with those 4 visible in Skills dropdown
```

### Three distinct pieces to build

**1. First-Launch Onboarding Screen**
A gate shown when `installed_workflows = []` in the DB. Presents the 4-workflow picker before the user sees an agent terminal. Full-screen modal over the existing app.

**2. Workflow Marketplace Dropdown/Panel**
A persistent button alongside the existing Skills button in the SA bar. Opens a panel showing:
- All available Opeidos workflows (initially bundled static JSON, later fetched from `opeidos.com/api/catalog`)
- Each card: name, description, category tag, Install / Installed state
- Install = downloads `.md` files into `plugin/skills/<workflow-name>/`

**3. Static Bundled Catalog (Phase 1)**
Ship a `plugin/marketplace-catalog.json` with ~20-30 workflow entries. No network required. Install copies bundled files from `plugin/marketplace/` into the active skills folder. Opeidos live API replaces this in Phase 2.

---

## Recommended Build Order

1. **Mac notarization** — `notarize: false` → Apple Developer setup (hard blocker for non-technical buyers)
2. **Windows EV code signing** — SmartScreen warnings kill trust for a tool that runs `--dangerously-skip-permissions`
3. **First-launch workflow picker** with bundled catalog (no live API dependency)
4. **"Browse Marketplace" button** in Skills dropdown, opens same panel
5. **Live Opeidos API** replaces bundled catalog when the marketplace is ready

### Why this order matters
- SmartScreen and Gatekeeper warnings are hard blockers for the 40-50y non-technical buyer persona before any UX conversation starts.
- The 4-workflow picker is a strong onboarding hook but presupposes knowing which 4 workflows convert best — run a validation sprint before building.
- The bundled catalog approach lets you ship a "marketplace feel" without depending on Opeidos being live.

---

## Open Questions (for product decision, not engineering)

- Which 4 workflows are shown as defaults / featured in the picker?
- Does the marketplace require an Opeidos account to browse, or is it always open?
- Paid workflows vs free: is install gated behind a purchase flow (LemonSqueezy) or post-install activation?
- Does AgentHub phone home to check installed workflow versions / updates?
