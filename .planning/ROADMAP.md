# Roadmap: InvisibleUnicode

## Milestones

- ✅ **v1.0 MVP** - Phases 1-6 (shipped 2026-02-21)
- 🚧 **v1.1 Encrypted Hidden Text** - Phases 7-11 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

<details>
<summary>✅ v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-21</summary>

- [x] **Phase 1: Foundation** - Core Unicode logic, WXT build setup, MV3 architecture decisions
- [x] **Phase 2: Scanner** - Content script DOM scanner, inline highlighting, badge count
- [x] **Phase 3: Service Worker and Settings** - Keyboard shortcuts, settings persistence, background logic
- [x] **Phase 4: Popup UI** - Converter interface, copy/clear, scan trigger in popup
- [x] **Phase 5: Differentiating Features** - Snippets library, AI watermark detection, configurable scan modes, export
- [x] **Phase 6: Chrome Web Store Submission** - Polish, permission justification, privacy policy, publish

</details>

### 🚧 v1.1 Encrypted Hidden Text

- [x] **Phase 7: Core Encryption Pipeline** - Wire format, AES-256-GCM encryption, compression, marker protocol (completed 2026-03-04)
- [ ] **Phase 8: Popup Encrypt/Decrypt UI** - Password fields, encrypt toggle, character count display in popup
- [x] **Phase 9: Scanner Integration** - Detect encrypted content on pages with distinct color and label (completed 2026-03-05)
- [ ] **Phase 10: Password Management** - Save/edit/delete passwords, dropdown in popup, snippet linking
- [ ] **Phase 11: Inline Decryption** - Click encrypted highlight to enter password and see decrypted text in place

## Phase Details

<details>
<summary>✅ v1.0 MVP (Phases 1-6) - SHIPPED 2026-02-21</summary>

### Phase 1: Foundation
**Goal**: Core Unicode encode/decode functions are verified and the extension project skeleton is ready to build features against
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02
**Success Criteria** (what must be TRUE):
  1. The encode function converts plain ASCII text to Tags block (U+E0000-U+E007F) invisible Unicode and produces correct output verifiable via unit tests
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
**Plans:** 1/1 plan complete
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
**Plans:** 3/3 plans complete
Plans:
- [x] 05-01-PLAN.md — AI watermark detection and per-class highlight colors
- [x] 05-02-PLAN.md — Snippet data model, storage CRUD, and settings page UI
- [x] 05-03-PLAN.md — Snippet paste-via-shortcut and scan result JSON export

### Phase 6: Chrome Web Store Submission
**Goal**: The extension passes Chrome Web Store review and is publicly available for installation
**Depends on**: Phase 5
**Requirements**: PLAT-03
**Success Criteria** (what must be TRUE):
  1. A privacy policy is live at a public URL and explicitly states that no browsing data or user text leaves the device
  2. The Chrome Web Store listing includes a permission justification that explains why each requested permission is necessary
  3. The extension handles storage quota exceeded errors gracefully — user sees an informative message rather than a silent failure
  4. The extension is published on the Chrome Web Store and installable by anyone with the store link
**Plans:** 2/2 plans complete
Plans:
- [x] 06-01-PLAN.md — Storage error handling, version bump, privacy policy, and packaging
- [x] 06-02-PLAN.md — Deploy privacy policy and submit to Chrome Web Store

</details>

### 🚧 v1.1 Encrypted Hidden Text (In Progress)

**Milestone Goal:** Add password-based encryption to invisible text so groups can hide messages that are unreadable even to those who know about invisible Unicode.

#### Phase 7: Core Encryption Pipeline
**Goal**: Encrypt and decrypt text with a password, producing invisible Unicode output with markers that distinguish encrypted content from plain hidden text
**Depends on**: Phase 6 (v1.0 complete)
**Requirements**: ENCR-01, ENCR-02, ENCR-03, ENCR-04, ENCR-05, ENCR-06
**Success Criteria** (what must be TRUE):
  1. Given plaintext and a password, the encrypt function produces invisible Unicode output that decodes to a marker-prefixed Base64 string (verifiable via unit tests)
  2. Given encrypted invisible Unicode and the correct password, the decrypt function returns the original plaintext (round-trip verified across message sizes from 1 to 10,000 characters)
  3. Given encrypted invisible Unicode and the wrong password, decryption fails with a clear error message ("Decryption failed -- wrong password or corrupted data") rather than producing garbage output
  4. Compression automatically activates when it reduces message size, producing fewer invisible characters than uncompressed encryption (verifiable by comparing character counts for messages over 30 characters)
  5. The wire format `[version:1][salt:16][iv:12][ciphertext+tag:N+12]` is locked and documented, with the `ENC1:` marker prefix inside the Tags block encoding distinguishing encrypted from plain hidden text
**Plans:** 2/2 plans complete
Plans:
- [x] 07-01-PLAN.md — Compression and markers modules (TDD)
- [x] 07-02-PLAN.md — Core crypto module with AES-256-GCM and full pipeline integration (TDD)

#### Phase 8: Popup Encrypt/Decrypt UI
**Goal**: Users can encrypt and decrypt text with passwords directly in the popup, with clear feedback on character count impact
**Depends on**: Phase 7
**Requirements**: EUXP-01, EUXP-02, EUXP-03, EUXP-04, EUXP-05
**Success Criteria** (what must be TRUE):
  1. User enters text and a password in the popup, clicks encrypt, and gets invisible Unicode output that is longer than unencrypted output (encryption overhead is expected and visible)
  2. User pastes encrypted invisible Unicode into the decode section and is automatically prompted for a password before decryption proceeds
  3. Character count display shows both encrypted and unencrypted character counts side by side (e.g., "142 chars (72 without encryption)") so the user understands the cost
  4. User can toggle compression on/off and immediately see the character count difference update
  5. Copying encrypted output to clipboard works identically to copying unencrypted output (same button, same confirmation)
**Plans:** 2 plans
Plans:
- [ ] 08-01-PLAN.md — Compress option for crypto module + encryption UI in popup encode section
- [ ] 08-02-PLAN.md — Encrypted content auto-detection and decrypt UI in popup decode section

#### Phase 9: Scanner Integration
**Goal**: The page scanner detects encrypted hidden text and displays it with a distinct visual treatment separate from other invisible character classes
**Depends on**: Phase 7
**Requirements**: EDET-01, EDET-02, EDET-05
**Success Criteria** (what must be TRUE):
  1. Scanner detects encrypted hidden text on a page (via the `ENC1:` marker in decoded Tags runs) and highlights it with a distinct color and "[Encrypted]" label, visually different from tags/zerowidth/watermark highlights
  2. Encrypted content detection is off by default (manual trigger) with an option in settings to enable auto-detection
  3. Scanner correctly distinguishes encrypted content from regular Tags block text that happens to start with "ENC" or similar strings (no false positives from non-encrypted content)
**Plans:** 2/2 plans executed
Plans:
- [x] 09-01-PLAN.md — Scanner encrypted detection with TDD tests, storage settings, and messaging types
- [x] 09-02-PLAN.md — Content script highlighting and settings UI for encrypted color and auto-detect toggle

#### Phase 10: Password Management
**Goal**: Users can save, organize, and reuse passwords for encryption, including linking passwords to snippets for one-click encrypted encoding
**Depends on**: Phase 8
**Requirements**: PASS-01, PASS-02, PASS-03, PASS-04, PASS-05
**Success Criteria** (what must be TRUE):
  1. User can create, edit, and delete named passwords in the settings page, stored in chrome.storage.local (not synced across devices)
  2. Saved passwords appear as a dropdown in the popup encrypt/decrypt password fields, letting the user select a saved password instead of typing it
  3. User can link a saved password to a snippet, and when using context menu to paste that snippet, it is automatically encrypted with the linked password
  4. Unlinking a password from a snippet reverts that snippet to unencrypted paste behavior
**Plans**: TBD

#### Phase 11: Inline Decryption
**Goal**: Users can decrypt encrypted content directly on the page by clicking a highlight and entering a password, seeing the decrypted text replace the encrypted highlight in place
**Depends on**: Phase 9, Phase 10
**Requirements**: EDET-03, EDET-04
**Success Criteria** (what must be TRUE):
  1. User clicks an encrypted highlight on a page and sees an inline password prompt anchored to that highlight (not a browser alert or popup)
  2. After entering the correct password, the decrypted plaintext replaces the encrypted highlight inline on the page
  3. After entering the wrong password, the user sees an error message and can retry without the highlight being destroyed
  4. If the user has saved passwords, they can select from a dropdown in the inline prompt instead of typing
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9 (parallel with 10) → 10 → 11

Note: Phases 9 and 10 can be parallelized (Phase 9 depends on Phase 7 only; Phase 10 depends on Phase 8).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-20 |
| 2. Scanner | v1.0 | 2/2 | Complete | 2026-02-20 |
| 3. Service Worker and Settings | v1.0 | 2/2 | Complete | 2026-02-20 |
| 4. Popup UI | v1.0 | 1/1 | Complete | 2026-02-20 |
| 5. Differentiating Features | v1.0 | 3/3 | Complete | 2026-02-21 |
| 6. Chrome Web Store Submission | v1.0 | 2/2 | Complete | 2026-02-21 |
| 7. Core Encryption Pipeline | v1.1 | 2/2 | Complete | 2026-03-04 |
| 8. Popup Encrypt/Decrypt UI | v1.1 | 2/2 | Complete | 2026-03-05 |
| 9. Scanner Integration | v1.1 | 2/2 | Complete | 2026-03-05 |
| 10. Password Management | v1.1 | 0/? | Not started | - |
| 11. Inline Decryption | v1.1 | 0/? | Not started | - |
