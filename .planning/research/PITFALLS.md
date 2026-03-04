# Domain Pitfalls

**Domain:** Encrypted Invisible Unicode Steganography (Chrome Extension v1.1)
**Researched:** 2026-03-04
**Confidence:** HIGH for crypto API and character expansion math; MEDIUM for marker design and password storage patterns

This file covers pitfalls specific to ADDING password-based encryption to an existing invisible Unicode steganography tool. For general Chrome extension pitfalls (service worker lifecycle, DOM manipulation, CWS review, XSS, performance), see the v1.0 pitfalls documented separately.

---

## Critical Pitfalls

Mistakes that cause rewrites, security failures, or fundamental feature breakage.

### Pitfall 1: Catastrophic Character Count Expansion Making Encrypted Text Unusable

**What goes wrong:**
Encryption transforms plaintext into binary ciphertext, which must then be serialized to a text format (base64) before encoding into Tags block Unicode. The chain of expansions is multiplicative and devastating for character-limited platforms:

1. **Encryption overhead (fixed):** 12 bytes IV + 16 bytes PBKDF2 salt + 16 bytes GCM auth tag = 44 bytes added to every message regardless of length
2. **Base64 encoding:** 33% expansion (3 bytes become 4 ASCII characters)
3. **Tags block encoding:** Each ASCII character becomes one Tags block codepoint (U+E0000-E007F), which is a surrogate pair in UTF-16 (2 code units)
4. **Platform counting:** X/Twitter counts each Tags block character as weight 200 (equivalent to 2 characters toward the 280 limit)

**Concrete example — encrypting "Hello" (5 bytes):**

| Stage | Size | Format |
|-------|------|--------|
| Plaintext | 5 bytes | ASCII |
| + IV + salt + auth tag | 49 bytes | binary |
| Base64 | 68 characters | ASCII |
| Tags block encoding | 68 codepoints (136 UTF-16 code units) | invisible Unicode |
| X/Twitter character count | 136 weighted characters | platform-specific |

Compare to unencrypted "Hello": 5 Tags codepoints, 10 X characters. Encryption causes a **13.6x expansion** for short messages on X/Twitter.

For a 140-character message (the practical max for invisible text in a tweet alongside visible text): 140 + 44 = 184 bytes -> 248 base64 chars -> 496 X characters. This **exceeds** the 280 character limit even with zero visible text.

**Why it happens:**
Developers prototype encryption with console.log output and never calculate the end-to-end character budget. The base64 step is the largest contributor but the fixed overhead (44 bytes) dominates for short messages — exactly the use case for hidden text in social media posts.

**Consequences:**
- Encrypted messages too long to fit in tweets, Discord messages, or other character-limited contexts
- Users blame the extension for "not working" when their encrypted hidden text gets silently truncated by platforms
- Feature appears useless for the primary use case (sharing secrets in social media posts)

**Prevention:**
- Show a live character count in the encode UI: "Encrypted: X invisible chars (Y on X/Twitter)" with red warning when exceeding platform limits
- Consider binary-to-Tags encoding instead of base64-to-Tags: map each byte directly to two Tags block characters (nibble encoding), or use a custom base-96 encoding that maps directly to the Tags block printable range (U+E0020-U+E007E = 95 usable codepoints), eliminating the base64 intermediate step
- With base-96 encoding: ceil(N * log(256) / log(95)) chars, which is roughly 1.03x the byte length — dramatically better than base64's 1.33x
- Document maximum plaintext lengths for popular platforms prominently in the UI
- Consider offering a "compact" encryption mode with shorter IV (acceptable for low-volume use) or no salt embedding (derive from a convention instead)

**Detection (warning signs):**
- No character budget calculation exists in the design doc
- Prototype uses base64 without considering alternatives
- No UI shows character count impact of encryption

**Phase to address:**
Architecture phase. The serialization format must be decided before any encryption code is written. Changing the wire format after release breaks backward compatibility with all previously encrypted messages.

---

### Pitfall 2: AES-GCM Nonce Reuse Destroying All Security Guarantees

**What goes wrong:**
AES-GCM is catastrophically broken if the same nonce (IV) is ever reused with the same key. Two ciphertexts encrypted with the same key and nonce allow an attacker to:
1. XOR the ciphertexts to cancel the keystream, revealing the XOR of the two plaintexts
2. Recover the GCM authentication key (H) through polynomial math
3. Forge authentication tags for arbitrary messages
4. Decrypt any past or future message encrypted with that key+nonce pair

This is not a theoretical weakness — it is a complete, practical break of both confidentiality and integrity.

**Why it happens:**
- Using `crypto.getRandomValues()` for 12-byte (96-bit) nonces has a birthday collision probability of ~1 in 2^32 after 2^16 (65,536) encryptions with the same key. For a user who encrypts frequently with the same password, this is reachable.
- Deterministic nonce generation from a counter requires persistent state — but Chrome extension service workers lose state on termination.
- Developers test with a handful of messages and never consider collision probability at scale.

**Consequences:**
- Complete loss of confidentiality for all messages encrypted with the colliding key+nonce
- Authentication forgery enables undetected message tampering
- Security failure is silent — no error, no warning, no detection

**Prevention:**
- Use random 12-byte nonces via `crypto.getRandomValues()` — this is acceptable for the extension's use case because each password derives a different key, and individual users will not encrypt 65,000+ messages with the same password
- Document the collision risk threshold: with random nonces, the same password should not be used for more than ~4 billion encryptions (2^32 at 2^-32 collision probability per pair), which is far beyond realistic use
- Do NOT attempt counter-based nonces — service worker state loss makes counters unreliable and dangerous
- If extreme caution is desired, use AES-GCM-SIV (nonce-misuse-resistant) — but this is NOT available in Web Crypto API, so it would require a JS library (which conflicts with the no-remote-code constraint and adds bundle size)
- Embed the nonce in the output format so the decoder always uses the correct nonce

**Detection (warning signs):**
- Nonce generation uses anything other than `crypto.getRandomValues()`
- Counter-based nonce stored in `chrome.storage` (will lose state or race condition)
- Nonce is derived deterministically from the plaintext or password (same input = same nonce = catastrophic)
- No nonce is visible in the serialized output format

**Phase to address:**
Core encryption implementation phase. This is a non-negotiable constraint on the encryption design.

---

### Pitfall 3: Marker Sequences Colliding with Legitimate Hidden Text

**What goes wrong:**
Encrypted content needs markers (delimiters) so the scanner can distinguish "this is encrypted hidden text" from "this is regular hidden text." If the marker sequence can appear naturally in non-encrypted Tags block text, the scanner will:
- False-positive: try to decrypt regular hidden text, fail, and confuse the user
- False-negative: miss encrypted content because it was consumed as part of a larger "regular" detection run
- Corruption: partial marker matches split an encrypted payload across two scan findings, making it undecryptable

**Why it happens:**
The Tags block maps to ASCII. If the marker is chosen from printable ASCII mapped to Tags block (e.g., the string `[ENC]` encoded as Tags characters), any regular hidden text containing `[ENC]` will trigger a false match. The existing codec already wraps text in U+E0001 (TAG BEGIN) and U+E007F (TAG CANCEL) — reusing these for encryption markers creates ambiguity with regular wrapped text.

**Consequences:**
- Encrypted text that cannot be decrypted because the scanner misidentified its boundaries
- Regular hidden text falsely flagged as encrypted, breaking the existing decode flow
- User trust destroyed when "decrypt" fails silently or produces garbage

**Prevention:**
- Use Tags block characters OUTSIDE the printable ASCII mapping range as markers. The Tags block has U+E0000-U+E001F (control character mappings) available. Choose a specific pair that the existing codec never produces:
  - Start marker: U+E0002 (not used by the existing codec — TAG BEGIN is U+E0001)
  - End marker: U+E0003 (also unused)
  - These cannot appear in regular encoded text because `encode()` only maps ASCII 0-127, and positions 0x02/0x03 are control characters that printable text never contains
- Add a version byte after the start marker (e.g., U+E0010 for version 1) to enable future format changes
- The scanner must check for encryption markers BEFORE attempting regular Tags decode — marker detection takes priority
- Validate: marker + ciphertext + marker must round-trip perfectly. If the marker appears inside the ciphertext, the encoding is broken.

**Detection (warning signs):**
- Markers chosen from printable ASCII range (U+E0020-U+E007E)
- Markers reuse U+E0001 or U+E007F (existing TAG BEGIN/CANCEL)
- Scanner processes tags-block text in a single pass without checking for encryption markers first
- No test case for "regular text containing the marker sequence"

**Phase to address:**
Architecture phase. The marker format is a wire protocol — changing it after release breaks all previously encrypted messages.

---

### Pitfall 4: Passwords Stored in Plaintext in Chrome Sync Storage

**What goes wrong:**
Chrome sync storage is NOT encrypted at rest from the user's perspective. Data in `chrome.storage.sync` is:
1. Stored as plaintext JSON in the user's Chrome profile directory on disk
2. Synced to Google's servers (accessible to Google, and exposed if the Google account is compromised)
3. Readable by any code running in the extension's context

Storing encryption passwords in sync storage means anyone with access to the user's Google account, local filesystem, or a compromised extension can read all passwords.

**Why it happens:**
The extension already uses `chrome.storage.sync` for settings and snippets. It feels natural to add passwords to the same storage. Developers think "it's in the extension, so it's safe" — but sync storage has no access control beyond the extension's own code.

**Consequences:**
- Passwords exposed in Google account data exports
- Passwords visible in plaintext in the Chrome profile directory
- If the extension is ever compromised (malicious update, supply chain attack), all saved passwords are immediately exfiltrable
- False sense of security — users think their passwords are protected but they are not

**Prevention:**
- **Never store passwords in plaintext.** Store only derived key material or password hashes — but this is tricky because PBKDF2 output is a key, not a verifiable hash.
- **Best approach: store only password metadata** (name, creation date, associated snippets) in sync storage. Require the user to re-enter the password each time, or offer a session-only cache using `chrome.storage.session` (cleared when browser closes, 10 MB limit, never synced, never written to disk in plaintext).
- **If password persistence is required:** encrypt the passwords with a master password that is never stored. This is the approach used by browser password managers, but it adds significant UX complexity (master password entry on every browser start).
- **Acceptable compromise for this extension:** store passwords in `chrome.storage.session` only (survives tab switches but not browser restart). Label this clearly in the UI: "Passwords are cleared when you close the browser."
- Do NOT use `chrome.storage.local` as a "more secure" alternative — it is also plaintext on disk, just not synced.

**Detection (warning signs):**
- Password field value written directly to `chrome.storage.sync` or `chrome.storage.local`
- Storage schema includes a `password: string` field
- No distinction between "password name/label" and "password value" in storage types
- Settings export/backup includes readable passwords

**Phase to address:**
Architecture phase. The password storage model must be decided before the password manager UI is built.

---

## Moderate Pitfalls

### Pitfall 5: PBKDF2 Iteration Count Too Low or Too High for Browser Context

**What goes wrong:**
OWASP recommends 600,000 iterations for PBKDF2-SHA256 in 2025. At this count, key derivation on a mid-range laptop takes ~200-300ms. On a low-end Chromebook or old Android device (if the extension ever runs on mobile Chrome), this could take 2-5 seconds — making the encrypt/decrypt interaction feel broken. Conversely, using too few iterations (e.g., 10,000) makes the password trivially brute-forceable.

**Prevention:**
- Target 100,000-310,000 iterations for PBKDF2-SHA256 in the browser context. This balances security with usability: ~50-150ms on modern hardware.
- The threat model is different from server-side password hashing — attackers cannot perform offline brute-force at scale because they need the full ciphertext (embedded in specific messages), not a leaked database of hashes.
- Make the iteration count configurable and stored in the serialized output format, so future versions can increase it without breaking old messages.
- Show a brief "Deriving key..." indicator during encryption/decryption to set user expectations.
- Benchmark on target hardware before finalizing: run `performance.now()` around a test derivation in the popup context.

**Detection (warning signs):**
- Hardcoded iteration count with no benchmark justification
- No loading indicator during key derivation
- Iteration count not stored in the wire format (prevents future increases)

**Phase to address:**
Core encryption implementation phase. Iteration count is part of the wire format.

---

### Pitfall 6: Web Crypto API Context Mismatch Between Popup, Content Script, and Service Worker

**What goes wrong:**
The Web Crypto API (`crypto.subtle`) is available in all three extension contexts (popup, content script, service worker), but with subtle differences:
- In the **service worker**: no `window` object. Must use `crypto.subtle` directly, not `window.crypto.subtle`. Code that references `window` will throw.
- In **content scripts**: `crypto.subtle` works but runs in the page's origin context for some operations. The content script's isolated world has its own `crypto` object.
- **CryptoKey objects are not transferable** across contexts. You cannot derive a key in the service worker and send it to the content script via `chrome.runtime.sendMessage()`. CryptoKey cannot be serialized to JSON.

**Prevention:**
- Perform ALL encryption/decryption in a single context. The popup is the best choice for user-initiated encrypt/decode. The content script is the best choice for inline decryption of detected encrypted text on the page.
- Do NOT try to centralize crypto in the service worker — the service worker may be terminated mid-operation, losing the derived key.
- If both popup and content script need crypto, duplicate the crypto utility code (it is small) rather than trying to share state.
- Export raw key bytes (`crypto.subtle.exportKey('raw', key)`) if you must transfer key material between contexts — but this is a security risk (key material in message passing). Prefer re-deriving the key in each context from the password.

**Detection (warning signs):**
- Code references `window.crypto` in the service worker
- `CryptoKey` objects passed via `chrome.runtime.sendMessage()`
- Encryption logic centralized in background.ts with results sent to content/popup
- No error handling for service worker termination during key derivation

**Phase to address:**
Architecture phase. The decision of "where does crypto happen?" must be made before implementation.

---

### Pitfall 7: Encrypted Output Not Cross-Platform Compatible

**What goes wrong:**
The serialized encrypted format (markers + IV + salt + ciphertext + auth tag encoded as Tags block characters) must be exactly reproducible across all contexts where it might be decoded. Platform-specific issues include:
- Text normalization: some platforms apply NFC normalization to pasted text. Tags block characters are in Plane 14 and are not subject to NFC decomposition, but if base64 intermediate text is stored visibly, NFC could alter it.
- Clipboard handling: some applications strip or replace characters outside the BMP when pasting. Tags block characters (Plane 14) may be silently dropped by older clipboard implementations.
- Line breaks: some platforms insert line breaks into long pasted text, which would corrupt the encrypted payload.
- Platform-specific character stripping: messaging platforms (WhatsApp, Telegram, Discord) may strip Tags block characters entirely.

**Prevention:**
- Test the full encode-paste-decode round-trip on: X/Twitter, Discord, Slack, WhatsApp Web, Telegram Web, Reddit, Gmail compose, Google Docs, Microsoft Word Online
- The encrypted format should be a single unbroken run of Tags block characters with no whitespace, line breaks, or visible separators
- Include a checksum or rely on GCM's auth tag to detect corruption (GCM decryption will fail with an authentication error if even one byte is corrupted)
- When decryption fails, show a specific error: "Message appears corrupted — it may have been modified by the platform. Try copying from the original source."
- Document known-incompatible platforms in the extension's help text

**Detection (warning signs):**
- No round-trip tests across platforms
- Format includes visible separators or line breaks
- Decryption errors show generic "wrong password" instead of distinguishing corruption from wrong password

**Phase to address:**
Integration testing phase. Must be tested before release.

---

### Pitfall 8: No Way to Distinguish Wrong Password from Corrupted Ciphertext

**What goes wrong:**
AES-GCM decryption fails with a generic `DOMException: The operation failed for an operation-specific reason` when either (a) the password is wrong or (b) the ciphertext is corrupted. The Web Crypto API provides no way to distinguish these two failure modes.

**Prevention:**
- Add a known-plaintext verification prefix to the plaintext before encryption: encrypt `"stg1:" + plaintext` and check for the prefix after decryption. If decryption succeeds but the prefix is missing, the ciphertext is corrupted or the format is wrong. If decryption itself fails (GCM auth tag mismatch), it is either wrong password or corruption.
- This costs only 5 bytes of plaintext overhead (minimal impact on character budget).
- Alternatively, include a password verification hash in the serialized format: `HMAC(password, salt)` truncated to 4 bytes. The decoder checks this hash before attempting full decryption, providing instant "wrong password" feedback without the ~100ms PBKDF2 derivation. However, this leaks information about the password (allows offline verification of password guesses without attempting decryption) — acceptable for this threat model but not for high-security contexts.
- Show different error messages: "Incorrect password" vs. "Message appears corrupted"

**Detection (warning signs):**
- Decryption error handler shows a single generic error message
- No attempt to differentiate failure modes
- User testing shows confusion when "Decrypt" fails silently

**Phase to address:**
Core encryption implementation phase. Error handling is part of the decrypt flow.

---

## Minor Pitfalls

### Pitfall 9: Forgetting to Strip Existing TAG BEGIN/CANCEL Wrappers Before Encryption

**What goes wrong:**
The current `encode()` function optionally wraps output in U+E0001 (TAG BEGIN) and U+E007F (TAG CANCEL). If the encrypt flow is: `plaintext -> encrypt -> base64 -> encode(wrap=true)`, the result has TAG BEGIN/CANCEL wrappers. But the encryption markers (proposed U+E0002/U+E0003) must be the outermost delimiters. If both are present, the scanner may detect the TAG BEGIN wrapper first and try to decode the base64 gibberish as regular hidden text.

**Prevention:**
- The encrypt-then-encode flow must use `encode(wrap=false)` for the inner encoding
- Encryption markers must be the outermost delimiters, with no TAG BEGIN/CANCEL inside
- OR: use encryption markers instead of TAG BEGIN/CANCEL entirely for encrypted content
- Add a test: encoded encrypted text must not contain U+E0001 or U+E007F

**Phase to address:** Core encryption implementation.

---

### Pitfall 10: PBKDF2 Salt Reuse Across Messages With Same Password

**What goes wrong:**
If the salt is derived deterministically from the password (e.g., `SHA-256(password)` as the salt), then every message encrypted with the same password uses the same derived key. Combined with random nonces this is not catastrophic, but it reduces the security margin and means a key compromise from one message compromises all messages with that password.

**Prevention:**
- Always generate a random 16-byte salt via `crypto.getRandomValues()` for each encryption operation
- Embed the salt in the serialized output alongside the IV
- Never derive the salt from the password or any deterministic input

**Phase to address:** Core encryption implementation.

---

### Pitfall 11: Bundle Size Bloat from Crypto Libraries

**What goes wrong:**
If the Web Crypto API is insufficient and a JS crypto library is added (e.g., for AES-GCM-SIV or Argon2), the extension bundle size can increase by 50-200KB. Chrome Web Store reviews flag large bundles, and users on slow connections experience delayed extension loads.

**Prevention:**
- Use Web Crypto API exclusively. AES-GCM + PBKDF2 are both natively available and hardware-accelerated.
- Do NOT add `tweetnacl`, `libsodium-wrappers`, `crypto-js`, or any JS crypto library. They are slower, larger, and less audited than the native implementation.
- If a specific algorithm is not in Web Crypto API (e.g., Argon2, ChaCha20-Poly1305), do not use that algorithm. The Web Crypto API constraint is absolute for this project.

**Phase to address:** Architecture phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Wire format design | Character expansion makes encrypted text unusable on X/Twitter | Calculate character budgets FIRST; choose base-96 encoding over base64; show live char counts |
| Wire format design | Marker collision with existing TAG BEGIN/CANCEL | Use U+E0002/U+E0003 from unused Tags control range; test against regular hidden text |
| Wire format design | No version byte prevents future format evolution | Include version indicator in serialized format |
| Encryption implementation | Nonce reuse with counter-based approach and service worker state loss | Use random nonces only; never counter-based in extension context |
| Encryption implementation | PBKDF2 too slow on low-end hardware | Benchmark 100K-310K iterations; show loading indicator; store iteration count in format |
| Encryption implementation | Same error for wrong password vs. corruption | Add plaintext prefix verification; show distinct error messages |
| Password storage | Plaintext passwords in sync storage exposed to Google/disk | Use `chrome.storage.session` only; never persist passwords to disk |
| Password manager UI | Users expect passwords to survive browser restart | Clearly label "Passwords cleared on browser close"; offer re-entry, not persistence |
| Content script decrypt | CryptoKey not transferable between contexts | Derive key locally in content script from password; never send CryptoKey via messaging |
| Platform compatibility | Tags block chars stripped by WhatsApp/Telegram/Discord | Test round-trip on all target platforms; document incompatible platforms |
| Scanner integration | Encrypted text detected as regular hidden text | Scanner checks encryption markers before regular Tags decode |

---

## Character Budget Reference

Quick reference for maximum plaintext sizes on popular platforms, assuming encrypted format with AES-256-GCM + random IV (12B) + random salt (16B) + auth tag (16B) = 44 bytes fixed overhead.

**With base64 intermediate encoding (current simplest approach):**

| Platform | Char Limit | Tags Block Budget | Base64 Budget | Minus Overhead | Max Plaintext |
|----------|-----------|-------------------|---------------|----------------|---------------|
| X/Twitter (standalone) | 280 chars | 140 Tags chars | 140 base64 chars | 105 bytes - 44 | **61 chars** |
| X/Twitter (alongside 140 visible) | 140 chars left | 70 Tags chars | 70 base64 chars | 52 bytes - 44 | **8 chars** |
| Discord message | 2000 chars | 1000 Tags chars | 1000 base64 chars | 750 bytes - 44 | **706 chars** |
| Reddit comment | 10000 chars | 5000 Tags chars | 5000 base64 chars | 3750 bytes - 44 | **3706 chars** |

**With base-96 encoding (Tags block printable range, 95 usable codepoints):**

| Platform | Char Limit | Tags Block Budget | Byte Budget | Minus Overhead | Max Plaintext |
|----------|-----------|-------------------|-------------|----------------|---------------|
| X/Twitter (standalone) | 280 chars | 140 Tags chars | ~136 bytes | 136 - 44 | **92 chars** |
| X/Twitter (alongside 140 visible) | 140 chars left | 70 Tags chars | ~68 bytes | 68 - 44 | **24 chars** |

Base-96 encoding provides ~50% more plaintext capacity than base64 for the same character budget on X/Twitter. This is a significant difference for the primary use case.

**Note:** X/Twitter counts Tags block characters at weight 200 (each counts as 2 toward the 280 limit). This is confirmed by the twitter-text v3 configuration: characters outside defined ranges default to weight 200. Tags block characters (U+E0000-E007F) are not in any defined range.

---

## Sources

- MDN Web Docs — Web Crypto API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API (HIGH confidence — official documentation)
- MDN Web Docs — AesGcmParams: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams (HIGH confidence — official, confirms 96-bit IV recommendation and 128-bit tag default)
- MDN Web Docs — SubtleCrypto.deriveKey(): https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey (HIGH confidence — official, confirms PBKDF2 support)
- Wikipedia — Galois/Counter Mode: https://en.wikipedia.org/wiki/Galois/Counter_Mode (HIGH confidence — confirms ciphertext = plaintext length, plus auth tag)
- elttam — Attacks on GCM with Repeated Nonces: https://www.elttam.com/blog/key-recovery-attacks-on-gcm/ (HIGH confidence — detailed technical analysis of nonce reuse catastrophe)
- frereit — AES-GCM and breaking it on nonce reuse: https://frereit.de/aes_gcm/ (MEDIUM confidence — corroborates elttam analysis)
- DEV Community — Why You Should Use 310,000+ Iterations with PBKDF2 in 2025: https://dev.to/securebitchat/why-you-should-use-310000-iterations-with-pbkdf2-in-2025-3o1e (MEDIUM confidence — cites OWASP, verified against OWASP cheat sheet)
- X Developer Docs — Counting Characters: https://docs.x.com/fundamentals/counting-characters (HIGH confidence — official, confirms NFC normalization and weight-based counting)
- twitter-text v3 config: https://github.com/twitter/twitter-text/blob/master/config/v3.json (HIGH confidence — official library, confirms defaultWeight: 200 for Tags block characters)
- Chromium Extensions Group — Using WebCrypto in MV3 Service Worker: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VCXF9rZXr5Y (MEDIUM confidence — community with Chromium team participation, confirms crypto.subtle available without window prefix)
- Chrome Developers — chrome.storage API: https://developer.chrome.com/docs/extensions/reference/api/storage (HIGH confidence — official, confirms 100KB sync total, 8KB per item, session storage not synced)
- codestudy.net — How to Encrypt Data for Chrome Storage: https://www.codestudy.net/blog/chrome-extension-encrypting-data-to-be-stored-in-chrome-storage/ (MEDIUM confidence — practical guide, verified approach against MDN docs)

---
*Pitfalls research for: InvisibleUnicode v1.1 — Encrypted Hidden Text milestone*
*Researched: 2026-03-04*
