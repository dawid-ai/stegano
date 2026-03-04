# Feature Landscape: Encrypted Invisible Text (v1.1)

**Domain:** Password-encrypted steganography in a Chrome extension
**Researched:** 2026-03-04
**Confidence:** MEDIUM-HIGH (encryption patterns from Web Crypto API docs are HIGH; UX patterns from competitor analysis are MEDIUM; character count impact calculated from known AES-GCM parameters)

---

## Context

Stegano v1.0 already encodes/decodes invisible Unicode text and scans pages. This research covers the **encryption layer** added on top: password-based encryption so that invisible text is unreadable even if someone knows about Unicode steganography. Primary use case: friends hiding exclusive messages on social media (X/Twitter, Discord, etc.).

### Key Competitors with Encryption

| Tool | Encryption | Algorithm | Password UX | Notes |
|------|-----------|-----------|-------------|-------|
| StegCloak | Yes | AES-256-CTR | Single password per operation | JS library, no browser extension; uses zero-width chars (not Tags block); optional HMAC integrity |
| StegZero | No | N/A | N/A | Zero-width only, no encryption |
| PassLok Image Steg | Yes | Asymmetric | Key pairs | Image-based, not text; overkill for the friend-group use case |
| ASCII Smuggler | No | N/A | N/A | Tags block encoding only, no encryption |

**Gap:** No Chrome extension offers password-encrypted invisible Unicode text with Tags block encoding. StegCloak is a library (not an extension) and uses zero-width chars (not Tags block). This is a clear differentiator.

---

## Table Stakes

Features users expect from an encrypted steganography tool. Missing these makes the encryption feature feel broken or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Password field in encode flow | Cannot encrypt without a password; this is literally the feature | LOW | Add a password input above the Encode button; show/hide toggle |
| Password field in decode flow | Symmetric expectation; users paste encrypted text and need to enter the password to read it | LOW | Show password input when encrypted content is detected in decode textarea |
| Encrypt-then-encode pipeline | Standard cryptographic practice (encrypt plaintext, then encode ciphertext as invisible Unicode); StegCloak does this | MEDIUM | `plaintext -> compress -> AES-GCM encrypt -> base64 -> Tags block encode` |
| Decrypt-then-decode pipeline | Reverse of above; must handle errors gracefully (wrong password, corrupted data) | MEDIUM | `Tags block decode -> base64 -> AES-GCM decrypt -> decompress -> plaintext` |
| Clear wrong-password error message | Users will enter wrong passwords constantly; "Decryption failed - wrong password or corrupted data" is expected, not a cryptic error | LOW | AES-GCM throws on wrong password (authentication tag mismatch); catch and display friendly message |
| Character count display showing encryption overhead | Users need to know how many invisible characters the encrypted output uses, especially for platforms with character limits | LOW | Show count like "142 invisible characters (72 without encryption)" |
| Encrypted content markers | The invisible output must be distinguishable from plain invisible text so the decoder knows to ask for a password | MEDIUM | Prepend a short marker sequence before the encrypted payload (see Architecture) |
| Copy encrypted output to clipboard | Same as existing copy button; encrypted output must be copyable | LOW | Already exists; just ensure it works with encrypted output too |

### Character Count Impact (Critical for Social Media Use Case)

Encryption adds overhead. Users MUST see this before encoding. Compression (deflate-raw via CompressionStream API) offsets this for messages longer than ~30 characters.

**AES-256-GCM overhead breakdown:**
- Version byte: 1 byte
- Salt: 16 bytes (for PBKDF2 key derivation)
- IV: 12 bytes (initialization vector)
- Auth tag: 12 bytes (96-bit, minimum NIST-recommended)
- Total fixed overhead: 41 bytes
- Ciphertext: same length as plaintext (or compressed plaintext)
- Base64 encoding: expands by 33%

**Example calculations (with optional compression):**

| Message | Plain Tags chars | Encrypted (no compress) | Encrypted (compressed) | Notes |
|---------|-----------------|------------------------|----------------------|-------|
| "hello" (5 chars) | 5 | ~62 | ~62 (no gain) | Short msgs: skip compression |
| "meet at 3pm" (12 chars) | 12 | ~72 | ~72 (no gain) | Still too short for compression |
| 50 chars | 50 | ~122 | ~100 | Compression starts helping |
| 140 chars (tweet) | 140 | ~242 | ~167 | Saves ~75 chars |
| 280 chars (full tweet) | 280 | ~428 | ~270 | Saves ~158 chars |

**Key insight:** Compression via the built-in CompressionStream API (zero bundle size) significantly reduces overhead for medium-to-long messages. The version byte flags whether compression was used, so the decoder knows how to handle it.

**Platform considerations:**
- Twitter/X: 280 character limit includes invisible chars; Tags block chars are surrogate pairs (2 UTF-16 code units each), so platform counting may vary
- Discord: 2000 char limit; plenty of room
- Reddit: 10,000 char limit; no concern

---

## Differentiators

Features that set Stegano apart from StegCloak and other tools. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Encrypted content detection in page scanner | Scanner already detects invisible text; distinguishing encrypted from plaintext invisible content with a distinct color/label (e.g., purple "Encrypted" vs yellow "Hidden text") is unique | MEDIUM | Check for marker prefix in decoded Tags runs; add new `encrypted` type to ScanFinding |
| Inline decrypt on page (click highlight -> enter password -> see text) | No tool offers in-page decryption of detected encrypted invisible text; this is the "wow" feature | HIGH | Requires a small popup/dialog anchored to the highlight; password input, decrypt button, show result inline |
| Password manager in settings | Save named passwords for reuse; no steganography tool has this | MEDIUM | Store password names + passwords in chrome.storage.local; CRUD UI in settings |
| Link passwords to snippets | A snippet "secret greeting" can be linked to password "friendgroup1" so encoding is one-click | MEDIUM | Requires `passwordId` field on Snippet type; auto-fill password when snippet is selected |
| Compression toggle with size comparison | Show users compressed vs uncompressed character count so they can make informed decisions | LOW | Version byte has compression flag; show both options in UI |
| Auto-detect encrypted vs plain hidden text | When pasting into the decode field, auto-detect the marker and show "Encrypted - enter password" vs immediate decode | LOW | Check for marker bytes at start of decoded content |
| Context menu encrypted paste | Extend existing snippet context menu to encrypt-and-paste with a linked password | MEDIUM | Requires the snippet-password linking feature first |

---

## Anti-Features

Features to deliberately NOT build for v1.1. These are tempting but wrong.

| Anti-Feature | Why Tempting | Why Avoid | What to Do Instead |
|--------------|-------------|-----------|-------------------|
| Public-key / asymmetric encryption | "Real" encryption for security-minded users | Massively complex key management UX (generate, share, store key pairs); overkill for "friends sharing on Twitter"; breaks the simplicity promise | Stick with shared-password symmetric encryption (AES-GCM). Users share passwords out-of-band. |
| Cloud key management / key sharing | Users need to share passwords somehow | Any server component violates the "no network calls" constraint; creates data liability | Document that passwords must be shared out-of-band; this is a feature, not a limitation (no attack surface) |
| Password strength enforcement | Security best practice | This is steganography for fun among friends, not a banking app; forcing complex requirements frustrates users | Show a visual-only warning if password is under 8 chars; do not block |
| Multiple encryption algorithms at launch | Seems like a power-user feature | One algorithm (AES-256-GCM) is the right answer; offering alternatives adds decision paralysis and testing burden | Ship AES-256-GCM only. Version byte supports adding algorithms later. |
| Stealth mode (hide the markers too) | "Make it truly undetectable" | Without markers, the decoder cannot distinguish encrypted from plain hidden text; terrible UX | Keep markers; they are invisible to humans anyway |
| Remember password for session | Convenience when decrypting multiple messages | Storing a password in memory creates a security risk; Chrome extension context is shared across tabs | Require password entry each time. UX cost is low for short shared passwords. |
| Streaming encryption for large files | Feels complete | This encodes text for pasting into chat/social. Files are out of scope. | Cap input at reasonable length (e.g., 10,000 chars) with warning |

---

## Feature Dependencies

```
[Password Field in Popup]
    (no dependencies; pure UI addition)

[Encrypt-then-Encode Pipeline]
    requires -> [Web Crypto API: AES-GCM + PBKDF2]
    requires -> [Marker System] (to tag output as encrypted)
    requires -> [Base64 encoding layer] (ciphertext -> ASCII -> Tags block)
    requires -> [CompressionStream wrapper] (optional compress before encrypt)
    enhances -> [Existing encode() in codec.ts]

[Decrypt-then-Decode Pipeline]
    requires -> [Encrypt-then-Encode Pipeline] (for format compatibility)
    requires -> [Marker Detection] (to know when to ask for password)
    enhances -> [Existing decode() in codec.ts]

[Marker System]
    requires -> [Reserved Tags block sequence] (e.g., "ENC1:" ASCII prefix inside Tags)
    used-by -> [Encrypted Content Detection in Scanner]
    used-by -> [Auto-detect in Decode Field]

[Encrypted Content Detection in Scanner]
    requires -> [Marker System]
    requires -> [Existing Page Scanner]
    enhances -> [Existing ScanFinding type] (add 'encrypted' field)
    enhances -> [Existing Highlight System] (add distinct color)

[Inline Decrypt on Page]
    requires -> [Encrypted Content Detection in Scanner]
    requires -> [Decrypt-then-Decode Pipeline]
    requires -> [Password Input UI Component] (small dialog anchored to highlight)

[Password Manager]
    requires -> [chrome.storage.local]
    enhances -> [Password Field in Popup] (auto-fill from saved passwords)

[Snippet-Password Linking]
    requires -> [Password Manager]
    requires -> [Existing Snippet System]
    enhances -> [Context Menu Encrypted Paste]

[Character Count Display]
    requires -> [Encrypt-then-Encode Pipeline] (to calculate both counts)
    (no other dependencies; pure UI)

[Context Menu Encrypted Paste]
    requires -> [Snippet-Password Linking]
    requires -> [Existing Context Menu System]
    requires -> [Encrypt-then-Encode Pipeline]
```

### Critical Path

The minimum dependency chain to deliver encrypted invisible text:

1. **Marker System** -- must be designed first; everything else depends on the format
2. **Encrypt-then-Encode Pipeline** -- core crypto logic
3. **Password Field in Popup** -- UI to trigger encryption
4. **Decrypt-then-Decode Pipeline** -- reverse path
5. **Auto-detect in Decode Field** -- seamless UX

Everything else (scanner detection, inline decrypt, password manager, snippet linking) builds on top.

---

## MVP Recommendation for v1.1

### Must Ship

1. **Password field in encode/decode sections** -- the entry point for the entire feature
2. **Encrypt-then-encode pipeline (AES-256-GCM via Web Crypto API)** -- the core capability
3. **Decrypt-then-decode pipeline with error handling** -- symmetric pair; useless without it
4. **Marker system for encrypted content identification** -- without this, decode UX is broken
5. **Character count display with/without encryption comparison** -- critical for social media use case
6. **Auto-detect encrypted content in decode field** -- show "enter password" prompt automatically
7. **Compression (deflate-raw via CompressionStream)** -- zero bundle cost, significant character savings for medium+ messages

### Should Ship (if time allows)

8. **Encrypted content detection in page scanner** -- distinct color + "[Encrypted]" label
9. **Password manager in settings** -- save/name passwords for reuse

### Defer to v1.2

10. **Inline decrypt on page** -- HIGH complexity; defer until scanner detection is proven
11. **Snippet-password linking** -- requires password manager + UI changes to snippets
12. **Context menu encrypted paste** -- requires snippet-password linking
13. **Encryption method selector** -- only one algorithm at launch

---

## Marker System Design Considerations

The marker system is architecturally critical. It must:

1. **Be short** -- every marker character adds to the invisible payload
2. **Be unambiguous** -- must not collide with legitimate Tags block content
3. **Be detectable by the scanner** -- so encrypted content gets distinct visual treatment
4. **Be forward-compatible** -- support adding encryption method identifiers later

**Recommended approach:** Use an ASCII prefix `ENC1:` placed INSIDE the Tags block encoding. After Tags block decoding, the ASCII string starts with `ENC1:` which signals encrypted content. This adds 5 Tags block characters of overhead.

**Why inside:** The marker is itself invisible (encoded as Tags block). No information leakage about whether content is encrypted. Fully backward compatible -- old content has no prefix.

**Versioning:** The `1` in `ENC1:` is a version number. Future formats: `ENC2:` for different algorithms, etc.

---

## Sources

- [StegCloak -- GitHub (KuroLabs)](https://github.com/KuroLabs/stegcloak) -- encryption flow, AES-256-CTR usage, compression pipeline (HIGH confidence; source code)
- [Web Crypto API: AesGcmParams -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- AES-GCM parameters and IV requirements (HIGH confidence; official docs)
- [Web Crypto API: SubtleCrypto.encrypt() -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt) -- encryption API surface (HIGH confidence; official docs)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) -- PBKDF2 iteration count recommendations (HIGH confidence)
- [CompressionStream -- MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) -- browser compression API (HIGH confidence)
- Project requirements from `.planning/PROJECT.md` -- active requirements list

---
*Feature research for: Stegano v1.1 Encrypted Hidden Text milestone*
*Researched: 2026-03-04*
