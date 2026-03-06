---
phase: quick-6
plan: 01
subsystem: background, settings, storage
tags: [context-menu, defaults, settings-ui, info-toggles]
dependency_graph:
  requires: []
  provides: [scan-context-menu, demo-content, info-toggles]
  affects: [background.ts, storage.ts, settings/App.tsx]
tech_stack:
  added: []
  patterns: [expandable-info-toggles, per-tab-scan-state-map]
key_files:
  created: []
  modified:
    - entrypoints/background.ts
    - utils/storage.ts
    - entrypoints/settings/App.tsx
decisions:
  - autoCopyOnEncode default changed from false to true
  - Scan toggle is first context menu item, above Decrypt
  - Info toggles replace static helper text rather than duplicating
metrics:
  duration: 3min
  completed: "2026-03-06T10:02:39Z"
---

# Quick Task 6: Scan Toggle Context Menu, Demo Content, Settings UX

Scan page toggle added as first context menu item with dynamic title; demo password and snippets seeded on fresh install; settings dropdowns widened and info toggles added to every setting.

## Task Results

### Task 1: Scan context menu toggle, demo content on install, default change

| Aspect | Detail |
|--------|--------|
| Commit | `67a3817` |
| Files | `entrypoints/background.ts`, `utils/storage.ts` |

**Changes:**
- Added `tabScanState` Map to track per-tab scan state
- Created `updateScanMenuItem()` for dynamic context menu title
- Added "Stegano - Scan Page for Hidden Characters" as first context menu item in `buildSnippetMenus()`
- Scan toggle click handler in `contextMenus.onClicked` calls existing `handleScanToggle()`
- `handleScanToggle` now updates tabScanState and menu title on toggle on/off
- `tabs.onUpdated` clears scan state on navigation; `tabs.onActivated` updates menu title
- `runtime.onInstalled` seeds demo password ("SteGan0 RuLe5") and 2 snippets (plain + encrypted) on fresh install only
- `autoCopyOnEncodeSetting` fallback changed from `false` to `true`

### Task 2: Widen settings dropdowns and add info toggles

| Aspect | Detail |
|--------|--------|
| Commit | `40e3163` |
| Files | `entrypoints/settings/App.tsx` |

**Changes:**
- All 4 select elements changed from `max-w-xs` to `max-w-md`
- Keyboard shortcuts container also widened to `max-w-md`
- Added `expandedInfo` state object for tracking expanded info sections
- Added "?" toggle buttons to 6 settings: Auto-copy, Auto-detect encrypted, Snippet paste mode, Scan mode, Detection sensitivity, Highlight colors
- Static helper text replaced by toggle-gated detailed descriptions
- Consistent styling: circular badge button, bordered info panel with subtle background

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm build` passes successfully (165.31 KB total output)
- Pre-existing `pnpm compile` errors in unrelated files (popup/App.tsx, decrypt-prompt.ts) - not caused by this task

## Self-Check

Verified via build output and commit history.
