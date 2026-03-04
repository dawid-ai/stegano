# Architecture: Encrypted Invisible Unicode Text (v1.1)

**Domain:** Password-based encryption integrated into Chrome extension Unicode steganography
**Researched:** 2026-03-04
**Confidence:** HIGH -- Web Crypto API is well-documented, existing codebase fully analyzed

## Executive Summary

The encryption feature adds a `crypto.ts` module between the user's plaintext and the existing `codec.ts` encoder. The flow is: plaintext -> optional compress -> encrypt (AES-256-GCM via Web Crypto API) -> base64 encode binary to ASCII -> prepend marker -> Tags block encode. Detection works by recognizing a short marker prefix in decoded Tags block text, then routing to decryption instead of plain display. The architecture preserves full backward compatibility -- existing unencrypted content continues to work unchanged.

## System Architecture

### Data Flow: Encrypt-then-Encode

```
ENCRYPT PATH (popup encode with password):

  User plaintext ("Hello secret")
       |
       v
  crypto.ts: encrypt(plaintext, password)
       |  1. Encode plaintext to UTF-8 bytes
       |  2. Try deflate-raw compression (CompressionStream API)
       |  3. Pick smaller of compressed/uncompressed
       |  4. Set compression flag in version byte
       |  5. PBKDF2 key derivation (210k iterations, SHA-256, random 16-byte salt)
       |  6. AES-256-GCM encrypt (random 12-byte IV, 96-bit tag)
       |  7. Pack: version(1) + salt(16) + iv(12) + ciphertext+tag
       |  8. Base64 encode -> ASCII string
       v
  markers.ts: wrapEncrypted(base64string)
       |  Prepend marker prefix: "ENC1:" + base64
       v
  codec.ts: encode(markedString)  [existing, unchanged]
       |  ASCII -> Tags block Unicode
       v
  Invisible Unicode output (ready to paste)
```

```
DECRYPT PATH (scanner detects, user provides password):

  Invisible Unicode in page text
       |
       v
  scanner.ts: findInvisibleChars()  [existing, unchanged]
       |  Merges Tags block runs
       |  decodeTagsRun() -> ASCII string
       v
  markers.ts: detectEncrypted(decodedText)
       |  Checks prefix: starts with "ENC1:" ?
       |  YES -> { encrypted: true, payload: base64, version: 1 }
       |  NO  -> { encrypted: false, plaintext: decodedText }
       v
  [If encrypted] crypto.ts: decrypt(base64payload, password)
       |  1. Base64 decode -> binary
       |  2. Extract: version(1) + salt(16) + iv(12) + ciphertext+tag
       |  3. Read compression flag from version byte
       |  4. PBKDF2 derive key from password + salt
       |  5. AES-256-GCM decrypt (validates auth tag)
       |  6. If compressed: decompress with DecompressionStream
       |  7. Decode UTF-8 -> string
       v
  Original plaintext ("Hello secret")
```

### Data Flow: Popup Decrypt (paste encrypted invisible text)

```
  User pastes invisible text into Decode textarea
       |
       v
  codec.ts: decode(input)  [existing, unchanged]
       |  Tags block -> ASCII
       v
  markers.ts: detectEncrypted(decoded)
       |  "ENC1:..." detected
       v
  UI shows password prompt (inline in popup)
       |  User enters password
       v
  crypto.ts: decrypt(payload, password)
       |  Success -> show plaintext
       |  Failure -> "Wrong password or corrupted data"
       v
  Decrypted plaintext displayed
```

## Wire Format

Binary layout before Base64 encoding:

```
[version:1][salt:16][iv:12][ciphertext+tag:N+12]
```

Total: 41 + N bytes, where N = length of (possibly compressed) plaintext.

### Version Byte

```
Bit 7-4: Algorithm ID (0x0 = AES-256-GCM + PBKDF2-SHA256)
Bit 3:   Compression flag (0 = none, 1 = deflate-raw)
Bit 2-0: Reserved (set to 0)
```

This supports 16 algorithm variants and leaves room for future flags. The decoder reads bits 7-4 to select the algorithm and bit 3 to determine whether to decompress after decryption.

### After Base64 + Marker

The full encoded payload as ASCII (before Tags block encoding):

```
ENC1:<base64 of version+salt+iv+ciphertext+tag>
```

Total Tags block characters: 5 (marker) + ceil((41 + N) * 4/3) (Base64).

## New Modules

### 1. `utils/crypto.ts` -- Encryption Core

**Responsibility:** Pure encrypt/decrypt functions using Web Crypto API. No DOM, no storage, no extension APIs.

**Public API:**

```typescript
/** Encrypt plaintext with a password. Returns base64 payload string. */
export async function encrypt(plaintext: string, password: string): Promise<string>;

/** Decrypt a base64 payload with a password. Throws on wrong password. */
export async function decrypt(payload: string, password: string): Promise<string>;

/** Estimate output character count for a given plaintext length. */
export function estimateEncryptedSize(plaintextLength: number): {
  withoutCompression: number;   // Tags block chars
  estimatedWithCompression: number; // Tags block chars (estimated)
  overhead: number;             // fixed overhead in Tags block chars
};
```

**Implementation constants:**

```typescript
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;        // bits
const IV_LENGTH = 12;          // bytes
const SALT_LENGTH = 16;        // bytes
const TAG_LENGTH = 96;         // bits (12 bytes) -- NIST-recommended minimum
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = 'SHA-256';
const CURRENT_VERSION = 0x00;  // Algorithm 0, no compression, reserved 0
const COMPRESSION_FLAG = 0x08; // Bit 3
```

**Error handling:**
- Wrong password: AES-GCM throws `DOMException` with name `OperationError` when auth tag fails. Catch this and throw a user-friendly `DecryptionError`.
- Corrupted data: Base64 decode failure or unexpected payload length. Throw `DecryptionError` with descriptive message.
- Both error types must be distinguishable in the UI to help users understand what went wrong.

### 2. `utils/markers.ts` -- Encrypted Content Markers

**Responsibility:** Wrap and detect encrypted payloads within decoded Tags block text.

**Public API:**

```typescript
type MarkerResult =
  | { encrypted: true; payload: string; version: number }
  | { encrypted: false; plaintext: string };

export const ENCRYPTED_PREFIX = 'ENC1:';

export function wrapEncrypted(base64payload: string): string;
export function detectEncrypted(decodedText: string): MarkerResult;
export function markerOverhead(): number;  // returns 5
```

**Design decisions:**
- Marker is `ENC1:` (5 ASCII chars) -- short, versioned, unambiguous
- Marker is placed INSIDE the Tags block encoding (itself invisible)
- Version number `1` allows future format changes without breaking old payloads
- Detection is simple `startsWith()` -- no regex needed

### 3. `utils/compression.ts` -- Compression Wrapper

**Responsibility:** Thin wrapper around CompressionStream/DecompressionStream APIs for deflate-raw.

**Public API:**

```typescript
/** Compress bytes using deflate-raw. Returns compressed bytes. */
export async function compress(data: Uint8Array): Promise<Uint8Array>;

/** Decompress deflate-raw compressed bytes. */
export async function decompress(data: Uint8Array): Promise<Uint8Array>;

/** Try compression; return the smaller of compressed/uncompressed. */
export async function maybeCompress(data: Uint8Array): Promise<{
  data: Uint8Array;
  compressed: boolean;
}>;
```

**Why a separate module:** Keeps compression concerns isolated. The encrypt function calls `maybeCompress()` and sets the version byte flag accordingly. If CompressionStream is unavailable (unlikely but possible), graceful fallback to no compression.

### 4. `utils/passwords.ts` -- Password Manager Storage

**Responsibility:** CRUD operations for saved passwords.

**Public API:**

```typescript
interface SavedPassword {
  id: string;          // crypto.randomUUID()
  name: string;        // user-assigned label
  password: string;    // the actual password
  createdAt: number;   // Date.now() timestamp
}

export const savedPasswords: WxtStorageItem<SavedPassword[]>;
export async function addPassword(name: string, password: string): Promise<string>;  // returns id
export async function updatePassword(id: string, updates: Partial<Pick<SavedPassword, 'name' | 'password'>>): Promise<void>;
export async function deletePassword(id: string): Promise<void>;
export async function getPasswords(): Promise<SavedPassword[]>;
```

**Storage:** `chrome.storage.local` (NOT sync). Passwords should not sync to Google's servers. The 10MB local quota is more than sufficient.

## Modified Modules

### `utils/scanner.ts` -- Extended ScanFinding Type

The `ScanFinding` interface gets a new optional field:

```typescript
export interface ScanFinding {
  // ... existing fields ...
  /** Set when decoded Tags block text starts with ENC1: marker */
  encrypted?: boolean;
}
```

The `findInvisibleChars()` function itself does NOT change. Encrypted detection happens in the content script AFTER `decodeTagsRun()` returns the ASCII text. The scanner remains a pure detection layer.

### `entrypoints/content.ts` -- Encrypted Highlight Handling

Changes:
1. After `decodeTagsRun()`, call `detectEncrypted()` on the decoded text
2. If encrypted: set `finding.encrypted = true`, change replacement label to `[Encrypted]`
3. Use distinct highlight color for encrypted findings (configurable, default purple `#7C4DFF`)
4. Click handler on encrypted highlights triggers password prompt
5. Inline decryption: password input overlay near span -> decrypt -> update span

### `entrypoints/popup/App.tsx` -- Encrypt/Decrypt UI

Changes:
1. **Encode section:** Optional password field + "Encrypt" toggle. When enabled:
   - Password field appears
   - Flow changes to encrypt-then-encode
   - Character count shows encrypted vs unencrypted comparison
2. **Decode section:** After `decode()`, check `detectEncrypted()`:
   - If encrypted: show password input and "Decrypt" button
   - Wrong password: friendly error message
3. **Password dropdown:** If saved passwords exist, show selector

### `utils/storage.ts` -- New Storage Items

```typescript
export const encryptedColorSetting = storage.defineItem<string>(
  'sync:encryptedColor',
  { fallback: '#7C4DFF' },
);

export const savedPasswordsSetting = storage.defineItem<SavedPassword[]>(
  'local:savedPasswords',
  { fallback: [] },
);
```

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `utils/crypto.ts` (NEW) | Pure encrypt/decrypt, key derivation, size estimation | Nothing -- pure async functions |
| `utils/compression.ts` (NEW) | Compress/decompress via CompressionStream | Nothing -- pure async functions |
| `utils/markers.ts` (NEW) | Marker wrapping/detection for encrypted payloads | Nothing -- pure functions |
| `utils/passwords.ts` (NEW) | Password CRUD, storage access | `utils/storage.ts` patterns |
| `utils/codec.ts` (UNCHANGED) | ASCII to Tags block encoding/decoding | Stays the same |
| `utils/scanner.ts` (MINOR) | Detection regex, finding merging | `ScanFinding` type gains `encrypted?` field |
| `entrypoints/content.ts` (MODIFIED) | Encrypted detection during scan, click-to-decrypt UI | Imports `markers.ts`, `crypto.ts`, `compression.ts` |
| `entrypoints/popup/App.tsx` (MODIFIED) | Encrypt/decrypt UI in encode/decode sections | Imports `crypto.ts`, `markers.ts`, `passwords.ts` |
| `entrypoints/settings/` (MODIFIED) | Password manager UI, snippet-password linking | Imports `passwords.ts` |

## Anti-Patterns to Avoid

### Anti-Pattern 1: Encrypting after Tags block encoding
**What:** Encrypt the invisible Unicode output instead of the plaintext.
**Why bad:** Tags block characters are 4 bytes each in UTF-8. Encrypting the expanded form massively inflates output. Encrypt the compact plaintext first, then encode to Tags block.

### Anti-Pattern 2: Visible markers for encrypted content
**What:** Prepending `[ENCRYPTED]` as visible text before the invisible content.
**Why bad:** Defeats the purpose of steganography. Reveals that hidden content exists.

### Anti-Pattern 3: Storing derived encryption keys
**What:** Deriving the AES key once and caching it in chrome.storage.
**Why bad:** Stored keys can be extracted. PBKDF2 should derive from password on every operation.

### Anti-Pattern 4: Using Math.random() for IV/salt
**What:** Using `Math.random()` instead of `crypto.getRandomValues()`.
**Why bad:** Not cryptographically secure. IV reuse with the same key completely breaks AES-GCM. Always use `crypto.getRandomValues()`.

### Anti-Pattern 5: Modifying codec.ts to handle binary
**What:** Extending `encode()` to accept bytes > 127.
**Why bad:** Tags block maps to ASCII (0-127) only. Use Base64 to convert binary to ASCII, then pass to existing encoder.

### Anti-Pattern 6: Synchronous compression
**What:** Using pako for synchronous deflate instead of CompressionStream.
**Why bad:** Adds ~45KB to bundle for something the browser provides natively. CompressionStream is async but so is crypto.subtle -- the entire encrypt pipeline is already async.

## Build Order (Dependency Graph)

```
Phase 1: utils/crypto.ts + utils/compression.ts + utils/markers.ts
  Dependencies: None (Web Crypto API + CompressionStream only)
  Testable: Yes, pure async functions with Vitest
  Delivers: encrypt(), decrypt(), compress(), decompress(), wrapEncrypted(), detectEncrypted()

Phase 2: Popup encrypt/decrypt UI
  Dependencies: crypto.ts, markers.ts, codec.ts (existing)
  Testable: Manual + component tests
  Delivers: Encrypt-then-encode flow, decrypt-on-paste flow, character count

Phase 3: Scanner integration + content script encrypted detection
  Dependencies: markers.ts, scanner.ts type change
  Testable: Unit tests for marker detection, manual for content script
  Delivers: Encrypted findings detected and highlighted in purple

Phase 4: utils/passwords.ts + storage.ts updates
  Dependencies: utils/storage.ts patterns (existing)
  Testable: Yes, with storage mocks
  Delivers: Password CRUD, saved passwords storage

Phase 5: Password manager UI (settings page) + popup dropdown
  Dependencies: passwords.ts from Phase 4
  Testable: Manual + component tests
  Delivers: Password CRUD UI, snippet-password linking, popup password selector

Phase 6: Inline decryption UI (content script)
  Dependencies: crypto.ts, content.ts modifications from Phase 3
  Testable: Manual testing on demo page
  Delivers: Click-to-decrypt with password prompt
```

**Critical path:** Phases 1-2 are the minimum viable encrypted encoding. Phase 3 makes the scanner aware. Phases 4-5 add password management. Phase 6 is the "wow" feature.

```
+------------------+
| Phase 1          |
| crypto/compress/ |
| markers          |
+--------+---------+
         |
   +-----v-----+     +------------+
   | Phase 2   |     | Phase 4    |
   | Popup UI  |     | passwords  |
   +-----+-----+     +------+-----+
         |                  |
   +-----v--------+  +-----v-----+
   | Phase 3      |  | Phase 5   |
   | Scanner integ|  | Settings  |
   +-----+--------+  +-----------+
         |
   +-----v-----+
   | Phase 6   |
   | Inline UI |
   +-----------+
```

## Encryption in All Extension Contexts

The Web Crypto API (`crypto.subtle`) is available in:
- **Popup pages:** Same as regular web pages. Full access.
- **Service workers (background.ts):** Available. Use `crypto.subtle` directly (not `window.crypto.subtle`).
- **Content scripts:** Runs in the ISOLATED world with full Web API access.

CompressionStream API is also available in all these contexts (Chrome 80+).

This means the content script can perform decryption locally without messaging the background or popup. The click-to-decrypt flow is entirely self-contained.

## Sources

- [SubtleCrypto - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) -- HIGH confidence, official
- [AesGcmParams - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams) -- HIGH confidence, official
- [CompressionStream - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/CompressionStream) -- HIGH confidence, official
- [Chrome Developers: Compression Streams API](https://developer.chrome.com/blog/compression-streams-api) -- HIGH confidence, official
- [Chromium Extensions Group: WebCrypto in MV3 service workers](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/VCXF9rZXr5Y) -- MEDIUM confidence
- [NIST SP 800-38D: GCM specification](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf) -- HIGH confidence, standard

---
*Architecture research for: Stegano v1.1 Encrypted Hidden Text*
*Researched: 2026-03-04*
