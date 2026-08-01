import type { Message } from '@/services/ai/ai';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import {
    buildMemorySourceInventory,
    MemorySourceInventoryError,
} from '@/services/memory/cloud/sourceInventory';
import {
    conversationSourceId,
    messageClientEventId,
} from '@/shared/memory/sourceIds';

function message(
    id: string,
    content: string,
    timestamp: number,
    role: Message['role'] = 'user',
): Message {
    return { id, content, timestamp, role };
}

function entry(
    overrides: Partial<JournalEntry> & Pick<JournalEntry, 'id'>,
): JournalEntry {
    return {
        id: overrides.id,
        title: 'Journal',
        emoji: '🌹',
        messages: [],
        status: 'completed',
        createdAt: Date.parse('2026-07-01T00:00:00.000Z'),
        updatedAt: Date.parse('2026-07-01T01:00:00.000Z'),
        ...overrides,
    };
}

function checkIn(
    overrides: Partial<IntentionCheckIn> & Pick<IntentionCheckIn, 'id'>,
): IntentionCheckIn {
    return {
        id: overrides.id,
        type: 'evening',
        title: 'Evening',
        summary: '',
        status: 'completed',
        createdAt: Date.parse('2026-07-01T00:00:00.000Z'),
        updatedAt: Date.parse('2026-07-01T01:00:00.000Z'),
        ...overrides,
    };
}

const generatedAt = new Date('2026-07-28T12:34:56.789Z');

describe('buildMemorySourceInventory', () => {
    it('maps only settled legacy sources with honest temporal provenance', () => {
        const entries = [
            entry({
                id: 'journal-b',
                sourceRevision: 4,
                createdAt: Date.parse('2026-07-03T02:00:00-04:00'),
                messages: [
                    message(
                        'same-raw-id',
                        'second exact text',
                        Date.parse('2026-07-03T02:05:00-04:00'),
                        'assistant',
                    ),
                ],
            }),
            entry({
                id: 'journal-a',
                sourceRevision: 2,
                createdAt: Date.parse('2026-07-02T18:00:00+08:00'),
                messages: [
                    message(
                        'same-raw-id',
                        'first exact text',
                        Date.parse('2026-07-02T18:01:02.345+08:00'),
                    ),
                ],
            }),
            entry({
                id: 'draft-journal',
                status: 'draft',
                messages: [
                    message('draft-message', 'must stay out', generatedAt.getTime()),
                ],
            }),
        ] satisfies JournalEntry[];
        const checkIns = [
            checkIn({
                id: 'check-in-a',
                createdAt: Date.parse('2026-07-04T07:00:00Z'),
                messages: [
                    message(
                        'same-raw-id',
                        'check-in exact text',
                        Date.parse('2026-07-04T07:05:00Z'),
                    ),
                ],
            }),
            checkIn({
                id: 'draft-check-in',
                status: 'draft',
                messages: [
                    message('draft-message', 'must also stay out', generatedAt.getTime()),
                ],
            }),
        ] satisfies IntentionCheckIn[];

        const inventory = buildMemorySourceInventory({
            entries,
            checkIns,
            generatedAt,
        });

        expect(inventory).toMatchObject({
            contractVersion: 1,
            generatedAt: '2026-07-28T12:34:56.789Z',
            conversationCount: 3,
            messageCount: 3,
            oldestAuthoredAt: '2026-07-02T10:01:02.345Z',
            newestAuthoredAt: '2026-07-04T07:05:00.000Z',
        });
        expect(inventory.conversations.map((conversation) => conversation.id))
            .toEqual([
                conversationSourceId('journal', 'journal-a'),
                conversationSourceId('journal', 'journal-b'),
                conversationSourceId('intention_checkin', 'check-in-a'),
            ]);
        expect(inventory.conversations[0]).toMatchObject({
            status: 'settled',
            startedAt: '2026-07-02T10:00:00.000Z',
            settledAt: null,
            timezone: null,
            weekStartsOn: null,
            temporalProvenance: 'legacy_unknown',
            clientSchemaVersion: 1,
            sourceRevision: 2,
        });
        expect(inventory.messages[0]).toMatchObject({
            authoredAt: '2026-07-02T10:01:02.345Z',
            authoredTimezone: null,
            localDate: null,
            temporalProvenance: 'legacy_unknown',
            revision: 1,
            status: 'active',
            sequence: 0,
        });
        expect(new Set(inventory.messages.map((item) => item.id)).size)
            .toBe(inventory.messageCount);
        expect(inventory.messages.map((item) => item.content)).toEqual([
            'first exact text',
            'second exact text',
            'check-in exact text',
        ]);
        for (const item of inventory.messages) {
            expect(item.id).toBe(item.clientEventId);
            expect(item.id).toBe(messageClientEventId(
                item.conversationId,
                'same-raw-id',
            ));
        }
        expect(JSON.stringify(inventory)).not.toMatch(
            /draft-journal|draft-check-in|must stay out|must also stay out/,
        );
    });

    it('is deterministic and never mutates its input', () => {
        const entries = [entry({
            id: 'stable',
            messages: [
                message('two', 'two', Date.parse('2026-07-01T00:00:02Z')),
                message('one', 'one', Date.parse('2026-07-01T00:00:01Z')),
            ],
        })];
        const checkIns = [checkIn({ id: 'empty', messages: undefined })];
        const before = JSON.stringify({ entries, checkIns });

        const first = buildMemorySourceInventory({ entries, checkIns, generatedAt });
        const second = buildMemorySourceInventory({ entries, checkIns, generatedAt });

        expect(first).toEqual(second);
        expect(JSON.stringify({ entries, checkIns })).toBe(before);
        expect(first.messages.map((item) => item.sequence)).toEqual([0, 1]);
        expect(first.messages.map((item) => item.content)).toEqual(['two', 'one']);
    });

    it('retains captured message time and supplied positive revisions without reordering turns', () => {
        const inventory = buildMemorySourceInventory({
            entries: [entry({
                id: 'captured',
                sourceRevision: 3,
                messages: [{
                    id: 'later-id',
                    role: 'assistant',
                    content: 'first in array',
                    timestamp: Date.parse('2026-07-01T00:00:05.000Z'),
                    authoredTimezone: 'Asia/Manila',
                    localDate: '2026-07-01',
                    temporalProvenance: 'captured',
                    revision: 4,
                }, {
                    id: 'earlier-id',
                    role: 'user',
                    content: 'second in array',
                    timestamp: Date.parse('2026-07-01T00:00:01.000Z'),
                    authoredTimezone: 'Asia/Manila',
                    localDate: '2026-07-01',
                    temporalProvenance: 'captured',
                    revision: 2,
                }],
            })],
            checkIns: [],
            generatedAt,
        });

        expect(inventory.conversations[0].sourceRevision).toBe(3);
        expect(inventory.messages.map((item) => item.content)).toEqual([
            'first in array',
            'second in array',
        ]);
        expect(inventory.messages.map((item) => item.revision)).toEqual([4, 2]);
        expect(inventory.messages[0]).toMatchObject({
            authoredTimezone: 'Asia/Manila',
            localDate: '2026-07-01',
            temporalProvenance: 'captured',
        });
    });

    it('keeps completed message-less check-ins and handles an empty inventory', () => {
        const withEmptyCheckIn = buildMemorySourceInventory({
            entries: [],
            checkIns: [checkIn({ id: 'empty', messages: undefined })],
            generatedAt,
        });
        expect(withEmptyCheckIn.conversationCount).toBe(1);
        expect(withEmptyCheckIn.messageCount).toBe(0);
        expect(withEmptyCheckIn.oldestAuthoredAt).toBeNull();
        expect(withEmptyCheckIn.newestAuthoredAt).toBeNull();

        expect(buildMemorySourceInventory({
            entries: [],
            checkIns: [],
            generatedAt,
        })).toMatchObject({
            conversationCount: 0,
            messageCount: 0,
            oldestAuthoredAt: null,
            newestAuthoredAt: null,
            conversations: [],
            messages: [],
        });
    });

    it.each([
        {
            input: {
                entries: [entry({ id: 'bad-created', createdAt: Number.NaN })],
                checkIns: [],
                generatedAt,
            },
            code: 'INVALID_TIMESTAMP',
        },
        {
            input: {
                entries: [entry({
                    id: 'bad-message',
                    messages: [message('bad', 'content', Number.POSITIVE_INFINITY)],
                })],
                checkIns: [],
                generatedAt,
            },
            code: 'INVALID_TIMESTAMP',
        },
        {
            input: {
                entries: [],
                checkIns: [],
                generatedAt: new Date(Number.NaN),
            },
            code: 'INVALID_TIMESTAMP',
        },
    ])('rejects invalid timestamps without source content', ({ input, code }) => {
        expect(() => buildMemorySourceInventory(input)).toThrow(
            expect.objectContaining({ code }),
        );
        try {
            buildMemorySourceInventory(input);
        } catch (error) {
            expect(error).toBeInstanceOf(MemorySourceInventoryError);
            expect(String(error)).not.toContain('content');
        }
    });

    it.each([
        entry({ id: 'zero-source-revision', sourceRevision: 0 }),
        entry({
            id: 'zero-message-revision',
            messages: [{ id: 'm', role: 'user', content: 'redacted', timestamp: 1, revision: 0 }],
        }),
    ])('rejects non-positive revisions without source content', (invalidEntry) => {
        expect(() => buildMemorySourceInventory({
            entries: [invalidEntry],
            checkIns: [],
            generatedAt,
        })).toThrow(expect.objectContaining({ code: 'INVALID_REVISION' }));
    });

    it.each([
        {
            entries: [entry({ id: '' })],
            checkIns: [],
            code: 'INVALID_ID',
        },
        {
            entries: [entry({
                id: 'duplicate-message',
                messages: [
                    message('same', 'one', generatedAt.getTime()),
                    message('same', 'two', generatedAt.getTime() + 1),
                ],
            })],
            checkIns: [],
            code: 'DUPLICATE_CANONICAL_ID',
        },
        {
            entries: [entry({ id: 'same-source' }), entry({ id: 'same-source' })],
            checkIns: [],
            code: 'DUPLICATE_CANONICAL_ID',
        },
    ])('rejects invalid or duplicate canonical IDs', (fixture) => {
        expect(() => buildMemorySourceInventory({
            entries: fixture.entries,
            checkIns: fixture.checkIns,
            generatedAt,
        })).toThrow(expect.objectContaining({ code: fixture.code }));
    });
});
