# Phase 2: Scanner - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Content script DOM scanner that finds invisible Unicode characters (Tags block, zero-width) on any web page, reveals them inline with highlighting, shows a badge count on the extension icon, and allows toggling highlights on/off. On-demand trigger only (icon click or keyboard shortcut). Auto-scan is a later phase behind the optional all_urls permission.

</domain>

<decisions>
## Implementation Decisions

### Inline reveal style
- Inline text replacement — invisible characters are replaced directly in the page flow with their decoded content
- Tags block hidden messages: show the full decoded text inline (no truncation, no click-to-expand)
- Zero-width characters: replace with Unicode codepoint label (e.g., `[U+200B]`, `[U+200C]`)
- Single highlight color for all character classes — no color-coding by type in Phase 2

### Scan trigger & scope
- On-demand only in Phase 2 — user clicks extension icon or uses keyboard shortcut to trigger
- Auto-scan deferred to Phase 3/5 setting behind optional all_urls permission
- Scan covers the entire page DOM (full tree walk), not just visible viewport
- After initial scan, use MutationObserver to catch newly added DOM nodes and scan those too (handles SPAs and lazy-loaded content)
- Default: skip non-visible elements (script, style, noscript, hidden) — only scan text the user would read
- Power user option: full scan mode that includes all elements (configurable, not default)

### Highlight toggle UX
- Same trigger toggles on/off — click icon once to scan, click again to clear highlights
- Toggle off restores original DOM exactly — invisible chars become invisible again
- Badge count is the scan state indicator — badge present = scan active, no badge = not scanned
- Navigation clears everything — re-scan required after leaving and returning to a page

### Badge & feedback
- Badge shows finding count (distinct locations/instances), not individual character count
- Single consistent badge color regardless of character class found
- Scanning state: extension icon animates (spinning/pulsing) briefly while scan runs
- Clean page (nothing found): no badge shown, brief subtle signal (e.g., green checkmark on icon) to confirm scan completed

### Claude's Discretion
- Exact highlight background color choice
- MutationObserver configuration details
- How to implement icon animation during scan
- Green checkmark / clean-page signal implementation
- DOM walker implementation strategy
- How power-user full-scan mode is toggled (can be deferred to settings phase if needed)

</decisions>

<specifics>
## Specific Ideas

- The toggle behavior should feel instant — click icon, highlights appear; click again, they disappear
- Zero-width labels like `[U+200B]` are familiar to technical/security users who are the primary audience
- Finding count on badge is more useful than raw character count — "3 hidden things found" is more actionable than "142 hidden characters"

</specifics>

<deferred>
## Deferred Ideas

- Auto-scan on page load — Phase 3/5 (behind optional all_urls permission)
- Color-coding by character class — could revisit in Phase 5 when AI watermark class is added
- Scan result export — Phase 5

</deferred>

---

*Phase: 02-scanner*
*Context gathered: 2026-02-20*
