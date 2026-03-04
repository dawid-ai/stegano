/**
 * Compression utilities for the encryption pipeline.
 *
 * Uses the browser's built-in CompressionStream/DecompressionStream API
 * with deflate-raw format. No external dependencies.
 *
 * @module compression
 */

/** Bit flag for compression in the wire format version byte */
export const COMPRESSION_FLAG = 0x08;

/**
 * Collect all chunks from a ReadableStream into a single Uint8Array.
 */
async function collectStream(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Compress data using deflate-raw.
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  return collectStream(cs.readable);
}

/**
 * Decompress deflate-raw compressed data.
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  return collectStream(ds.readable);
}

/**
 * Compress data only if compression reduces size.
 *
 * @returns The smaller of compressed/uncompressed data, with a flag indicating which.
 */
export async function maybeCompress(
  data: Uint8Array
): Promise<{ data: Uint8Array; compressed: boolean }> {
  const compressed = await compress(data);
  if (compressed.length < data.length) {
    return { data: compressed, compressed: true };
  }
  return { data, compressed: false };
}
