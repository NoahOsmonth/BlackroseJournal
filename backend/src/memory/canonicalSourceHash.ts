import { createHash } from 'node:crypto';
import { canonicalMirrorChunkBytes } from '../../../shared/memory/canonicalSourceFormat';
import type { MirrorChunk } from '../../../shared/memory/mirrorContracts';

/** Heroku-only hash authority for the platform-neutral shared canonical bytes. */
export function sha256CanonicalMirrorChunk(input: MirrorChunk | unknown): string {
  return `sha256:${createHash('sha256').update(canonicalMirrorChunkBytes(input)).digest('hex')}`;
}
