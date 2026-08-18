import { createHash } from 'node:crypto';
import { canonicalMirrorChunkBytes } from '../../../../shared/memory/canonicalSourceFormat';
import type { MirrorChunk } from '../../../../shared/memory/mirrorContracts';

/**
 * Node-side SHA-256 for exact byte strings. Client-supplied chunk hashes are
 * never trusted; the backend recomputes the canonical payload in Node.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Fingerprint of the selected gateway credential, derived in backend memory
 * from those exact credential bytes. Never read from an asserted config value.
 */
export function credentialFingerprint(credential: string): string {
  return `sha256:${sha256Hex(credential)}`;
}

/**
 * Recomputes the canonical SHA-256 of a validated mirror chunk payload. The
 * input is parsed (and therefore validated) before hashing, so a client cannot
 * steer the hash with malformed input.
 */
export function recomputeChunkHash(chunk: MirrorChunk | unknown): string {
  const bytes = canonicalMirrorChunkBytes(chunk);
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
