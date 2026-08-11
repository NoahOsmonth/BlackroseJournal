import {
    canonicalMirrorChunkBytes,
    canonicalizeMirrorChunk,
} from '@/shared/memory/canonicalSourceFormat';

const chunk = {
    contractVersion: 1,
    manifestId: 'manifest-unicode',
    chunkIndex: 3,
    conversations: [{
        id: 'journal:entry-1',
        sourceKind: 'journal',
        sourceRecordId: 'entry-1',
        status: 'settled',
        startedAt: '2026-08-01T01:00:00.000Z',
        settledAt: null,
        timezone: null,
        weekStartsOn: null,
        temporalProvenance: 'legacy_unknown',
        clientSchemaVersion: 1,
        sourceRevision: 2,
        previousAcceptedRevision: 1,
        messages: [{
            id: 'journal%3Aentry-1:m1',
            conversationId: 'journal:entry-1',
            clientEventId: 'journal%3Aentry-1:m1',
            role: 'assistant',
            sequence: 0,
            authoredAt: '2026-08-01T01:02:03.004Z',
            authoredTimezone: 'Asia/Manila',
            localDate: '2026-08-01',
            temporalProvenance: 'captured',
            content: 'Cafe\u0301\r\n\u96ea\n\r',
            revision: 7,
            previousAcceptedRevision: 6,
            status: 'edited',
        }, {
            id: 'journal%3Aentry-1:m2',
            conversationId: 'journal:entry-1',
            clientEventId: 'journal%3Aentry-1:m2',
            role: 'user',
            sequence: 1,
            authoredAt: '2026-08-01T01:02:03.005Z',
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
            content: '',
            revision: 1,
            previousAcceptedRevision: null,
            status: 'active',
        }],
    }],
} as const;

describe('canonical mirror source format', () => {
    it('preserves UTF-8, combining marks, empty strings, nulls, and exact line endings', () => {
        const canonical = canonicalizeMirrorChunk(chunk);

        expect(canonical).toContain('Cafe\u0301\r\n\u96ea\n\r');
        expect(canonical).not.toContain('Caf\u00e9');
        expect(canonical).toContain('N\n');
        expect(canonical).toContain('S0:\n');
        expect(canonicalMirrorChunkBytes(chunk)).toEqual(new TextEncoder().encode(canonical));
    });

    it('uses supplied order rather than authored time in its canonical bytes', () => {
        const outOfTimeOrder = {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: [
                    { ...chunk.conversations[0].messages[0], authoredAt: '2026-08-01T01:02:04.000Z' },
                    { ...chunk.conversations[0].messages[1], authoredAt: '2026-08-01T01:02:03.000Z' },
                ],
            }],
        };

        expect(canonicalizeMirrorChunk(outOfTimeOrder)).toContain(
            '2026-08-01T01:02:04.000Z',
        );
        expect(canonicalMirrorChunkBytes(outOfTimeOrder)).toEqual(
            new TextEncoder().encode(canonicalizeMirrorChunk(outOfTimeOrder)),
        );
    });
});
