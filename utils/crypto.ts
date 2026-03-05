/**
 * Core encryption module for the Stegano extension.
 *
 * Provides AES-256-GCM encryption with PBKDF2 key derivation,
 * plus high-level pipeline functions that integrate compression,
 * markers, and codec for end-to-end invisible text encryption.
 *
 * Wire format: [version:1][salt:16][iv:12][ciphertext+tag:N+12]
 * All encoded as Base64 for transport.
 *
 * @module crypto
 */

import { maybeCompress, decompress, COMPRESSION_FLAG } from './compression';
import { wrapEncrypted, detectEncrypted } from './markers';
import { encode, decode } from './codec';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 96; // bits
const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_HASH = 'SHA-256';
const CURRENT_VERSION = 0x00;

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/**
 * Error thrown when decryption fails (wrong password, corrupted data, etc.)
 */
export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Derive an AES-256-GCM key from a password and salt using PBKDF2.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Convert Uint8Array to Base64 string.
 * Uses chunked approach to avoid call stack overflow on large arrays.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array.
 */
function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------------------
// Core encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext with a password using AES-256-GCM.
 *
 * @param plaintext - The text to encrypt
 * @param password - The password for key derivation
 * @returns Base64-encoded wire format string
 */
export async function encrypt(
  plaintext: string,
  password: string,
  options?: { compress?: boolean }
): Promise<string> {
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Optionally compress (skip when explicitly disabled)
  let payloadBytes: Uint8Array;
  let compressed: boolean;
  if (options?.compress === false) {
    payloadBytes = plaintextBytes;
    compressed = false;
  } else {
    const result = await maybeCompress(plaintextBytes);
    payloadBytes = result.data;
    compressed = result.compressed;
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key
  const key = await deriveKey(password, salt);

  // Encrypt with AES-GCM
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
    key,
    payloadBytes as BufferSource
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // Build wire format: [version:1][salt:16][iv:12][ciphertext+tag]
  const version = compressed ? CURRENT_VERSION | COMPRESSION_FLAG : CURRENT_VERSION;
  const wireLength = 1 + SALT_LENGTH + IV_LENGTH + ciphertext.length;
  const wire = new Uint8Array(wireLength);
  wire[0] = version;
  wire.set(salt, 1);
  wire.set(iv, 1 + SALT_LENGTH);
  wire.set(ciphertext, 1 + SALT_LENGTH + IV_LENGTH);

  return uint8ToBase64(wire);
}

/**
 * Decrypt a Base64-encoded wire format payload with a password.
 *
 * @param payload - Base64-encoded wire format string
 * @param password - The password for key derivation
 * @returns The original plaintext
 * @throws {DecryptionError} If password is wrong, data is corrupted, or format is invalid
 */
export async function decrypt(
  payload: string,
  password: string
): Promise<string> {
  if (!payload) {
    throw new DecryptionError('wrong password or corrupted data');
  }

  let wire: Uint8Array;
  try {
    wire = base64ToUint8(payload);
  } catch {
    throw new DecryptionError('wrong password or corrupted data');
  }

  // Minimum wire length: version(1) + salt(16) + iv(12) + tag(12) + ciphertext(>=1)
  const MIN_LENGTH = 1 + SALT_LENGTH + IV_LENGTH + (TAG_LENGTH / 8) + 1;
  if (wire.length < MIN_LENGTH) {
    throw new DecryptionError('wrong password or corrupted data');
  }

  // Unpack wire format
  const version = wire[0];
  const compressed = (version & COMPRESSION_FLAG) !== 0;
  const salt = wire.slice(1, 1 + SALT_LENGTH);
  const iv = wire.slice(1 + SALT_LENGTH, 1 + SALT_LENGTH + IV_LENGTH);
  const ciphertext = wire.slice(1 + SALT_LENGTH + IV_LENGTH);

  // Derive key
  const key = await deriveKey(password, salt);

  // Decrypt
  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv, tagLength: TAG_LENGTH },
      key,
      ciphertext
    );
  } catch {
    throw new DecryptionError('wrong password or corrupted data');
  }

  let resultBytes: Uint8Array<ArrayBuffer> = new Uint8Array(decryptedBuffer);

  // Decompress if needed
  if (compressed) {
    resultBytes = await decompress(resultBytes) as Uint8Array<ArrayBuffer>;
  }

  return new TextDecoder().decode(resultBytes);
}

// ---------------------------------------------------------------------------
// High-level pipeline functions
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext and encode as invisible Tags block Unicode.
 *
 * Pipeline: plaintext -> encrypt -> Base64 -> marker wrap -> Tags encode
 */
export async function encryptToInvisible(
  plaintext: string,
  password: string,
  options?: { compress?: boolean }
): Promise<string> {
  const base64 = await encrypt(plaintext, password, options);
  const marked = wrapEncrypted(base64);
  return encode(marked);
}

/**
 * Decode invisible Tags block text and decrypt if it contains encrypted content.
 *
 * Pipeline: Tags decode -> marker detect -> decrypt -> plaintext
 *
 * @returns The decrypted plaintext, or null if the text is not encrypted
 */
export async function decryptFromInvisible(
  invisible: string,
  password: string
): Promise<string | null> {
  const decoded = decode(invisible);
  const detection = detectEncrypted(decoded);

  if (!detection.encrypted) {
    return null;
  }

  return decrypt(detection.payload, password);
}
