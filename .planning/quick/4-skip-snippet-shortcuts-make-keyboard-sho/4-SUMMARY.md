---
phase: quick-4
plan: 01
subsystem: snippets, context-menu, settings
tags: [context-menu, snippets, keyboard-shortcuts, settings]
dependency_graph:
  requires: []
  provides: [context-menu-snippets, snippet-paste-mode]
  affects: [background, content-script, settings-ui, manifest]
tech_stack:
  added: [contextMenus API]
  patterns: [context-menu-driven-snippet-paste, paste-at-cursor-via-execCommand]
key_files:
  created: []
  modified:
    - wxt.config.ts
    - utils/types.ts
    - utils/storage.ts
    - utils/messaging.ts
    - entrypoints/background.ts
    - entrypoints/content.ts
    - entrypoints/settings/App.tsx
decisions:
  - Context menus use contexts ['all'] so snippets work everywhere regardless of paste/copy mode
  - Paste at cursor uses document.execCommand('insertText') for undo stack compatibility
  - Falls back to clipboard copy when no editable element is focused in paste mode
  - chrome://extensions/shortcuts rendered as clickable link using browser.tabs.create
metrics:
  duration: 4 min
  completed: 2026-02-21
---

# Quick Task 4: Remove Snippet Shortcuts, Add Context Menu Pasting

Replaced custom snippet keyboard shortcuts with browser-native context menus for snippet pasting, with configurable paste-at-cursor or copy-to-clipboard behavior.

## What Changed

### Task 1: Remove snippet shortcuts, quick-paste command, and clean up types
**Commit:** fa7d366

- Removed `SnippetShortcut` interface and `shortcut` field from `Snippet` type
- Removed `quick-paste` command from manifest and background handler (`handleQuickPaste`)
- Removed snippet `keydown` listener and `copyToClipboard` message handler from content script
- Removed shortcut configurator UI (checkboxes + key input) from both create and edit forms in settings
- Removed shortcut display (`formatShortcut`) from snippet list rows
- Removed "Quick paste / Alt+Shift+V" row from keyboard shortcuts reference
- Made `chrome://extensions/shortcuts` a clickable link in settings
- Added `contextMenus` permission to manifest
- Removed `copyToClipboard` from `MessageMap`

### Task 2: Add context menu for snippet pasting and settings toggle
**Commit:** 9e97109

- Added `snippetPasteModeSetting` storage item (`'paste' | 'copy'`, default `'paste'`)
- Added `insertSnippet` message type to `MessageMap`
- Created `buildSnippetMenus()` function that builds parent "Stegano - Paste Snippet" menu with child items per snippet
- Menus rebuild on `runtime.onInstalled` and on `snippetsSetting.watch()`
- Context menu click handler: finds snippet, loads paste mode, sends `insertSnippet` to content script, with injection fallback and scripting API fallback for restricted pages
- Content script `insertSnippet` handler: `'copy'` mode writes to clipboard; `'paste'` mode uses `execCommand('insertText')` on focused input/textarea/contentEditable, falls back to clipboard if no editable element
- Added "Context Menu Snippet Behavior" dropdown to settings with description text

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `pnpm build` succeeds (129.37 kB total)
- `pnpm test` passes (64/64 tests)
- Manifest contains `contextMenus` permission, no `quick-paste` command
- No references to `SnippetShortcut` anywhere in codebase
- No `keydown` listener for snippets in content.ts

## Self-Check: PASSED
