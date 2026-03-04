# Research Summary: Encryption Layer for Invisible Unicode (v1.1)

**Domain:** Password-based encryption for Chrome extension Unicode steganography
**Researched:** 2026-03-04
**Overall confidence:** HIGH

## Executive Summary

Adding password-based encryption to Stegano requires zero new npm dependencies. The Web Crypto API provides AES-256-GCM (authenticated encryption) and PBKDF2-SHA-256 (key derivation) natively in all Chrome extension contexts -- popup, content script, and service worker. The browser's CompressionStream API provides deflate-raw compression to offset encryption overhead, also at zero bundle cost.

The critical constraint is character count overhead. Every encrypted message incurs 41 bytes of fixed overhead (1 version + 16 salt + 12 IV + 12 auth tag) plus a Base64 expansion of 33%. For a 5-character message, this means ~62 invisible characters instead of 5 -- a 12x expansion. Compression via CompressionStream offsets this for messages longer than ~30 characters, reducing a 140-character message from ~242 to ~167 invisible characters. The existing PITFALLS.md research identified base-96 encoding as a potential alternative to Base64 that would reduce expansion to ~3% instead of 33%, but the implementation complexity is higher and Base64 is the safer starting point.

The architecture is clean: a new `utils/crypto.ts` module sits between the user's plaintext and the existing `utils/codec.ts` encoder. The flow is plaintext -> compress -> encrypt -> Base64 -> marker prefix -> Tags block encode. Detection works by recognizing an `ENC1:` marker prefix in decoded Tags block text. All existing unencrypted functionality continues to work unchanged -- full backward compatibility.

The main risks are: (1) nonce reuse catastrophically breaks AES-GCM security (prevented by always using `crypto.getRandomValues`), (2) character count overhead making encrypted messages unusable on Twitter/X (mitigated by compression and clear UI showing character budget), and (3) password storage expectations (use `chrome.storage.local` with clear documentation that passwords are not vault-encrypted).

## Key Findings

**Stack:** Zero new dependencies. Web Crypto API (AES-256-GCM + PBKDF2) and CompressionStream API are browser built-ins available in all extension contexts.

**Architecture:** New `crypto.ts`, `compression.ts`, and `markers.ts` modules. Existing `codec.ts` and `scanner.ts` unchanged (minor type extension for scanner). Wire format: `[version:1][salt:16][iv:12][ciphertext+tag:N+12]` Base64-encoded with `ENC1:` marker prefix.

**Critical pitfall:** AES-GCM nonce reuse destroys all security. Always use `crypto.getRandomValues()` for IV generation -- never deterministic, never counter-based (service worker state loss makes counters unsafe).

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Core Encryption Pipeline** - Build crypto.ts, compression.ts, markers.ts with full unit tests
   - Addresses: encrypt/decrypt functions, wire format, Base64 bridge, compression
   - Avoids: Nonce reuse (random IV from day one), Base64/ASCII verification tests

2. **Popup Encrypt/Decrypt UI** - Add password fields and encrypt toggle to popup
   - Addresses: Password input, encrypt-then-encode flow, character count display
   - Avoids: Latency perception (loading indicator during PBKDF2)

3. **Scanner Integration** - Detect encrypted content, distinct highlight color
   - Addresses: Marker detection in scanner output, purple encrypted highlights
   - Avoids: Marker collision (detect encryption markers before regular decode)

4. **Password Management** - CRUD for saved passwords, snippet-password linking
   - Addresses: Password storage in chrome.storage.local, settings UI
   - Avoids: Sync storage for passwords (use local only)

5. **Inline Decryption** - Click-to-decrypt on detected encrypted highlights
   - Addresses: Password prompt anchored to highlight, in-page decryption
   - Avoids: CryptoKey transfer between contexts (derive locally)

**Phase ordering rationale:**
- Phase 1 first because the wire format is a protocol -- changing it after release breaks all previously encrypted messages. Get it right before any UI depends on it.
- Phase 2 before scanner integration because the popup is the simplest context to test the full encrypt/decrypt flow end-to-end.
- Password management (Phase 4) is independent of scanner integration (Phase 3) -- can be parallelized.
- Inline decryption (Phase 5) is the "wow" feature but also the highest complexity. Ship core flow first, then add the polish.

**Research flags for phases:**
- Phase 1: Verify CompressionStream availability in Vitest test environment; may need browser-mode testing
- Phase 2: Benchmark PBKDF2 at 210,000 iterations on target hardware; adjust if >500ms
- Phase 3: Test marker detection against edge cases (regular text starting with "ENC1:")
- Phase 5: Content script inline UI needs Shadow DOM to avoid page CSS interference

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Web Crypto API is a W3C standard. Zero dependency risk. Verified via MDN official docs. |
| Features | MEDIUM-HIGH | Feature set clear from requirements. Character count math verified. Compression savings estimated (not benchmarked). |
| Architecture | HIGH | Wire format designed from known AES-GCM parameters. Module boundaries clean. Backward compatibility verified by analysis of existing codec.ts. |
| Pitfalls | HIGH | Crypto pitfalls well-documented in security literature. Nonce reuse, auth tag, and PBKDF2 iteration count are established knowledge. |

## Gaps to Address

- **Platform character counting:** Twitter/X Tags block character weight needs empirical verification. The twitter-text library suggests weight 200 (2 chars per codepoint), but this should be tested with actual posts before finalizing character budget guidance in the UI.
- **CompressionStream in Vitest:** The test environment may not have CompressionStream. Need to verify or provide a test polyfill. Low risk -- the crypto.ts module can be tested with compression disabled.
- **Base-96 encoding vs Base64:** The PITFALLS.md identified base-96 as a ~50% improvement in character efficiency over Base64. This is a v1.1 optimization opportunity but adds implementation complexity. Recommend starting with Base64 and evaluating base-96 if character budget feedback warrants it.
- **Password storage UX:** The research identified tension between user convenience (persist passwords across browser restarts) and security (plaintext in storage). The PITFALLS.md recommends `chrome.storage.session` only. The ARCHITECTURE.md recommends `chrome.storage.local`. This needs a product decision before Phase 4.

## Sources

### Primary (HIGH confidence)
- [MDN: Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [MDN: AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams)
- [MDN: SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)
- [MDN: CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream)
- [Chrome Developers: Compression Streams API](https://developer.chrome.com/blog/compression-streams-api)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NIST SP 800-38D: GCM specification](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf)

### Secondary (MEDIUM confidence)
- [Chromium Extensions Group: WebCrypto in MV3 service workers](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VCXF9rZXr5Y)
- [DEV: PBKDF2 iterations in 2025](https://dev.to/securebitchat/why-you-should-use-310000-iterations-with-pbkdf2-in-2025-3o1e)
- [Soatok: Comparison of Symmetric Encryption Methods](https://soatok.blog/2020/07/12/comparison-of-symmetric-encryption-methods/)
- [Soatok: Extending the AES-GCM Nonce](https://soatok.blog/2022/12/21/extending-the-aes-gcm-nonce-without-nightmare-fuel/)

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
