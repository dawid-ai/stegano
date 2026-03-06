---
phase: quick-5
plan: 01
subsystem: popup, background, content-script
tags: [bugfix, ux, context-menu, decrypt]
dependency_graph:
  requires: []
  provides: [decrypt-context-menu, password-autofill-fix]
  affects: [popup-ui, page-scanning, context-menus]
tech_stack:
  added: []
  patterns: [autocomplete-new-password, context-menu-messaging]
key_files:
  created: []
  modified:
    - entrypoints/popup/App.tsx
    - entrypoints/background.ts
    - entrypoints/content.ts
    - entrypoints/content/decrypt-prompt.ts
    - utils/messaging.ts
decisions:
  - "autocomplete=new-password reliably prevents browser autofill on password inputs"
  - "Decrypt context menu created unconditionally (not dependent on snippets existing)"
  - "Right-click tracking via mousedown event with button===2 check"
metrics:
  duration: 1min
  completed: "2026-03-06"
---

# Quick Task 5: Fix Password Prefill and Add Decrypt Context Menu Summary

**One-liner:** Prevent browser password autofill in popup and add right-click decrypt context menu for any highlighted span.

## What Was Done

### Task 1: Fix password input autofill in popup (2efa996)
Changed both password inputs in popup from `autocomplete="off"` (which browsers ignore) to `autocomplete="new-password"` and added unique `name` attributes (`stegano-encode-pw`, `stegano-decrypt-pw`) to further discourage autofill heuristics.

### Task 2: Add decrypt context menu for highlighted encrypted text (cadd1e8)
Added a "Stegano - Decrypt" right-click context menu item that triggers inline decryption on any highlighted span:
- Added `showDecryptPrompt` message type to the messaging protocol
- Exported `showInlineDecryptPrompt` from `decrypt-prompt.ts` for direct use by content script
- Created top-level context menu item in `buildSnippetMenus()` (always present, independent of snippets)
- Added `mousedown` listener in content script to track right-clicked highlight spans
- Added `showDecryptPrompt` message handler that opens the inline decrypt prompt on the tracked span
- Works for all highlight types; `decrypt-prompt.ts` already handles the "not encrypted" case gracefully

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm build` succeeds with all files compiled and bundled
- `pnpm compile` has pre-existing JSX/TSX errors unrelated to these changes (WXT handles JSX transformation at build time)
- Manual verification needed: popup password fields empty on open, decrypt context menu functional on highlighted spans
