---
phase: quick-1
plan: 01
subsystem: ui
tags: [dark-mode, tailwind, preact, storage, scanner]

requires:
  - phase: 05-differentiating-features
    provides: popup UI, settings UI, scanner, content script, storage
provides:
  - Dark mode with theme persistence via sync storage
  - Per-class highlight color settings (tags/zerowidth/watermark)
  - Unicode code display in all invisible character labels
  - Cleaned up popup UI (no Clear All, larger cog)
affects: []

tech-stack:
  added: []
  patterns:
    - "Tailwind v4 @custom-variant dark (&.dark) for class-based dark mode"
    - "Per-class color watchers in content script for live highlight updates"

key-files:
  created: []
  modified:
    - utils/storage.ts
    - entrypoints/popup/App.tsx
    - entrypoints/popup/style.css
    - entrypoints/settings/App.tsx
    - entrypoints/settings/style.css
    - utils/scanner.ts
    - entrypoints/content.ts
    - tests/scanner.test.ts

key-decisions:
  - "Dark mode driven by .dark class on documentElement, not OS preference media query"
  - "Per-class colors replace single highlight color; old highlightColorSetting kept in storage.ts for backward compat"
  - "Zero-width names from ZEROWIDTH_NAMES map; chars without names still show [U+XXXX]"

patterns-established:
  - "Class-based dark mode: toggle .dark on document.documentElement, use dark: Tailwind prefix"

requirements-completed: [DARK-MODE, SETTINGS-UI-FIXES, CHAR-CODES]

duration: 6min
completed: 2026-02-20
---

# Quick Task 1: Dark Mode, Per-Class Colors, Unicode Code Labels Summary

**Dark mode default with theme toggle, three per-class highlight color pickers, Unicode code display in all invisible character labels, popup cleanup**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-20T15:38:32Z
- **Completed:** 2026-02-20T15:44:19Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Dark mode renders by default on both popup and settings pages, with theme dropdown persisting to sync storage
- Three per-class color pickers (tags/zerowidth/watermark) replace single highlight color, with live-updating watchers in content script
- All invisible character highlights now show human-readable names with Unicode codes (e.g., [Zero Width Space U+200B], [Narrow No-Break Space U+202F])
- Popup UI cleaned up: Clear All button removed, settings cog enlarged from text-xs to text-lg

## Task Commits

Each task was committed atomically:

1. **Task 1: Add dark mode with theme setting and per-class color storage** - `295d2ee` (feat)
2. **Task 2: Wire per-class colors into content script and add Unicode codes to all replacement labels** - `da6011a` (feat)

## Files Created/Modified
- `utils/storage.ts` - Added themeSetting, tagsColorSetting, zerowColorSetting, watermarkColorSetting
- `entrypoints/popup/App.tsx` - Dark mode classes, removed Clear All button, enlarged settings cog
- `entrypoints/popup/style.css` - Added @custom-variant dark (&.dark)
- `entrypoints/settings/App.tsx` - Theme dropdown, 3 color pickers, dark mode classes throughout
- `entrypoints/settings/style.css` - Added @custom-variant dark (&.dark)
- `utils/scanner.ts` - ZEROWIDTH_NAMES map, Unicode codes in all replacement labels
- `entrypoints/content.ts` - Per-class color settings, removed single highlight color logic, per-type watchers
- `tests/scanner.test.ts` - Updated 15 test expectations for new label format with names and codes

## Decisions Made
- Dark mode driven by .dark class on documentElement (not OS preference) so user controls it via settings dropdown
- Per-class colors replace single highlight color; old highlightColorSetting kept in storage.ts for backward compat but removed from settings UI and content script
- Zero-width names sourced from new ZEROWIDTH_NAMES map with 15 common characters; unlisted chars still show [U+XXXX] only

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 15 scanner test expectations for new label format**
- **Found during:** Task 2 (scanner and content script updates)
- **Issue:** Tests expected old format ([U+200B]) but scanner now outputs [Zero Width Space U+200B]
- **Fix:** Updated all 15 affected test expectations to match new name+code format
- **Files modified:** tests/scanner.test.ts
- **Verification:** All 64 tests pass
- **Committed in:** da6011a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix - test expectations)
**Impact on plan:** Necessary to keep tests aligned with intentional behavior change. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Extension fully functional with dark mode, per-class colors, and Unicode code labels
- Ready for Chrome Web Store submission (Phase 6 Plan 2)

---
*Quick Task: 1-add-dark-mode-fix-settings-ui-remove-bro*
*Completed: 2026-02-20*
