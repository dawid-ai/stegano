/**
 * Encrypted content markers for the encryption pipeline.
 *
 * Provides prefix-based detection of encrypted payloads within
 * decoded Tags block text. The marker format is ASCII-safe for
 * round-tripping through codec.encode/decode.
 *
 * @module markers
 */

/** Prefix string for encrypted payloads */
export const ENCRYPTED_PREFIX = 'ENC1:';

/** Discriminated union result from detectEncrypted */
export type MarkerResult =
  | { encrypted: true; payload: string; version: number }
  | { encrypted: false; plaintext: string };

/**
 * Wrap a Base64 payload with the encrypted marker prefix.
 */
export function wrapEncrypted(base64payload: string): string {
  return ENCRYPTED_PREFIX + base64payload;
}

/**
 * Detect whether decoded text contains an encrypted payload.
 *
 * Only matches if the text starts exactly with "ENC1:".
 * Returns a discriminated union for type-safe handling.
 */
export function detectEncrypted(decodedText: string): MarkerResult {
  if (decodedText.startsWith(ENCRYPTED_PREFIX)) {
    return {
      encrypted: true,
      payload: decodedText.slice(ENCRYPTED_PREFIX.length),
      version: 1,
    };
  }
  return { encrypted: false, plaintext: decodedText };
}
