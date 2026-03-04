# Phase 8: Popup Encrypt/Decrypt UI - Research

**Researched:** 2026-03-05
**Domain:** Preact popup UI integration with existing crypto pipeline
**Confidence:** HIGH

## Summary

Phase 8 adds encryption UI to the existing popup (`entrypoints/popup/App.tsx`). The crypto pipeline is fully built in Phase 7 -- `encryptToInvisible()` and `decryptFromInvisible()` are the two high-level functions that handle the entire encrypt/decrypt flow including compression, markers, and Tags encoding. The popup already has a working encode/decode UI with clipboard support.

The main work is UI modification: adding password fields, an encrypt toggle, compression toggle, character count comparison display, and auto-detection of encrypted content in the decode section. No new libraries are needed -- this is purely wiring existing crypto functions into existing Preact UI patterns.

**Primary recommendation:** Extend the existing `App.tsx` with encryption-aware state management. Keep the existing encode/decode flow intact and layer encryption on top as an opt-in enhancement (password field presence triggers encryption path).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EUXP-01 | Popup encode section has password field with show/hide toggle and encrypt button | Existing encode section pattern in App.tsx; add password input with type toggle and call `encryptToInvisible()` instead of `encode()` when password present |
| EUXP-02 | Popup decode section auto-detects encrypted content and shows password prompt | `detectEncrypted()` from markers module detects `ENC1:` prefix after `decode()`; show password field conditionally |
| EUXP-03 | Character count display shows encrypted vs unencrypted character counts | Run both `encode(text)` and `encryptToInvisible(text, pw)` and compare `[...result].length` for each |
| EUXP-04 | Compression toggle shows compressed vs uncompressed count comparison | The crypto module's `encrypt()` already calls `maybeCompress()` internally; need to expose a `forceCompress` option or compute counts with/without compression |
| EUXP-05 | Copy encrypted output to clipboard works same as unencrypted | Existing `handleCopy()` and `copyToClipboard()` already handle any string -- no changes needed to copy logic |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | (existing) | UI rendering | Already used for popup |
| preact/hooks | (existing) | State management | Already used (useState, useRef, useCallback, useEffect) |
| utils/crypto.ts | Phase 7 | `encryptToInvisible()`, `decryptFromInvisible()`, `DecryptionError` | Built in Phase 7, tested |
| utils/markers.ts | Phase 7 | `detectEncrypted()` for auto-detection | Built in Phase 7, tested |
| utils/codec.ts | Phase 1 | `encode()`, `decode()` for plain encode path | Existing, unchanged |
| utils/clipboard.ts | Phase 4 | `copyToClipboard()` | Existing, unchanged |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS 4.x | (existing) | Styling | All UI elements |
| wxt/browser | (existing) | Browser APIs | Storage access |

### Alternatives Considered
None -- this phase uses only existing libraries and modules.

## Architecture Patterns

### Existing Popup Structure (No Change)
```
entrypoints/popup/
  App.tsx      # Main component (will be modified)
  index.html   # Entry HTML
  main.tsx     # Preact render mount
  style.css    # Tailwind imports + body sizing
```

### Pattern 1: Encryption as Opt-In Enhancement
**What:** When the user enters a password in the encode section, the encode button calls `encryptToInvisible()` instead of `encode()`. When no password is present, the existing plain `encode()` path is used unchanged.
**When to use:** Always -- this preserves backward compatibility.
**Example:**
```typescript
async function handleEncode() {
  try {
    let result: string;
    if (password) {
      result = await encryptToInvisible(encodeInput, password);
    } else {
      result = encode(encodeInput);
    }
    setEncodeOutput(result);
    // ... existing auto-copy logic
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Encoding failed');
  }
}
```

### Pattern 2: Auto-Detection of Encrypted Content in Decode
**What:** When the user pastes into the decode field, first `decode()` the Tags block text, then call `detectEncrypted()` on the result. If encrypted, show a password prompt instead of the decoded output.
**When to use:** Decode section input handling.
**Example:**
```typescript
function handleDecodeInput(value: string) {
  setDecodeInput(value);
  const decoded = decode(value);
  const detection = detectEncrypted(decoded);
  if (detection.encrypted) {
    setIsEncryptedInput(true);
    setDecodeOutput(''); // Don't show raw ENC1:... payload
  } else {
    setIsEncryptedInput(false);
    setDecodeOutput(decoded);
  }
}
```

### Pattern 3: Character Count Comparison Display
**What:** After encoding with encryption, compute both encrypted and plain character counts and display them side by side.
**When to use:** When encryption is active and output is available.
**Example:**
```typescript
// After encryption:
const encryptedCount = [...encryptedOutput].length;
const plainCount = [...encode(encodeInput)].length;
// Display: "142 chars (72 without encryption)"
```

### Pattern 4: Password Show/Hide Toggle
**What:** Standard password input with a toggle button switching between `type="password"` and `type="text"`.
**When to use:** Both encode and decode password fields.
**Example:**
```typescript
const [showPassword, setShowPassword] = useState(false);
// ...
<div class="relative">
  <input
    type={showPassword ? 'text' : 'password'}
    value={password}
    onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
    placeholder="Password (optional)"
    class="w-full px-3 py-1.5 pr-10 border ..."
  />
  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    class="absolute right-2 top-1/2 -translate-y-1/2 text-xs ..."
  >
    {showPassword ? 'Hide' : 'Show'}
  </button>
</div>
```

### Pattern 5: Compression Toggle
**What:** Checkbox or toggle that controls whether compression is applied. The `encrypt()` function in crypto.ts currently always calls `maybeCompress()` internally. To support toggling, either pass an option to `encrypt()` or compute character counts for both paths.
**When to use:** When encryption is active.

**Implementation consideration:** The `encrypt()` function does compression automatically via `maybeCompress()`. To show compressed vs uncompressed counts, the simplest approach is:
1. Add an optional `compress?: boolean` parameter to `encrypt()` (defaults to `true` to preserve existing behavior)
2. When toggle is off, pass `compress: false` to skip compression
3. Show both counts by computing `encryptToInvisible()` with and without compression

Alternatively, compute the uncompressed-only size estimate without actually running encryption twice (estimate by removing compression flag overhead).

### Anti-Patterns to Avoid
- **Separate encrypted encode button:** Don't add a second "Encrypt" button next to "Encode". Instead, the same encode button changes behavior based on whether a password is entered.
- **Blocking UI during PBKDF2:** PBKDF2 with 210,000 iterations may take 100-500ms. Show a brief loading state, don't let the UI freeze without feedback.
- **Storing passwords in state after use:** Clear password state after decryption completes in the decode section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encryption pipeline | Custom crypto | `encryptToInvisible()` / `decryptFromInvisible()` | Phase 7 built and tested the full pipeline |
| Encrypted content detection | String matching for "ENC1:" | `detectEncrypted()` from markers.ts | Handles edge cases, returns typed result |
| Clipboard operations | Manual clipboard API | `copyToClipboard()` from clipboard.ts | Has fallback for older browsers |
| Tags block encoding | Direct codepoint math | `encode()` / `decode()` from codec.ts | Handles wrapping, sensitivity |

**Key insight:** All crypto, compression, encoding, and detection logic is already built. Phase 8 is purely UI wiring.

## Common Pitfalls

### Pitfall 1: PBKDF2 Latency Blocking UI
**What goes wrong:** Calling `encryptToInvisible()` blocks the UI thread for 100-500ms during key derivation.
**Why it happens:** PBKDF2 at 210,000 iterations is CPU-intensive. Web Crypto API operations are async but the UI may feel unresponsive.
**How to avoid:** Show a loading indicator on the encode button (e.g., "Encrypting..." text) while awaiting the result. Disable the button to prevent double-clicks.
**Warning signs:** Button feels "stuck" when clicked.

### Pitfall 2: Character Count Using .length Instead of Spread
**What goes wrong:** `string.length` for Tags block characters returns double the expected count because each Tags block character is a surrogate pair (2 UTF-16 code units).
**Why it happens:** JavaScript string `.length` counts UTF-16 code units, not codepoints.
**How to avoid:** Always use `[...string].length` to count codepoints, as the existing code already does.
**Warning signs:** Character count shows ~2x expected number.

### Pitfall 3: Decode Auto-Detection Race Condition
**What goes wrong:** User types slowly into decode field, triggering `detectEncrypted()` on partial input that incorrectly shows/hides the password prompt.
**Why it happens:** Tags block text is pasted all at once (not typed character by character), but the UI might re-render on each keystroke.
**How to avoid:** `detectEncrypted()` only triggers on `decode()` output that starts with "ENC1:" -- partial Tags block input won't produce this prefix. This should work naturally. Still, debouncing the detection is wise.
**Warning signs:** Password prompt flickers.

### Pitfall 4: Forgetting to Handle DecryptionError
**What goes wrong:** Wrong password causes unhandled promise rejection instead of user-friendly error.
**Why it happens:** `decryptFromInvisible()` throws `DecryptionError` when password is wrong.
**How to avoid:** Catch `DecryptionError` specifically and show the error message in the decode section.
**Warning signs:** Console errors instead of UI feedback.

### Pitfall 5: Compression Toggle Requiring Crypto Module Changes
**What goes wrong:** The compression toggle needs a way to disable compression, but `encrypt()` always calls `maybeCompress()`.
**Why it happens:** The current API doesn't expose a compression option.
**How to avoid:** Add an optional `options` parameter to `encrypt()` and `encryptToInvisible()` with a `compress` boolean. Default to `true` to preserve existing behavior.
**Warning signs:** Unable to show "with compression" vs "without compression" counts.

## Code Examples

### Existing encode flow (for reference)
```typescript
// Current: plain encode (no encryption)
const result = encode(encodeInput);
setEncodeOutput(result);
```

### New: encrypted encode flow
```typescript
// Source: utils/crypto.ts (Phase 7)
import { encryptToInvisible, decryptFromInvisible, DecryptionError } from '@/utils/crypto';
import { detectEncrypted } from '@/utils/markers';

// Encode with encryption when password is provided
async function handleEncode() {
  try {
    let result: string;
    let plainCount: number | null = null;

    if (password) {
      result = await encryptToInvisible(encodeInput, password);
      // Also compute plain (non-encrypted) count for comparison
      const plainResult = encode(encodeInput);
      plainCount = [...plainResult].length;
    } else {
      result = encode(encodeInput);
    }

    setEncodeOutput(result);
    setPlainCharCount(plainCount);
    setError('');
  } catch (e) {
    setEncodeOutput('');
    setError(e instanceof Error ? e.message : 'Encoding failed');
  }
}
```

### New: decode with encrypted content detection
```typescript
// Decode with auto-detection
function handleDecodeInput(value: string) {
  setDecodeInput(value);
  const decoded = decode(value);
  const detection = detectEncrypted(decoded);

  if (detection.encrypted) {
    setIsEncryptedInput(true);
    setEncryptedPayload(value); // Save for later decryption
    setDecodeOutput('');
  } else {
    setIsEncryptedInput(false);
    setDecodeOutput(decoded);
  }
}

// Decrypt with password
async function handleDecrypt() {
  try {
    const result = await decryptFromInvisible(encryptedPayload, decryptPassword);
    if (result === null) {
      setDecryptError('Not encrypted content');
      return;
    }
    setDecodeOutput(result);
    setDecryptError('');
  } catch (e) {
    if (e instanceof DecryptionError) {
      setDecryptError('Wrong password or corrupted data');
    } else {
      setDecryptError('Decryption failed');
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate encode page | Single popup with encode/decode sections | Phase 4 (v1.0) | UI pattern is established |
| No encryption | Password-optional encryption layer | Phase 7-8 (v1.1) | Encode path now has two modes |

**Key constraint from STATE.md decisions:**
- Wire format is locked: `[version:1][salt:16][iv:12][ciphertext+tag:N+12]`
- AES-256-GCM with PBKDF2-SHA-256 at 210,000 iterations
- Compression via CompressionStream when it reduces size
- `ENC1:` marker prefix for detection

## Open Questions

1. **Compression toggle implementation**
   - What we know: `encrypt()` always calls `maybeCompress()` internally
   - What's unclear: Best way to expose compression toggle -- add parameter to `encrypt()` or handle at UI level
   - Recommendation: Add optional `options: { compress?: boolean }` parameter to both `encrypt()` and `encryptToInvisible()`. Minimal change, backward compatible (default true).

2. **Popup height with encryption fields**
   - What we know: Current popup is `min-height: 480px` and `width: 380px`
   - What's unclear: Whether adding password fields, compression toggle, and count comparison will overflow
   - Recommendation: The password field and toggle are compact (~40px each). May need to increase min-height slightly or allow scroll. Test visually.

3. **Encryption button vs existing encode button**
   - What we know: Requirements say "encrypt button" (EUXP-01) but also "same button" for copy (EUXP-05)
   - What's unclear: Whether to rename the existing "Encode" button to "Encrypt" when password is present, or add a separate button
   - Recommendation: Single button that reads "Encode" when no password, "Encrypt" when password is entered. Simplest UX.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via WxtVitest plugin) |
| Config file | `vitest.config.ts` |
| Quick run command | `pnpm test` |
| Full suite command | `pnpm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EUXP-01 | Password field + encrypt button in encode section | manual-only | N/A (Preact UI, no DOM test setup) | N/A |
| EUXP-02 | Auto-detect encrypted content in decode | unit | `pnpm test -- tests/crypto.test.ts` | Partial (pipeline tests exist, detection logic testable) |
| EUXP-03 | Character count comparison display | manual-only | N/A (UI display logic) | N/A |
| EUXP-04 | Compression toggle updates counts | unit | `pnpm test -- tests/crypto.test.ts` | Needs new test if encrypt() gets compress option |
| EUXP-05 | Copy encrypted output to clipboard | manual-only | N/A (clipboard requires browser) | N/A |

### Sampling Rate
- **Per task commit:** `pnpm test`
- **Per wave merge:** `pnpm test && pnpm compile`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] If `encrypt()` gets a `compress` option parameter, add tests for `encrypt(text, pw, { compress: false })` behavior
- [ ] No Preact component tests exist (popup UI is manually tested) -- this is consistent with all previous phases

## Sources

### Primary (HIGH confidence)
- **Codebase inspection** - Read all source files: `entrypoints/popup/App.tsx`, `utils/crypto.ts`, `utils/markers.ts`, `utils/codec.ts`, `utils/compression.ts`, `utils/clipboard.ts`, `utils/storage.ts`, `utils/types.ts`
- **Existing tests** - `tests/crypto.test.ts` confirms pipeline API and behavior
- **STATE.md** - Locked decisions on wire format, PBKDF2 iterations, compression strategy

### Secondary (MEDIUM confidence)
- **ROADMAP.md** - Phase 8 requirements and success criteria

### Tertiary (LOW confidence)
- None -- all findings derived from codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Extending existing working popup UI pattern
- Pitfalls: HIGH - Identified from reading actual implementation code

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no external dependency changes expected)
