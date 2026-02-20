# Roadmap: InvisibleUnicode

## Overview

Six phases take the extension from bare scaffolding to Chrome Web Store publication. Phases 1-2 build the hardest, riskiest components first — pure Unicode logic and the DOM-manipulating content script — before any UI is touched. Phases 3-4 layer in service worker plumbing and the popup interface against stable contracts. Phase 5 adds the differentiating features (snippets, AI watermark detection, configurable scan modes) after the core is proven. Phase 6 finalizes the submission package for the Chrome Web Store.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Foundation** - Core Unicode logic, WXT build setup, MV3 architecture decisions
- [x] **Phase 2: Scanner** - Content script DOM scanner, inline highlighting, badge count
- [x] **Phase 3: Service Worker and Settings** - Keyboard shortcuts, settings persistence, background logic
- [x] **Phase 4: Popup UI** - Converter interface, copy/clear, scan trigger in popup
- [ ] **Phase 5: Differentiating Features** - Snippets library, AI watermark detection, configurable scan modes, export
- [ ] **Phase 6: Chrome Web Store Submission** - Polish, permission justification, privacy policy, publish

## Phase Details

### Phase 1: Foundation
**Goal**: Core Unicode encode/decode functions are verified and the extension project skeleton is ready to build features against
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. The encode function converts plain ASCII text to Tags block (U+E0000–U+E007F) invisible Unicode and produces correct output verifiable via unit tests
  2. The decode function converts Tags block and zero-width invisible Unicode back to plaintext and passes unit tests covering both character classes
  3. WXT project builds to a self-contained MV3 extension package with no external URL references — loadable in Chrome via `chrome://extensions`
  4. All processing is confirmed local-only: no network calls exist anywhere in the codebase, enforced by an ESLint rule or build-time check
  5. The manifest permission model is locked (activeTab for on-demand, optional all_urls for auto-scan) and the storage area allocation is documented in code comments (sync/local/session)
**Plans:** 2/2 plans complete
Plans:
- [x] 01-01-PLAN.md — WXT project scaffold with config, presets, storage, and no-network enforcement
- [x] 01-02-PLAN.md — Encode/decode codec implementation via TDD with comprehensive unit tests

### Phase 2: Scanner
**Goal**: Users can trigger a page scan and see invisible Unicode characters revealed inline on any page with a badge count on the extension icon
**Depends on**: Phase 1
**Requirements**: SCAN-01, SCAN-02, SCAN-04, SCAN-05, SCAN-07, SCAN-08
**Success Criteria** (what must be TRUE):
  1. User triggers a scan on a page containing Tags block characters and sees those characters replaced inline with their decoded text on a highlighted background
  2. User triggers a scan on a page containing zero-width characters (U+200B-U+200F) and sees them revealed inline with highlighting
  3. Extension icon badge shows the correct count of hidden characters found after any scan completes
  4. User can toggle highlights off and back on without reloading the page — original page content is not destroyed
  5. Scanner does not noticeably degrade page load or interaction on a Wikipedia-length article (under 200ms TTI impact)
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — Scanner pure functions (TDD) and messaging protocol
- [x] 02-02-PLAN.md — Background service worker + content script integration with inline highlighting

### Phase 3: Service Worker and Settings
**Goal**: Keyboard shortcuts work reliably, settings persist across browser sessions, and the service worker survives termination without losing functionality
**Depends on**: Phase 2
**Requirements**: KEYS-01, KEYS-02, KEYS-03, SETT-01, SETT-02
**Success Criteria** (what must be TRUE):
  1. User can open the extension popup via a configurable keyboard shortcut
  2. User can trigger a page scan via a configurable keyboard shortcut without opening the popup
  3. User's chosen scan mode preference persists after closing and reopening the browser
  4. All keyboard shortcut and badge features continue to work after the service worker is stopped and restarted via DevTools (cold-start verification)
  5. User can configure the highlight color/style and the setting takes effect on the next scan without requiring a page reload
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md — Keyboard shortcuts (commands manifest + onCommand + quick-paste) and scan mode persistence
- [x] 03-02-PLAN.md — Reactive highlight color updates via storage.watch() in content script

### Phase 4: Popup UI
**Goal**: Users can encode text to invisible Unicode and decode it back entirely within the popup, with reliable clipboard copy
**Depends on**: Phase 3
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05
**Success Criteria** (what must be TRUE):
  1. User types or pastes text into the encode field and receives invisible Unicode output displayed in the popup
  2. User pastes invisible Unicode text into the decode field and receives readable plaintext output
  3. User copies encoded output to clipboard via the copy button and sees a clear "Copied!" confirmation message
  4. Clipboard copy works in applications that do not support the Clipboard API — a manual copy fallback button is available
  5. User can clear both input fields with a single reset action
**Plans:** 1 plan
Plans:
- [x] 04-01-PLAN.md — Popup converter UI with encode/decode, clipboard copy, and clear

### Phase 5: Differentiating Features
**Goal**: Users can save and paste named invisible Unicode snippets, the scanner detects AI watermark characters with named labels, and scan mode is configurable
**Depends on**: Phase 4
**Requirements**: SCAN-03, SCAN-06, SNIP-01, SNIP-02, SNIP-03, SCAN-09
**Success Criteria** (what must be TRUE):
  1. User saves a named invisible Unicode snippet in settings and pastes it into a text field via its assigned keyboard shortcut
  2. User can edit and delete saved snippets from the settings page
  3. Scanner identifies AI watermark characters (U+202F and related patterns) and labels them distinctly from Tags block and zero-width characters in the results
  4. Scanner results display clearly discriminates between the three character classes (Tags block, zero-width, AI watermark) so the user knows what type of hidden content was found
  5. User can export scan results as a JSON report via clipboard copy or file download
**Plans:** 3 plans
Plans:
- [ ] 05-01-PLAN.md — AI watermark detection and per-class highlight colors
- [ ] 05-02-PLAN.md — Snippet data model, storage CRUD, and settings page UI
- [ ] 05-03-PLAN.md — Snippet paste-via-shortcut and scan result JSON export

### Phase 6: Chrome Web Store Submission
**Goal**: The extension passes Chrome Web Store review and is publicly available for installation
**Depends on**: Phase 5
**Requirements**: PLAT-03
**Success Criteria** (what must be TRUE):
  1. A privacy policy is live at a public URL and explicitly states that no browsing data or user text leaves the device
  2. The Chrome Web Store listing includes a permission justification that explains why each requested permission is necessary
  3. The extension handles storage quota exceeded errors gracefully — user sees an informative message rather than a silent failure
  4. The extension is published on the Chrome Web Store and installable by anyone with the store link
**Plans:** 2 plans
Plans:
- [ ] 06-01-PLAN.md — Storage error handling, version bump, privacy policy, and packaging
- [ ] 06-02-PLAN.md — Deploy privacy policy and submit to Chrome Web Store

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete    | 2026-02-20 |
| 2. Scanner | 2/2 | Complete | 2026-02-20 |
| 3. Service Worker and Settings | 2/2 | Complete | 2026-02-20 |
| 4. Popup UI | 1/1 | Complete | 2026-02-20 |
| 5. Differentiating Features | 0/3 | Planning complete | - |
| 6. Chrome Web Store Submission | 0/2 | Planning complete | - |
