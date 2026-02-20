# Requirements: InvisibleUnicode

**Defined:** 2026-02-19
**Core Value:** Detect and reveal hidden Unicode text on any web page — protecting against prompt injection and hidden content attacks

## v1 Requirements

### Converter

- [ ] **CONV-01**: User can type or paste text and get invisible Unicode encoded output (Tags block mapping)
- [ ] **CONV-02**: User can paste invisible Unicode text and get decoded plaintext
- [ ] **CONV-03**: User can copy encoded output to clipboard with visual confirmation
- [ ] **CONV-04**: User can copy via manual button as fallback
- [ ] **CONV-05**: User can clear/reset both input fields

### Scanner

- [x] **SCAN-01**: Extension scans current page DOM for invisible Unicode characters (Tags block U+E0000-E007F)
- [x] **SCAN-02**: Extension detects zero-width characters (U+200B-U+200F, U+200C, U+200D, U+FEFF)
- [ ] **SCAN-03**: Extension detects AI watermark characters (U+202F narrow no-break space and related LLM patterns)
- [x] **SCAN-04**: Detected invisible text is replaced inline with decoded content on a highlighted background
- [ ] **SCAN-05**: Extension icon badge shows count of hidden characters found on current page
- [ ] **SCAN-06**: Scanner discriminates between Tags block, zero-width, and AI watermark character classes
- [x] **SCAN-07**: User can configure scan mode: always-on, on-demand, or badge-only
- [ ] **SCAN-08**: User can toggle highlights on/off without page reload (non-destructive)
- [ ] **SCAN-09**: User can export scan results as JSON report (clipboard or download)

### Snippets

- [ ] **SNIP-01**: User can save named invisible Unicode snippets in extension settings
- [ ] **SNIP-02**: User can paste a saved snippet via its assigned keyboard shortcut
- [ ] **SNIP-03**: User can edit and delete saved snippets

### Shortcuts

- [ ] **KEYS-01**: User can open extension popup via configurable keyboard shortcut
- [ ] **KEYS-02**: User can trigger page scan via configurable keyboard shortcut
- [ ] **KEYS-03**: User can quick-paste primary snippet via configurable keyboard shortcut

### Settings

- [x] **SETT-01**: User can configure highlight color/style for detected invisible characters
- [ ] **SETT-02**: User can configure scan mode preference (persists across sessions)

### Platform

- [x] **PLAT-01**: Extension uses Chrome Manifest V3
- [x] **PLAT-02**: All processing happens locally — no data leaves the browser
- [ ] **PLAT-03**: Extension is published on Chrome Web Store

## v2 Requirements

### Extended Detection

- **EXTD-01**: Character-level breakdown in scan results (U+XXXX codepoint, Unicode name, count)
- **EXTD-02**: Right-click context menu to decode selected text
- **EXTD-03**: Right-click context menu to encode selected text as invisible Unicode

### Cross-Browser

- **XBRO-01**: Firefox port using WebExtensions API
- **XBRO-02**: Edge compatibility testing

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-stripping invisible chars from pages | Breaks emoji ZWJ sequences and legitimate Unicode uses; offer opt-in sanitize in popup instead |
| Cloud sync / server-side processing | Violates privacy-first promise; use chrome.storage.sync for settings |
| LLM integration for explaining hidden text | Requires sending user text to external API; local decode + codepoint lookup sufficient |
| Real-time keystroke scanning | High performance cost, Chrome may throttle; scan on page load or on-demand |
| User accounts / OAuth | Massive complexity, breaks privacy promise, alienates security users |
| Mobile browser support | Chrome desktop only for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 4 | Pending |
| CONV-02 | Phase 4 | Pending |
| CONV-03 | Phase 4 | Pending |
| CONV-04 | Phase 4 | Pending |
| CONV-05 | Phase 4 | Pending |
| SCAN-01 | Phase 2 | Complete |
| SCAN-02 | Phase 2 | Complete |
| SCAN-03 | Phase 5 | Pending |
| SCAN-04 | Phase 2 | Complete |
| SCAN-05 | Phase 2 | Pending |
| SCAN-06 | Phase 5 | Pending |
| SCAN-07 | Phase 2 | Complete |
| SCAN-08 | Phase 2 | Pending |
| SCAN-09 | Phase 5 | Pending |
| SNIP-01 | Phase 5 | Pending |
| SNIP-02 | Phase 5 | Pending |
| SNIP-03 | Phase 5 | Pending |
| KEYS-01 | Phase 3 | Pending |
| KEYS-02 | Phase 3 | Pending |
| KEYS-03 | Phase 3 | Pending |
| SETT-01 | Phase 3 | Complete |
| SETT-02 | Phase 3 | Pending |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after roadmap creation — all 25 requirements mapped*
