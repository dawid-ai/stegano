# Stack Research: Encryption Layer for Invisible Unicode

**Domain:** Password-based encryption for Chrome Extension steganography
**Researched:** 2026-03-04
**Confidence:** HIGH (Web Crypto API is a W3C standard, verified via MDN and official Chrome docs)

## Recommended Stack Additions

### Encryption (Zero New Dependencies)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Crypto API (`crypto.subtle`) | Browser built-in | AES-GCM encryption + PBKDF2 key derivation | Zero bundle size. Hardware-accelerated. Available in all Chrome extension contexts (popup, content script, service worker). No npm package needed. Standards-based with no supply chain risk. |
| CompressionStream API | Browser built-in (Chrome 80+) | Deflate compression before encryption | Offsets encryption overhead for messages longer than ~40 chars. Zero bundle size. Available in worker contexts. |

### No New npm Dependencies Required

The entire encryption feature can be built with browser-native APIs. This is the correct choice because:

1. **Web Crypto API covers everything needed:** AES-GCM (authenticated encryption), PBKDF2 (key derivation from password), random IV/salt generation (`crypto.getRandomValues`).
2. **No MV3 CSP issues:** External crypto libraries work but add unnecessary bundle size and supply chain risk for capabilities already built into the browser.
3. **Service worker compatibility:** `crypto.subtle` is available in service workers without `window.` prefix. Access it as `globalThis.crypto.subtle` or just `crypto.subtle`.

## Cipher Selection: AES-256-GCM

**Use AES-256-GCM. Do not use AES-CBC, AES-CTR, or ChaCha20.**

### Why AES-256-GCM

- **Authenticated encryption (AEAD):** Detects tampering. If someone modifies even one invisible character, decryption fails gracefully instead of producing garbage output. Critical for steganography where users cannot visually verify ciphertext.
- **No padding:** GCM is a stream mode -- ciphertext length equals plaintext length (plus fixed overhead). AES-CBC adds 1-16 bytes of PKCS7 padding, wasting invisible characters.
- **Web Crypto native:** Fully supported via `crypto.subtle.encrypt({ name: 'AES-GCM', ... })`.
- **Hardware acceleration:** AES-NI instruction set on all modern x86 CPUs makes it fast enough that users will not notice encryption latency.

### Why Not Alternatives

| Alternative | Why Not |
|-------------|---------|
| AES-CBC | Adds 1-16 bytes PKCS7 padding. No authentication -- corrupt ciphertext produces garbage silently. Requires separate HMAC for integrity. |
| AES-CTR | No authentication. Saves only the 12-byte tag vs GCM, but losing integrity detection is not worth 12 characters. A single bit flip in transit produces wrong plaintext with no warning. |
| ChaCha20-Poly1305 | Not available in Web Crypto API. Would require bundling a library (e.g., tweetnacl ~4KB). Same overhead as AES-GCM (16-byte tag). No benefit since all Chrome targets have AES-NI. |
| XSalsa20 / NaCl | Not in Web Crypto API. 24-byte nonce (vs 12 for GCM) adds 12 extra invisible characters. Requires tweetnacl dependency. |
| AES-128-GCM | Works but 256-bit keys cost nothing extra (PBKDF2 derives any length) and future-proof against quantum concerns. |

## Key Derivation: PBKDF2-SHA-256

**Use PBKDF2 with SHA-256. Do not use raw password hashing.**

### Configuration

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Hash | SHA-256 | Sufficient for key derivation. SHA-512 is overkill and not faster on 32-bit JS engines. |
| Iterations | 210,000 | OWASP 2025 recommends minimum 210,000 for PBKDF2-SHA-256. Balance between security and perceived latency (<500ms on modern hardware). |
| Salt length | 16 bytes | Standard. Prevents rainbow table attacks. Must be random per encryption. |
| Key length | 256 bits | Matches AES-256-GCM key requirement. |

### Why PBKDF2 Over Alternatives

| Alternative | Why Not |
|-------------|---------|
| Argon2id | Not available in Web Crypto API. Would require ~50KB+ WASM bundle (argon2-browser). Argon2 is better for password storage but PBKDF2 is adequate for encryption key derivation where the attacker must also know the ciphertext format. |
| scrypt | Not available in Web Crypto API. Same WASM dependency problem as Argon2. |
| Raw SHA-256 | No key stretching. Vulnerable to brute force. Never derive encryption keys from passwords without a KDF. |
| bcrypt | Designed for password hashing, not key derivation. Output is not suitable as an AES key. Not in Web Crypto API. |

### PBKDF2 Performance Note

At 210,000 iterations, `crypto.subtle.deriveBits()` takes approximately 100-300ms on modern desktop Chrome. This is acceptable for a user-initiated encrypt/decode action. If users report latency, iterations can be reduced to 100,000 (still above NIST SP 800-132 minimum) with a version flag in the ciphertext header.

## Ciphertext Overhead Analysis

This is the critical constraint. Every byte of overhead becomes one invisible Unicode character, counting against platform character limits.

### Fixed Overhead Per Encrypted Message

| Component | Bytes | Purpose | Can Reduce? |
|-----------|-------|---------|-------------|
| Version byte | 1 | Future-proofs format changes (compression flag, algorithm changes) | No -- essential for forward compatibility |
| PBKDF2 salt | 16 | Random per message, prevents rainbow tables | No -- cryptographic requirement |
| AES-GCM IV/nonce | 12 | Random per message, prevents nonce reuse | No -- 12 bytes is GCM standard minimum |
| AES-GCM auth tag | 12 | Integrity verification (96-bit tag) | Could use 16 (128-bit default) but 96-bit is the minimum NIST-recommended size. Saves 4 characters. |
| **Total fixed overhead** | **41 bytes** | | = **41 invisible characters** |

### Tag Length Decision: 96 bits (12 bytes) vs 128 bits (16 bytes)

Use **96-bit (12-byte) tags**. Rationale:
- NIST SP 800-38D explicitly lists 96-bit tags as acceptable.
- The Web Crypto API supports `tagLength: 96` in `AesGcmParams`.
- Saves 4 invisible characters per message.
- The threat model is casual eavesdroppers, not nation-state attackers. 96-bit authentication is more than sufficient.
- For comparison: TLS 1.3 uses 128-bit tags, but TLS protects millions of packets per session. This extension encrypts one message at a time.

### Compression to Offset Overhead

Use **CompressionStream API with `deflate-raw` format** to compress plaintext before encryption.

| Message Length | Uncompressed + Overhead | Compressed + Overhead | Net Savings |
|----------------|------------------------|----------------------|-------------|
| 10 chars | 51 chars | ~55 chars (expansion) | -4 (skip compression) |
| 50 chars | 91 chars | ~75 chars | ~16 chars saved |
| 140 chars | 181 chars | ~120 chars | ~61 chars saved |
| 280 chars | 321 chars | ~200 chars | ~121 chars saved |

Compression strategy:
- **Always try compression.** Store a flag in the version byte indicating whether compression was used.
- **Compare compressed vs uncompressed size.** Use whichever is smaller. Short messages (~<30 chars) often expand under deflate.
- Use `deflate-raw` (not `gzip` or `deflate`) to avoid the gzip header (10 bytes) or zlib header (2 bytes).

### Why CompressionStream Over Pako

| | CompressionStream | Pako |
|---|---|---|
| Bundle size | 0 bytes | ~45KB minified |
| API | Async (streams) | Sync |
| Availability | Chrome 80+ (all MV3 targets) | Any JS environment |
| Performance | Native C++ implementation | JS implementation, slower |

CompressionStream is async (returns ReadableStream), which requires a small wrapper to collect output into a Uint8Array. This is fine since `crypto.subtle` is also async.

**Pako is only needed if you need synchronous compression**, which you do not in this architecture.

## Wire Format

The encrypted+encoded message should use this binary layout before Tags block encoding:

```
[version:1][salt:16][iv:12][tag:12][ciphertext:N]
= 41 + N bytes total, where N = len(compressed_plaintext) or len(plaintext)
```

Version byte bit layout:
```
Bit 7-4: Algorithm (0 = AES-256-GCM + PBKDF2-SHA256)
Bit 3:   Compression (0 = none, 1 = deflate-raw)
Bit 2-0: Reserved
```

This entire byte array is then encoded to Tags block characters (each byte maps to one invisible character via the existing codec, but operating on raw bytes rather than ASCII text).

### Encoding Raw Bytes to Tags Block

The current codec maps ASCII (0-127) to Tags block. Encrypted output is raw bytes (0-255). Two approaches:

**Option A: Base64 encode before Tags encoding**
- Ciphertext bytes -> Base64 string (ASCII) -> Tags block encoding
- Overhead: 33% expansion from Base64 (3 bytes become 4 chars)
- Total: 41 bytes overhead * 1.33 + ciphertext * 1.33

**Option B: Extend codec to use full byte range**
- Map bytes 0-255 directly to a chosen Unicode range
- No expansion, but requires a new encoding scheme beyond Tags block
- Problem: Tags block only covers 0x00-0x7F (128 values)

**Option C (RECOMMENDED): Base85 encoding**
- Less common but 25% overhead (vs 33% for Base64)
- 4 bytes become 5 chars (all within ASCII printable range before Tags encoding)

**Option D (RECOMMENDED): Use two Tags block characters per byte**
- High nibble + low nibble, each mapped to Tags block
- 100% expansion -- worse than Base64

**Recommendation: Base64 encoding (Option A).** Rationale:
- 33% expansion is acceptable given compression typically saves 30-60%
- Base64 is built-in: `btoa(String.fromCharCode(...bytes))` or better, a proper Uint8Array-to-Base64 utility
- No new Unicode ranges needed -- stays within the existing Tags block encoding
- Simple to implement, debug, and test
- `atob`/`btoa` available in all extension contexts

### Total Character Count Formula

```
invisible_chars = ceil(len(base64(version + salt + iv + tag + encrypt(maybe_compress(plaintext)))) )
                = ceil((41 + N) * 4/3)
```

For a 140-character English plaintext (typical tweet-length):
- Compressed to ~60% = 84 bytes ciphertext
- + 41 bytes overhead = 125 bytes
- Base64: ceil(125 * 4/3) = 167 invisible characters
- Without compression: ceil((41 + 140) * 4/3) = 242 invisible characters

Compression saves ~75 invisible characters on a tweet-length message.

## Integration Points with Existing Stack

### crypto-utils.ts (new file)

```typescript
// utils/crypto.ts -- all encryption/decryption logic

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 96; // bits
const PBKDF2_ITERATIONS = 210_000;
const VERSION = 0x00; // v0: AES-256-GCM + PBKDF2-SHA256

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(plaintext: string, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  // Compress
  const compressed = await compress(new TextEncoder().encode(plaintext));
  const useCompression = compressed.length < plaintext.length;
  const data = useCompression ? compressed : new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    data
  );

  // Pack: version | salt | iv | ciphertext+tag (GCM appends tag to ciphertext)
  const version = useCompression ? (VERSION | 0x08) : VERSION;
  const result = new Uint8Array(1 + SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  result[0] = version;
  result.set(salt, 1);
  result.set(iv, 1 + SALT_LENGTH);
  result.set(new Uint8Array(ciphertext), 1 + SALT_LENGTH + IV_LENGTH);

  return result;
}
```

### Codec Integration

The existing `codec.ts` handles ASCII -> Tags block. The encrypted output needs:

1. `encrypt(plaintext, password)` returns `Uint8Array`
2. `uint8ArrayToBase64(bytes)` returns ASCII string
3. Existing `encode(base64String, { wrap: true })` returns invisible Tags block text

Decryption reverses: Tags decode -> Base64 decode -> `decrypt(bytes, password)`.

### Storage Integration

| Data | Storage | Notes |
|------|---------|-------|
| Saved passwords | `chrome.storage.local` | Encrypted at rest with a master password, or stored plaintext with user acknowledgment. NOT `chrome.storage.sync` -- passwords should not sync to Google's servers. |
| Password-snippet links | `chrome.storage.local` | Map of snippet ID to password name |
| Encryption settings (iterations, tag length) | `chrome.storage.sync` | Small config, fine to sync |

### Service Worker Notes

- `crypto.subtle` is available in MV3 service workers. Use `crypto.subtle` directly (not `window.crypto.subtle`).
- CompressionStream is available in worker contexts (Chrome 80+).
- All crypto operations are async -- fits naturally with service worker event-driven model.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| CryptoJS | Abandoned (last update 2021), slow pure-JS implementation, known vulnerabilities | Web Crypto API |
| forge (node-forge) | 200KB+ bundle, pure JS, slower than native, unnecessary for browser use | Web Crypto API |
| tweetnacl | Good library but adds dependency for what Web Crypto provides natively. Only justified if you need XSalsa20 (you do not). | Web Crypto API |
| libsodium-wrappers | 190KB+ WASM bundle. Powerful but massive overkill for AES-GCM + PBKDF2. | Web Crypto API |
| sjcl (Stanford JS Crypto Library) | Unmaintained since 2018, known issues, pure JS | Web Crypto API |
| Argon2 WASM | 50KB+ WASM. Better KDF but PBKDF2 is adequate here and available natively. | PBKDF2 via Web Crypto API |
| `window.crypto` prefix | Not available in service workers | `crypto.subtle` (global) |
| AES-CBC | Requires padding (wastes characters), no built-in authentication | AES-GCM |
| localStorage for passwords | Not available in service workers, not encrypted | chrome.storage.local |

## Sources

- [MDN: Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) -- API reference, HIGH confidence
- [MDN: AesGcmParams](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- tagLength parameter options, HIGH confidence
- [MDN: SubtleCrypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) -- encrypt/decrypt/deriveKey methods, HIGH confidence
- [MDN: CompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) -- browser compression API, HIGH confidence
- [Chrome Developers: Compression Streams API](https://developer.chrome.com/blog/compression-streams-api) -- availability and usage, HIGH confidence
- [Chromium Extensions Group: WebCrypto in MV3 service workers](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VCXF9rZXr5Y) -- confirms crypto.subtle availability without window prefix, MEDIUM confidence
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) -- PBKDF2 iteration recommendations, HIGH confidence
- [DEV: Why 310,000+ PBKDF2 iterations in 2025](https://dev.to/securebitchat/why-you-should-use-310000-iterations-with-pbkdf2-in-2025-3o1e) -- iteration count analysis, MEDIUM confidence
- [Soatok: Comparison of Symmetric Encryption Methods](https://soatok.blog/2020/07/12/comparison-of-symmetric-encryption-methods/) -- cipher comparison, MEDIUM confidence

---
*Stack research for: Encryption layer -- InvisibleUnicode v1.1*
*Researched: 2026-03-04*
