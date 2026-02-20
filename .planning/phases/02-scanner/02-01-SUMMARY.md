---
phase: 02-scanner
plan: 01
subsystem: scanner
tags: [unicode, tags-block, zero-width, detection, tdd, vitest, messaging, webext-core]

# Dependency graph
requires:
  - phase: 01-01
    provides: WXT project skeleton, sensitivity presets (charsets.ts), buildDetectionRegex()
  - phase: 01-02
    provides: encode/decode codec patterns, Tags block range constants
provides:
  - findInvisibleChars() pure function detecting Tags block and zero-width characters with UTF-16 offsets
  - decodeTagsRun() function mapping Tags content chars to ASCII
  - Adjacent Tags block character merging into single findings
  - Type-safe messaging protocol (ping, startScan, clearScan) via @webext-core/messaging
  - 25 unit tests locking scanner behavior contract
affects: [02-02-content-script, 03-settings-ui, 04-popup-ui, 05-snippets]

# Tech tracking
tech-stack:
  added: []
  patterns: [regex-exec-loop-for-utf16-offsets, adjacent-match-merging, protocol-map-function-syntax]

key-files:
  created:
    - utils/scanner.ts
    - utils/messaging.ts
    - tests/scanner.test.ts
  modified: []

key-decisions:
  - "Used regex.exec() loop (not for...of) for UTF-16 offset compatibility with Text.splitText()"
  - "Adjacent Tags block matches merged in second pass after collecting all raw regex matches"
  - "Zero-width chars labeled with [U+XXXX] format using 4-digit uppercase hex padding"
  - "Messaging ProtocolMap uses function syntax (not deprecated ProtocolWithReturn)"

patterns-established:
  - "regex.exec() with /gu flag for all invisible character detection (UTF-16 offset safe)"
  - "Two-phase scan: collect raw matches, then merge adjacent Tags block runs"
  - "ScanFinding interface as the contract between scanner and content script DOM manipulation"

requirements-completed: [SCAN-01, SCAN-02, SCAN-04, SCAN-07]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 2 Plan 01: Scanner Pure Functions and Messaging Protocol Summary

**TDD-driven invisible character scanner with Tags block merging, zero-width labeling, and type-safe messaging protocol for background/content script communication**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T05:42:56Z
- **Completed:** 2026-02-20T05:45:39Z
- **Tasks:** 2 (TDD RED + GREEN; no REFACTOR needed)
- **Files modified:** 3

## Accomplishments
- findInvisibleChars() scans text for invisible Unicode characters using buildDetectionRegex, returns ScanFinding[] with UTF-16 offsets
- Adjacent Tags block characters automatically merged into single findings with full decoded ASCII text
- Zero-width characters produce [U+XXXX] labels; sensitivity levels (standard/thorough/paranoid) control detection scope
- decodeTagsRun() maps Tags content chars (U+E0020-E007E) to ASCII, silently skips wrappers
- Type-safe messaging protocol with ping, startScan, clearScan via @webext-core/messaging defineExtensionMessaging
- 25 unit tests covering all specified behaviors, edge cases, and sensitivity levels

## Task Commits

Each task was committed atomically:

1. **TDD RED: Failing tests for scanner** - `f57238b` (test)
2. **TDD GREEN: Implement scanner and messaging** - `44a1ed9` (feat)

## Files Created/Modified
- `utils/scanner.ts` - findInvisibleChars() and decodeTagsRun() pure functions with JSDoc
- `utils/messaging.ts` - ProtocolMap with ping/startScan/clearScan, ScanResult type export
- `tests/scanner.test.ts` - 25 test cases covering Tags block, zero-width, merging, sensitivity, edge cases

## Decisions Made
- Used regex.exec() loop instead of for...of iteration to get UTF-16 offsets directly compatible with Text.splitText() -- avoids surrogate pair offset mismatch
- Two-phase scan approach: first collect all raw regex matches, then merge adjacent Tags block matches in a second pass -- cleaner than inline merging during regex iteration
- ProtocolMap uses function syntax per @webext-core/messaging current API (deprecated ProtocolWithReturn avoided)
- ScanFinding.type uses 'tags' | 'zerowidth' discriminator for content script to choose replacement strategy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed lint errors in scanner.ts and test file**
- **Found during:** Task 2 (GREEN verification)
- **Issue:** Unused `ScanFinding` type import in test; `let` used where `const` sufficed in scanner.ts
- **Fix:** Removed unused type import; changed `let runStart` to `const runStart`
- **Files modified:** tests/scanner.test.ts, utils/scanner.ts
- **Verification:** pnpm lint passes clean
- **Committed in:** 44a1ed9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor lint fix, no scope creep.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Scanner pure functions ready for content script DOM integration (02-02)
- ScanFinding interface defines the contract for inline text replacement
- Messaging protocol ready for background/content script communication
- 25 tests lock the scanner behavior contract

## Self-Check: PASSED

- utils/scanner.ts verified present on disk
- utils/messaging.ts verified present on disk
- tests/scanner.test.ts verified present on disk
- Commit f57238b (TDD RED) verified in git log
- Commit 44a1ed9 (TDD GREEN) verified in git log
- All 58 tests pass (33 codec + 25 scanner)
- Lint and TypeScript clean

---
*Phase: 02-scanner*
*Completed: 2026-02-20*
