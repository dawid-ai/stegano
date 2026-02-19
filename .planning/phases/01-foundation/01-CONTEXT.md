# Phase 1: Foundation - Context

**Gathered:** 2026-02-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Core Unicode encode/decode functions verified by unit tests, plus the WXT project skeleton building to a loadable MV3 extension. Permission model locked, storage areas allocated, no-network guarantee enforced. No UI, no scanner, no popup — just the logic layer and build infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Character class scope
- Three named sensitivity presets: Standard (default), Thorough, Paranoid
- **Standard:** Tags block (U+E0000-E007F) + zero-width joiners/marks (U+200B-200F, U+FEFF)
- **Thorough:** Standard + word joiner (U+2060), invisible operators (U+2061-2064), variation selectors
- **Paranoid:** Thorough + directional overrides (U+202A-202E), invisible separators, deprecated format chars
- Decode function respects the current sensitivity level — only decodes character classes within the active preset
- Sensitivity presets defined as data in Phase 1; UI for switching them comes in Phase 3 (settings)

### Encode behavior
- Encode produces Tags block (U+E0000-E007F) output only — no zero-width encoding mode
- ASCII input only; reject non-ASCII with a clear error message
- Wrapper characters (U+E0001 begin / U+E007F cancel) are a settings toggle — user chooses wrapped vs raw output
- Wrapper setting defined as a data default in Phase 1; UI toggle comes in Phase 3

### Decode behavior
- Auto-detect which encoding is present in input (Tags block vs zero-width) — no user selection needed
- Decodes only character classes covered by the user's current sensitivity preset

### Storage area allocation
- Snippets (Phase 5): local storage — per-device, 10MB limit, no sync
- Scan results: session storage only — vanish when tab/browser closes
- No usage stats or counters — nothing to track, nothing to explain
- Settings (sensitivity, highlight color, scan mode): Claude's discretion on sync vs local

### No-network enforcement
- Enforcement method: Claude's discretion (ESLint rule, build-time check, or both)
- CSP in manifest: Claude's discretion based on Chrome Web Store expectations
- Privacy messaging prominence: Claude's discretion
- Visible "Local only" indicator in the popup UI — builds user trust actively

### Claude's Discretion
- U+FEFF (BOM) handling: whether to skip at position 0 or flag everywhere
- Settings sync vs local storage choice
- No-network enforcement method (ESLint, build check, or both)
- CSP configuration in manifest
- Privacy claim prominence in store listing
- Exact character lists for Thorough and Paranoid presets beyond the categories listed above

</decisions>

<specifics>
## Specific Ideas

- Sensitivity presets should have clear, memorable names — "Standard / Thorough / Paranoid" or similar
- Wrapper toggle is a power-user feature — default should be whatever works best for the common copy-paste use case
- "Local only" badge in popup should be subtle but visible — trust signal, not a marketing banner

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-19*
