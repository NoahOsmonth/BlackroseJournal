/**
 * R2 fading — the selection rule that replaced raw token counting.
 *
 * The first test is the R0 ledger's `precision-topical` failure reproduced at
 * unit level: one needle plus templated same-thread near-duplicates, where the
 * old rule picked five distractors and never the needle.
 */
import type { MemoryFileHeader } from '../../../services/memory/memoryFiles';
import {
    memoryCaptureDayMs,
    memoryCapturedAtMs,
    rankMemoryFiles,
} from '../../../services/memory/memoryFade';

const NEEDLE_ID = 'projects/fountain-pens/Project/cataloguing-the-fountain-pens.md';
const DISTRACTOR_TITLES = [
    'stationery thoughts',
    'ink and paper',
    'desk tools',
    'handwriting mood',
    'nib notes',
];

function header(overrides: Partial<MemoryFileHeader> & { id: string }): MemoryFileHeader {
    return {
        relativePath: overrides.id,
        name: 'Untitled',
        description: 'no description',
        type: 'project',
        scope: 'project',
        projectId: 'fountain-pens',
        updatedAt: '2026-09-16T00:00:00.000Z',
        capturedAt: '2026-09-16T00:00:00.000Z',
        ...overrides,
    } as MemoryFileHeader;
}

/** The pre-R2 rule, kept here as the oracle the new ranking must beat. */
function legacySelection(headers: readonly MemoryFileHeader[], query: string): string[] {
    const tokens = query
        .toLowerCase()
        .split(/[\s/_-]+/)
        .map((token) => token.replace(/[^a-z0-9']/g, ''))
        .filter((token) => token.length >= 3);
    return headers
        .map((entry) => {
            const hay = (entry.name + ' ' + entry.description).toLowerCase();
            return { entry, score: tokens.reduce((total, token) => total + (hay.includes(token) ? 1 : 0), 0) };
        })
        .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
        .map((row) => row.entry.id);
}

/** The R0 ledger's thread shape: 1 needle + 15 near-topic distractors. */
function ledgerThreadHeaders(): MemoryFileHeader[] {
    const headers: MemoryFileHeader[] = [
        header({
            id: NEEDLE_ID,
            name: 'Cataloguing the fountain pens',
            description:
                'Notes on cataloguing vintage fountain pens, the flex nib, and my private catalog code for the rarest piece.',
        }),
    ];
    for (let index = 0; index < 15; index += 1) {
        const title = DISTRACTOR_TITLES[index % DISTRACTOR_TITLES.length]!;
        headers.push(header({
            id: 'projects/fountain-pens/Feedback/desk-notes-' + (index + 1) + '.md',
            name: 'Desk notes ' + (index + 1),
            description: 'Fountain pen and ink notes about ' + title + ', stationery, and nibs.',
        }));
    }
    return headers;
}

describe('memoryFade (R2 selection)', () => {
    const query = 'Any notes about pens and ink lately?';

    it('ranks the needle above the templated near-duplicates the old rule preferred', () => {
        const headers = ledgerThreadHeaders();
        const ranked = rankMemoryFiles(headers, query);

        expect(ranked[0]!.header.id).toBe(NEEDLE_ID);

        // Falsifiable: the old rule put the needle outside its top 5 entirely.
        const legacyTop5 = legacySelection(headers, query).slice(0, 5);
        expect(legacyTop5).not.toContain(NEEDLE_ID);
    });

    it('breaks ties deterministically by id, never by a clock read', () => {
        const headers = ['c', 'a', 'b'].map((suffix) => header({
            id: 'projects/thread/Project/note-' + suffix + '.md',
            name: 'Same note',
            description: 'identical description',
        }));
        const first = rankMemoryFiles(headers, 'identical description').map((row) => row.header.id);
        const second = rankMemoryFiles([...headers].reverse(), 'identical description').map((row) => row.header.id);
        expect(first).toEqual(second);
        expect(first).toEqual([
            'projects/thread/Project/note-a.md',
            'projects/thread/Project/note-b.md',
            'projects/thread/Project/note-c.md',
        ]);
    });

    it('fades by capture date, not by the date Dream rewrote', () => {
        const now = Date.parse('2026-09-16T00:00:00.000Z');
        const olderMemory = header({
            id: 'projects/thread/Project/older.md',
            name: 'Thread note',
            description: 'thread note about the kiln',
            capturedAt: '2026-01-05T00:00:00.000Z',
            // Promoted last: a consolidation-date rule would rank this one first.
            updatedAt: '2026-09-15T00:00:00.000Z',
        });
        const newerMemory = header({
            id: 'projects/thread/Project/newer.md',
            name: 'Thread note',
            description: 'thread note about the kiln',
            capturedAt: '2026-09-01T00:00:00.000Z',
            updatedAt: '2026-09-02T00:00:00.000Z',
        });
        const ranked = rankMemoryFiles([olderMemory, newerMemory], 'thread note kiln', now);
        expect(ranked[0]!.header.id).toBe(newerMemory.id);
    });

    it('floors recency to the day so millisecond jitter cannot reorder', () => {
        const sameDay = [
            header({ id: 'projects/t/Project/a.md', capturedAt: '2026-09-16T00:00:00.001Z' }),
            header({ id: 'projects/t/Project/b.md', capturedAt: '2026-09-16T23:59:59.999Z' }),
        ];
        expect(memoryCaptureDayMs(sameDay[0]!)).toBe(memoryCaptureDayMs(sameDay[1]!));

        const nextDay = header({ id: 'projects/t/Project/c.md', capturedAt: '2026-09-17T00:00:00.000Z' });
        expect(memoryCaptureDayMs(nextDay)).toBeGreaterThan(memoryCaptureDayMs(sameDay[0]!));
    });

    it('sorts unparseable timestamps last instead of letting them win', () => {
        const broken = header({ id: 'projects/t/Project/broken.md', capturedAt: 'not-a-date' });
        const healthy = header({ id: 'projects/t/Project/healthy.md', capturedAt: '2000-01-01T00:00:00.000Z' });
        expect(memoryCapturedAtMs(broken)).toBe(0);
        expect(memoryCaptureDayMs(broken)).toBe(0);
        const ranked = rankMemoryFiles([broken, healthy], 'no description');
        expect(ranked[ranked.length - 1]!.header.id).toBe(broken.id);
    });
});
