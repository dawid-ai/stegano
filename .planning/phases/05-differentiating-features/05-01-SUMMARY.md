---
phase: 05-differentiating-features
plan: 01
subsystem: scanner
tags: [unicode, watermark, ai-detection, highlight, content-script]

# Dependency graph
requires:
  - phase: 02-scanner
    provides: "Scanner with two-class detection (tags/zerowidth) and buildDetectionRegex"
  - phase: 01-foundation
    provides: "charsets.ts sensitivity presets and content script skeleton"
provides:
  - "Three-class scanner classification: tags, zerowidth, watermark"
  - "AI_WATERMARK_CHARS map with 6 conservative watermark codepoints"
  - "Per-class highlight colors in content script (yellow/orange/pink)"
  - "allFindings array in content script for export feature"
affects: [05-02, 05-03]

# Tech tracking
tech-stack:
  added: []
  patterns: ["classifyCodepoint priority chain for character classification", "per-class CSS colors with custom override backward compatibility"]

key-files:
  created: []
  modified:
    - utils/charsets.ts
    - utils/scanner.ts
    - entrypoints/content.ts
    - tests/scanner.test.ts

key-decisions:
  - "Conservative watermark set excludes U+00A0 (too many false positives from nbsp)"
  - "Watermark findings use named labels (e.g., [Narrow No-Break Space]) not hex codes"
  - "Per-class colors: yellow=tags, orange=zerowidth, pink=watermark; custom color overrides all"

patterns-established:
  - "classifyCodepoint(): priority-based character classification (tags > watermark > zerowidth)"
  - "CLASS_COLORS + data-iu-type: per-finding-type styling with custom override support"

requirements-completed: [SCAN-03, SCAN-06]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 5 Plan 1: AI Watermark Detection Summary

**Three-class scanner with AI watermark detection (6 chars including U+202F) and per-class highlight colors in content script**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T18:58:59Z
- **Completed:** 2026-02-20T19:01:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added AI_WATERMARK_CHARS map with 6 conservative codepoints (U+202F primary GPT watermark)
- Extended scanner to three-class classification with classifyCodepoint() priority chain
- Content script now applies per-class colors: yellow (tags), orange (zerowidth), pink (watermark)
- All findings stored in allFindings array for Plan 03 export feature
- 6 new watermark detection tests covering all character classes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add watermark character set and extend scanner classification** - `17d1a2b` (feat)
2. **Task 2: Per-class highlight colors and findings retention in content script** - `0fdace1` (feat)

## Files Created/Modified
- `utils/charsets.ts` - Added AI_WATERMARK_CHARS map and WATERMARK_RANGES at standard sensitivity
- `utils/scanner.ts` - Extended ScanFinding.type union, added classifyCodepoint(), named labels for watermark
- `entrypoints/content.ts` - CLASS_COLORS, data-iu-type attribute, allFindings accumulation, per-class color watch
- `tests/scanner.test.ts` - 6 new watermark detection tests

## Decisions Made
- Conservative watermark set excludes U+00A0 to avoid false positives from HTML nbsp entities
- Watermark findings use human-readable named labels from AI_WATERMARK_CHARS map instead of hex codes
- Per-class colors activate when user has default highlight color; custom color overrides all classes for backward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing build failure: `entrypoints/settings/main.tsx` imports `./App` which does not exist. Not caused by Phase 05 changes. Logged to deferred-items.md.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scanner three-class detection ready for Plan 02 (findings panel/export)
- allFindings array ready for Plan 03 messaging integration
- Pre-existing settings build issue should be addressed before final release

---
*Phase: 05-differentiating-features*
*Completed: 2026-02-20*
