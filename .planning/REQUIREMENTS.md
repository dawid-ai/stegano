# Requirements: InvisibleUnicode

**Defined:** 2026-02-19
**Updated:** 2026-03-04 (v1.1 milestone)
**Core Value:** Detect and reveal hidden Unicode text on any web page — protecting against prompt injection and hidden content attacks

## v1.0 Requirements (Completed)

### Converter

- [x] **CONV-01**: User can type or paste text and get invisible Unicode encoded output (Tags block mapping)
- [x] **CONV-02**: User can paste invisible Unicode text and get decoded plaintext
- [x] **CONV-03**: User can copy encoded output to clipboard with visual confirmation
- [x] **CONV-04**: User can copy via manual button as fallback
- [x] **CONV-05**: User can clear/reset both input fields

### Scanner

- [x] **SCAN-01**: Extension scans current page DOM for invisible Unicode characters (Tags block U+E0000-E007F)
- [x] **SCAN-02**: Extension detects zero-width characters (U+200B-U+200F, U+200C, U+200D, U+FEFF)
- [x] **SCAN-03**: Extension detects AI watermark characters (U+202F narrow no-break space and related LLM patterns)
- [x] **SCAN-04**: Detected invisible text is replaced inline with decoded content on a highlighted background
- [ ] **SCAN-05**: Extension icon badge shows count of hidden characters found on current page
- [x] **SCAN-06**: Scanner discriminates between Tags block, zero-width, and AI watermark character classes
- [x] **SCAN-07**: User can configure scan mode: always-on, on-demand, or badge-only
- [ ] **SCAN-08**: User can toggle highlights on/off without page reload (non-destructive)
- [x] **SCAN-09**: User can export scan results as JSON report (clipboard or download)

### Snippets

- [x] **SNIP-01**: User can save named invisible Unicode snippets in extension settings
- [x] **SNIP-02**: User can paste a saved snippet via context menu
- [x] **SNIP-03**: User can edit and delete saved snippets

### Shortcuts

- [x] **KEYS-01**: User can open extension popup via configurable keyboard shortcut
- [x] **KEYS-02**: User can trigger page scan via configurable keyboard shortcut
- [x] **KEYS-03**: User can quick-paste primary snippet via configurable keyboard shortcut

### Settings

- [x] **SETT-01**: User can configure highlight color/style for detected invisible characters
- [x] **SETT-02**: User can configure scan mode preference (persists across sessions)

### Platform

- [x] **PLAT-01**: Extension uses Chrome Manifest V3
- [x] **PLAT-02**: All processing happens locally — no data leaves the browser
- [x] **PLAT-03**: Extension is published on Chrome Web Store

## v1.1 Requirements (Encrypted Hidden Text)

### Encryption Core

- [x] **ENCR-01**: User can encrypt plaintext with a password before encoding to invisible Unicode (AES-256-GCM via Web Crypto API)
- [x] **ENCR-02**: User can decrypt encrypted invisible text by entering the correct password
- [x] **ENCR-03**: Encrypted output includes invisible markers (`ENC1:` prefix inside Tags block) distinguishing it from plain hidden text
- [x] **ENCR-04**: Wrong password displays clear error message ("Decryption failed — wrong password or corrupted data")
- [x] **ENCR-05**: Messages are compressed before encryption via CompressionStream API when compression reduces size
- [x] **ENCR-06**: Encryption uses PBKDF2 key derivation with random salt (210,000 iterations)

### Encryption UX

- [ ] **EUXP-01**: Popup encode section has password field with show/hide toggle and encrypt button
- [ ] **EUXP-02**: Popup decode section auto-detects encrypted content and shows password prompt
- [ ] **EUXP-03**: Character count display shows encrypted vs unencrypted invisible character count (e.g., "142 chars (72 without encryption)")
- [ ] **EUXP-04**: Compression toggle shows compressed vs uncompressed character count comparison
- [ ] **EUXP-05**: Copy encrypted output to clipboard works the same as unencrypted

### Encrypted Content Detection

- [ ] **EDET-01**: Page scanner detects encrypted hidden text via marker prefix in decoded Tags runs
- [ ] **EDET-02**: Encrypted hidden text is highlighted with distinct color and "[Encrypted]" label, separate from regular tags/zerowidth/watermark
- [ ] **EDET-03**: User can click encrypted highlight to trigger inline password prompt
- [ ] **EDET-04**: After entering correct password, decrypted text replaces the encrypted highlight inline
- [ ] **EDET-05**: Auto-detect encrypted content option in settings (manual trigger by default)

### Password Management

- [ ] **PASS-01**: User can save named passwords in settings (stored in chrome.storage.local)
- [ ] **PASS-02**: User can edit and delete saved passwords
- [ ] **PASS-03**: Saved passwords appear as dropdown in popup encrypt/decrypt password fields
- [ ] **PASS-04**: User can link a saved password to a snippet for one-click encrypted encoding
- [ ] **PASS-05**: Context menu encrypted paste uses linked snippet password automatically

## v2 Requirements

### Extended Detection

- **EXTD-01**: Character-level breakdown in scan results (U+XXXX codepoint, Unicode name, count)
- **EXTD-02**: Right-click context menu to decode selected text
- **EXTD-03**: Right-click context menu to encode selected text as invisible Unicode

### Cross-Browser

- **XBRO-01**: Firefox port using WebExtensions API
- **XBRO-02**: Edge compatibility testing

### Future Encryption

- **FENC-01**: Additional encryption algorithms (selectable in UI, version byte supports this)
- **FENC-02**: Base-96 encoding (using full Tags block range) for ~50% character savings over Base64

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-stripping invisible chars from pages | Breaks emoji ZWJ sequences and legitimate Unicode uses |
| Cloud sync / server-side processing | Violates privacy-first promise |
| LLM integration for explaining hidden text | Requires sending user text to external API |
| Real-time keystroke scanning | High performance cost, Chrome may throttle |
| User accounts / OAuth | Massive complexity, breaks privacy promise |
| Mobile browser support | Chrome desktop only |
| Public-key / asymmetric encryption | Overkill for friend-group use case; complex key management UX |
| Cloud key management | Violates no-network-calls constraint |
| Password strength enforcement | This is steganography for fun, not banking; show visual-only warning |
| Session password caching | Security risk in shared Chrome context |

## Traceability

### v1.0

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONV-01 | Phase 4 | Complete |
| CONV-02 | Phase 4 | Complete |
| CONV-03 | Phase 4 | Complete |
| CONV-04 | Phase 4 | Complete |
| CONV-05 | Phase 4 | Complete |
| SCAN-01 | Phase 2 | Complete |
| SCAN-02 | Phase 2 | Complete |
| SCAN-03 | Phase 5 | Complete |
| SCAN-04 | Phase 2 | Complete |
| SCAN-05 | Phase 2 | Pending |
| SCAN-06 | Phase 5 | Complete |
| SCAN-07 | Phase 2 | Complete |
| SCAN-08 | Phase 2 | Pending |
| SCAN-09 | Phase 5 | Complete |
| SNIP-01 | Phase 5 | Complete |
| SNIP-02 | Phase 5 | Complete |
| SNIP-03 | Phase 5 | Complete |
| KEYS-01 | Phase 3 | Complete |
| KEYS-02 | Phase 3 | Complete |
| KEYS-03 | Phase 3 | Complete |
| SETT-01 | Phase 3 | Complete |
| SETT-02 | Phase 3 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 6 | Complete |

### v1.1 (Encrypted Hidden Text)

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENCR-01 | Phase 7 | Complete |
| ENCR-02 | Phase 7 | Complete |
| ENCR-03 | Phase 7 | Complete |
| ENCR-04 | Phase 7 | Complete |
| ENCR-05 | Phase 7 | Complete |
| ENCR-06 | Phase 7 | Complete |
| EUXP-01 | Phase 8 | Pending |
| EUXP-02 | Phase 8 | Pending |
| EUXP-03 | Phase 8 | Pending |
| EUXP-04 | Phase 8 | Pending |
| EUXP-05 | Phase 8 | Pending |
| EDET-01 | Phase 9 | Pending |
| EDET-02 | Phase 9 | Pending |
| EDET-03 | Phase 11 | Pending |
| EDET-04 | Phase 11 | Pending |
| EDET-05 | Phase 9 | Pending |
| PASS-01 | Phase 10 | Pending |
| PASS-02 | Phase 10 | Pending |
| PASS-03 | Phase 10 | Pending |
| PASS-04 | Phase 10 | Pending |
| PASS-05 | Phase 10 | Pending |

**Coverage:**
- v1.0 requirements: 25 total (23 complete, 2 pending)
- v1.1 requirements: 21 total
- Mapped to phases: 21/21
- Unmapped: 0

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-03-04 after v1.1 roadmap creation*
