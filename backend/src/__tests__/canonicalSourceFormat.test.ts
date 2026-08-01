import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalizeMirrorChunk,
} from '../../../shared/memory/canonicalSourceFormat';
import { sha256CanonicalMirrorChunk } from '../memory/canonicalSourceHash';

const vector = {
  contractVersion: 1,
  manifestId: 'postgresql-fixture',
  chunkIndex: 0,
  conversations: [{
    id: 'journal:entry',
    sourceKind: 'journal',
    sourceRecordId: 'entry',
    status: 'settled',
    startedAt: '2026-08-01T00:00:00.000Z',
    settledAt: null,
    timezone: null,
    weekStartsOn: null,
    temporalProvenance: 'legacy_unknown',
    clientSchemaVersion: 1,
    sourceRevision: 1,
    previousAcceptedRevision: null,
    messages: [],
  }],
} as const;

describe('canonical source format', () => {
  it('matches the PostgreSQL golden fixture hash', () => {
    assert.match(canonicalizeMirrorChunk(vector), /^BRJ-MIRROR-SOURCE-V1\n/);
    assert.equal(
      sha256CanonicalMirrorChunk(vector),
      'sha256:3a603e5f9cd9b5c2e3e7a3b38ddf3d5a5cdbc8d06005aa607539e4c06f8ac334',
    );
  });
});
