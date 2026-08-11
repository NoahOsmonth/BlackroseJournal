import {
    MIRROR_CHUNK_LIMITS,
    MirrorContractError,
    nextSourceRevision,
    parseMirrorChunk,
    type MirrorChunk,
    type MirrorMessage,
} from '@/shared/memory/mirrorContracts';

const message = {
    id: 'journal%3Aentry-1:message-1',
    conversationId: 'journal:entry-1',
    clientEventId: 'journal%3Aentry-1:message-1',
    role: 'user',
    sequence: 0,
    authoredAt: '2026-08-01T01:02:03.456Z',
    authoredTimezone: 'Asia/Manila',
    localDate: '2026-08-01',
    temporalProvenance: 'captured',
    content: 'Exact source text',
    revision: 1,
    previousAcceptedRevision: null,
    status: 'active',
} as MirrorMessage;

const chunk: MirrorChunk = {
    contractVersion: 1,
    manifestId: 'manifest-1',
    chunkIndex: 0,
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
        sourceRevision: 1,
        previousAcceptedRevision: null,
        messages: [message],
    }],
};

describe('parseMirrorChunk', () => {
    it('accepts the exact bounded Phase 1 upload shape', () => {
        expect(parseMirrorChunk(chunk)).toEqual(chunk);
        expect(MIRROR_CHUNK_LIMITS).toEqual({
            maxConversations: 16,
            maxMessages: 128,
            maxEncodedJsonBytes: 256 * 1024,
        });
    });

    it.each([
        { ...chunk, unexpected: true },
        { ...chunk, contractVersion: 2 },
        { ...chunk, chunkIndex: -1 },
        { ...chunk, conversations: [] },
        { ...chunk, conversations: Array.from({ length: 17 }, () => chunk.conversations[0]) },
        {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: Array.from({ length: 129 }, () => message),
            }],
        },
    ])('rejects unknown keys and invalid limits without exposing source content', (value) => {
        expect(() => parseMirrorChunk(value)).toThrow(MirrorContractError);
        try {
            parseMirrorChunk(value);
        } catch (error) {
            expect(error).toMatchObject({ code: expect.any(String) });
            expect(String(error)).not.toContain('Exact source text');
        }
    });

    it('rejects unsupported NUL content with a stable redacted error', () => {
        const nulSource = 'do not echo\u0000this';
        const value = {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: [{ ...message, content: nulSource }],
            }],
        };

        expect(() => parseMirrorChunk(value)).toThrow(
            expect.objectContaining({ code: 'UNSUPPORTED_NUL' }),
        );
        try {
            parseMirrorChunk(value);
        } catch (error) {
            expect(String(error)).not.toContain('do not echo');
        }
    });

    it.each([
        {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: [{ ...message, localDate: '2026-02-30' }],
            }],
        },
        {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: [{ ...message, localDate: '2026-07-31' }],
            }],
        },
        {
            ...chunk,
            conversations: [{ ...chunk.conversations[0], id: 'journal:not-entry-1' }],
        },
        {
            ...chunk,
            conversations: [{
                ...chunk.conversations[0],
                messages: [{ ...message, id: 'not-a-client-event', clientEventId: 'not-a-client-event' }],
            }],
        },
    ])('rejects impossible local dates and noncanonical stable IDs without source text', (value) => {
        expect(() => parseMirrorChunk(value)).toThrow(
            expect.objectContaining({ code: 'INVALID_VALUE' }),
        );
        try {
            parseMirrorChunk(value);
        } catch (error) {
            expect(String(error)).not.toContain('Exact source text');
        }
    });

    it('increments revisions only for exact source semantics, not mirror bookkeeping', () => {
        const original = chunk.conversations[0];
        const bookkeepingOnly = {
            ...original,
            previousAcceptedRevision: 1,
            sourceRevision: 2,
            messages: original.messages.map((item) => ({
                ...item,
                revision: 2,
                previousAcceptedRevision: 1,
            })),
        };
        const changedContent = {
            ...bookkeepingOnly,
            messages: [{ ...bookkeepingOnly.messages[0], content: 'Changed exact source text' }],
        };

        expect(nextSourceRevision(original, bookkeepingOnly)).toBe(1);
        expect(nextSourceRevision(original, changedContent)).toBe(2);
    });
});
