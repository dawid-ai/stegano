---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [wxt, preact, tailwind, vitest, eslint, chrome-extension, mv3]

# Dependency graph
requires: []
provides:
  - WXT project skeleton building to loadable MV3 extension
  - Sensitivity preset data (Standard, Thorough, Paranoid) with Unicode ranges
  - Typed storage declarations for settings (sync storage)
  - ESLint no-network enforcement rules (PLAT-02)
  - Stub entrypoints (popup, background, content script)
affects: [01-02-codec, 02-scanner, 03-settings-ui, 04-popup-ui]

# Tech tracking
tech-stack:
  added: [wxt@0.20.17, preact@10, tailwindcss@4, vitest@4, eslint@9, typescript-eslint, "@webext-core/messaging", "@webext-core/fake-browser", "@preact/preset-vite", "@tailwindcss/vite"]
  patterns: [flat-eslint-config, wxt-auto-imports, sync-storage-for-settings]

key-files:
  created:
    - wxt.config.ts
    - vitest.config.ts
    - eslint.config.mjs
    - entrypoints/background.ts
    - entrypoints/content.ts
    - entrypoints/popup/index.html
    - utils/charsets.ts
    - utils/types.ts
    - utils/storage.ts
  modified:
    - package.json
    - tsconfig.json

key-decisions:
  - "Used optional_host_permissions (not optional_permissions) for <all_urls> in MV3 manifest"
  - "Used wxt/utils/storage import path (not wxt/storage) for WXT 0.20.17 API"
  - "Used hoisted node-linker (.npmrc) to work around pnpm Windows symlink bug"
  - "ESLint 9 used (not 10) for wxt peer dependency compatibility"
  - "Sync storage for all settings (sensitivity, wrapperEnabled, highlightColor, scanMode)"

patterns-established:
  - "Flat ESLint config (eslint.config.mjs) with typescript-eslint"
  - "No-network enforcement via ESLint no-restricted-globals/properties rules"
  - "Sensitivity presets as static data objects with buildDetectionRegex() helper"
  - "Storage items declared via storage.defineItem() with typed fallbacks"

requirements-completed: [PLAT-01, PLAT-02]

# Metrics
duration: 10min
completed: 2026-02-20
---

# Phase 1 Plan 01: Project Scaffold Summary

**WXT MV3 extension skeleton with Preact/Tailwind vite plugins, three sensitivity presets (Standard/Thorough/Paranoid), typed sync-storage declarations, and ESLint no-network enforcement**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-20T04:30:32Z
- **Completed:** 2026-02-20T04:41:11Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- WXT project builds to a valid MV3 Chrome extension with strict CSP
- Manifest includes activeTab, storage, scripting permissions and optional all_urls host permission
- ESLint enforces no-network rules (fetch, XMLHttpRequest, WebSocket, EventSource, navigator.sendBeacon)
- Three sensitivity presets defined with all Unicode ranges per locked decisions
- Four typed storage items declared with sync storage and appropriate defaults
- buildDetectionRegex() generates RegExp from preset ranges

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold WXT project with Preact, Tailwind, Vitest, and ESLint** - `9f30a42` (feat)
2. **Task 2: Create sensitivity presets, types, and storage declarations** - `389b674` (feat)

## Files Created/Modified
- `wxt.config.ts` - WXT + Preact + Tailwind config with manifest permissions and CSP
- `vitest.config.ts` - Vitest config with WxtVitest plugin, passWithNoTests
- `eslint.config.mjs` - Flat ESLint 9 config enforcing no-network rules (PLAT-02)
- `tsconfig.json` - Extends WXT-generated tsconfig
- `package.json` - Project with all dependencies and lint/test/build scripts
- `entrypoints/background.ts` - Background service worker stub
- `entrypoints/content.ts` - Content script stub matching all URLs
- `entrypoints/popup/index.html` - Popup HTML with empty app mount point
- `utils/charsets.ts` - Sensitivity presets, CharRange type, buildDetectionRegex()
- `utils/types.ts` - Shared types (ScanMode, ScanMatch)
- `utils/storage.ts` - Typed storage declarations (sensitivity, wrapperEnabled, highlightColor, scanMode)
- `.npmrc` - node-linker=hoisted for Windows pnpm compatibility
- `.gitignore` - WXT template gitignore

## Decisions Made
- Used `optional_host_permissions` instead of `optional_permissions` for `<all_urls>` -- MV3 requires host patterns in the host permissions field, not the permissions field
- Used `wxt/utils/storage` import path instead of `wxt/storage` -- WXT 0.20.17 exports storage under utils subpath
- Added `.npmrc` with `node-linker=hoisted` to work around pnpm Windows bug with long paths and dotfile renames
- Pinned ESLint to v9 (not v10) because WXT 0.20.17 peer dependency requires ^8.57.0 or ^9.0.0
- Used sync storage for all settings -- small data, benefits from cross-device sync

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WXT init fails on non-empty directory**
- **Found during:** Task 1 (project scaffold)
- **Issue:** `wxt init .` requires empty directory; project root has .planning/ and .git/
- **Fix:** Ran `wxt init` in /tmp, copied template files, then customized in place
- **Files modified:** All template files
- **Verification:** Build succeeds
- **Committed in:** 9f30a42 (Task 1 commit)

**2. [Rule 3 - Blocking] pnpm install fails on Windows with ENOENT rename**
- **Found during:** Task 1 (dependency installation)
- **Issue:** pnpm fails renaming to `.ignored_` prefix on Windows due to long path / file system bug
- **Fix:** Added `.npmrc` with `node-linker=hoisted` to use flat node_modules layout
- **Files modified:** .npmrc
- **Verification:** Install completes, build succeeds
- **Committed in:** 9f30a42 (Task 1 commit)

**3. [Rule 1 - Bug] optional_permissions type error for <all_urls>**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `<all_urls>` is a host pattern, not a permission; TypeScript correctly rejects it in optional_permissions
- **Fix:** Changed to `optional_host_permissions` in wxt.config.ts
- **Files modified:** wxt.config.ts
- **Verification:** TypeScript compiles, manifest output correct
- **Committed in:** 389b674 (Task 2 commit)

**4. [Rule 1 - Bug] wxt/storage import path incorrect**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** WXT 0.20.17 exports storage at `wxt/utils/storage`, not `wxt/storage`
- **Fix:** Updated import in utils/storage.ts
- **Files modified:** utils/storage.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 389b674 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correct build and TypeScript compilation. No scope creep.

## Issues Encountered
- WXT vanilla template includes assets/ and components/ directories not needed for this project -- excluded from copy
- Vitest exits with code 1 when no test files exist -- added passWithNoTests: true to vitest.config.ts

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Project builds to loadable MV3 extension, ready for codec implementation in Plan 02
- Sensitivity presets and storage declarations ready for scanner (Phase 2) and settings UI (Phase 3)
- All foundational infrastructure (build, lint, test) operational

## Self-Check: PASSED

- All 13 created files verified present on disk
- Commit 9f30a42 (Task 1) verified in git log
- Commit 389b674 (Task 2) verified in git log
- Build, lint, compile all pass

---
*Phase: 01-foundation*
*Completed: 2026-02-20*
