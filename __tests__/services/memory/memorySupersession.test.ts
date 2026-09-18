/**
 * R2 supersession — collapsing restated memories via the existing `deprecated`
 * frontmatter.
 *
 * The load-bearing test is the second one: the R0 ledger's 15 near-topic
 * distractors share templated headers AND enough filler vocabulary to reach
 * 0.62 body Jaccard (measured), so a similarity rule would supersede real
 * memories. Supersession must fire on restatement only, and fire zero times on
 * that ledger.
 */
import { runMemoryDream } from '../../../services/memory/memoryDream';
import {
    clearMemoryFiles,
    importMemoryFiles,
    listFormalProjectIds,
    listMemoryHeadersForThread,
    listMemoryFiles,
    listTmpFiles,
    MEMORY_FILE_BODY_PREFIX,
    MEMORY_FILES_MANIFEST_KEY,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../../services/memory/memoryFiles';
import type { MemoryFileImportRecord } from '../../../services/memory/memoryFiles';
import {
    SUPERSEDE_MIN_BODY_TOKENS,
    SUPERSEDE_SCAN_LIMIT,
    supersedeRestatedMemories,
    supersedeRestatedMemoriesInThread,
} from '../../../services/memory/memorySupersession';
import { seedRecallLedger } from '../../../probes/shared/recallLedger';
import {
    RESTATEMENT_THREAD_ID,
    seedRestatementScenario,
    stagedThreadId,
} from '../../../probes/shared/restatementScenario';

const BASE_BODY = [
    '## Current Stage',
    'The kiln cooled overnight and I let myself be done with the week instead of starting another batch of cups and bowls.',
    'I am practicing stopping while the shelf is still half full.',
    '',
    '## Notes',
    '- Thread: Kiln',
    '- Written 2026-01-01: First firing',
].join('\n');

const EXTENSION = 'I wrote the glaze notes down so the next firing does not repeat the same guesswork.';
const SECOND_EXTENSION = 'The second shelf came out even, which almost never happens on a first attempt.';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

async function stage(body: string, name: string, capturedAt: string, projectId = 'kiln-notes') {
    return stageTmpMemory({
        type: 'project',
        name,
        description: 'Thread hint kiln-notes. Firing log.',
        body,
        projectId,
        capturedAt,
    });
}

async function liveIds(projectId: string): Promise<string[]> {
    const headers = await listMemoryFiles({ projectId, limit: 50 });
    return headers.map((header) => header.id).sort();
}

describe('memorySupersession (R2)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('supersedes an older memory a newer one restates, keeping the bytes', async () => {
        const older = await stage(BASE_BODY, 'Kiln log one', '2026-01-01T00:00:00.000Z');
        const newer = await stage(BASE_BODY + '\n' + EXTENSION, 'Kiln log two', '2026-03-01T00:00:00.000Z');

        const outcome = await supersedeRestatedMemoriesInThread('kiln-notes');

        expect(outcome.superseded).toBe(1);
        expect(outcome.threads).toEqual(['kiln-notes']);
        expect(await liveIds('kiln-notes')).toEqual([newer.id]);

        // Soft delete: the superseded record still exists, with an audit pointer.
        const withDeprecated = await listMemoryFiles({ projectId: 'kiln-notes', includeDeprecated: true, limit: 50 });
        const superseded = withDeprecated.find((header) => header.id === older.id);
        expect(superseded?.deprecated).toBe(true);
        expect(superseded?.supersededBy).toBe(newer.id);
        expect(superseded?.supersedeReason).toContain('restated');
        expect(typeof superseded?.supersededAt).toBe('string');
    });

    it('never supersedes the near-topic distractors of the R0 ledger', async () => {
        await seedRecallLedger({ staged: true });
        // Dream promotes first; its own supersession pass must stay quiet here.
        const dream = await runMemoryDream({ tryLlm: false });
        expect(dream.superseded).toBe(0);

        // Snapshot what promotion produced, then run the pass again by hand.
        const threads = await listFormalProjectIds();
        const before = new Map<string, string[]>();
        for (const thread of threads) {
            before.set(thread, await liveIds(thread));
        }

        const outcome = await supersedeRestatedMemories();
        expect(outcome.superseded).toBe(0);
        expect(outcome.threads).toEqual([]);

        // Not one live memory was removed: the distractors merely *resemble* each
        // other (0.62 body Jaccard measured), which is not restatement.
        for (const thread of threads) {
            expect(await liveIds(thread)).toEqual(before.get(thread));
        }
        const deprecated = [];
        for (const thread of threads) {
            const all = await listMemoryFiles({ projectId: thread, includeDeprecated: true, limit: 50 });
            deprecated.push(...all.filter((header) => header.deprecated).map((header) => header.id));
        }
        expect(deprecated).toEqual([]);
    });
    it('never supersedes across threads, even with identical bodies', async () => {
        await stage(BASE_BODY, 'Kiln log', '2026-01-01T00:00:00.000Z', 'kiln-notes');
        await stage(BASE_BODY, 'Kiln log', '2026-03-01T00:00:00.000Z', 'other-thread');

        const outcome = await supersedeRestatedMemories();
        expect(outcome.superseded).toBe(0);
        expect(await listFormalProjectIds()).toEqual(['kiln-notes', 'other-thread']);
    });

    it('never supersedes a user file', async () => {
        const timestamp = new Date().toISOString();
        await importMemoryFiles([{
            header: {
                id: 'memory/User/profile.md',
                relativePath: 'memory/User/profile.md',
                name: 'Profile',
                description: 'Name and pronouns',
                type: 'user',
                scope: 'global',
                projectId: 'kiln-notes',
                updatedAt: timestamp,
                capturedAt: '2026-01-01T00:00:00.000Z',
            },
            content: BASE_BODY,
        }]);
        await stage(BASE_BODY + '\n' + EXTENSION, 'Kiln log two', '2026-03-01T00:00:00.000Z');

        const outcome = await supersedeRestatedMemoriesInThread('kiln-notes');
        expect(outcome.superseded).toBe(0);
    });

    it('collapses a restatement chain to its newest member', async () => {
        const oldest = await stage(BASE_BODY, 'Kiln log one', '2026-01-01T00:00:00.000Z');
        const middle = await stage(BASE_BODY + '\n' + EXTENSION, 'Kiln log two', '2026-02-01T00:00:00.000Z');
        const newest = await stage(
            BASE_BODY + '\n' + EXTENSION + '\n' + SECOND_EXTENSION,
            'Kiln log three',
            '2026-03-01T00:00:00.000Z',
        );

        const outcome = await supersedeRestatedMemoriesInThread('kiln-notes');

        expect(outcome.superseded).toBe(2);
        expect(await liveIds('kiln-notes')).toEqual([newest.id]);
        const all = await listMemoryFiles({ projectId: 'kiln-notes', includeDeprecated: true, limit: 50 });
        expect(all.find((h) => h.id === oldest.id)?.supersededBy).toBe(newest.id);
        expect(all.find((h) => h.id === middle.id)?.supersededBy).toBe(newest.id);
    });

    it('leaves bodies too short to judge alone', async () => {
        const shortBody = 'Kiln firing notes.';
        const short = await stage(shortBody, 'Short note', '2026-01-01T00:00:00.000Z');
        await stage(shortBody + ' The glaze came out uneven again.', 'Longer note', '2026-03-01T00:00:00.000Z');

        const outcome = await supersedeRestatedMemoriesInThread('kiln-notes');

        expect(outcome.superseded).toBe(0);
        expect(await liveIds('kiln-notes')).toContain(short.id);
        expect(SUPERSEDE_MIN_BODY_TOKENS).toBeGreaterThan(2);
    });
    it('rides Dream\'s trigger: one promotion pass supersedes the restatement it promoted', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const seeded = await seedRestatementScenario({ staged: true });
            // Nothing is a formal thread yet, so supersession has nothing to see.
            expect(await listFormalProjectIds()).toEqual([]);

            const outcome = await runMemoryDream({ tryLlm: false });

            expect(outcome.promoted).toBe(seeded.files.length);
            expect(outcome.superseded).toBe(1);
            expect(outcome.summary).toContain('superseded 1 restated file(s) in 1 thread(s)');

            // Dream slugifies the thread hint, so the formal thread id differs
            // from the scenario's own project id.
            const all = await listMemoryFiles({
                projectId: stagedThreadId(RESTATEMENT_THREAD_ID),
                includeDeprecated: true,
                limit: 50,
            });
            const live = all.filter((h) => !h.deprecated);
            expect(live).toHaveLength(1);
            // Promotion assigns a fresh id, so the pointer is checked against the
            // file that actually survived rather than the pre-promotion id.
            expect(live[0]?.name).toContain('current');
            const gone = all.find((h) => h.deprecated);
            expect(gone?.supersededBy).toBe(live[0]?.id);
            // The control thread keeps both of its distinct memories.
            expect(await listMemoryFiles({ projectId: stagedThreadId('training_log'), limit: 50 })).toHaveLength(2);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
    it('reads the manifest once per pass, not once per thread', async () => {
        // Cost is pinned as storage work, not wall time, so the test cannot go
        // flaky on a busy machine. Reading the manifest per thread made the pass
        // O(threads x manifest): 401 full parses of a 5000-entry manifest at 200
        // threads, 4.1s, scaling with thread count at constant file count.
        const counters = { manifest: 0, body: 0 };
        const store = new Map<string, string>();
        setMemoryFilesStorageAdapter({
            getItem: jest.fn(async (key: string) => {
                if (key === MEMORY_FILES_MANIFEST_KEY) counters.manifest += 1;
                else if (key.startsWith(MEMORY_FILE_BODY_PREFIX)) counters.body += 1;
                return store.get(key) ?? null;
            }),
            setItem: jest.fn(async (key: string, value: string) => {
                store.set(key, value);
            }),
            removeItem: jest.fn(async (key: string) => {
                store.delete(key);
            }),
        });
        try {
            const THREADS = 12;
            const PER_THREAD = 8;
            const timestamp = new Date(Date.UTC(2026, 8, 1, 9, 0, 0)).toISOString();
            const records: MemoryFileImportRecord[] = [];
            for (let thread = 0; thread < THREADS; thread += 1) {
                for (let i = 0; i < PER_THREAD; i += 1) {
                    const id = `projects/thread-${thread}/Project/note-${i}.md`;
                    records.push({
                        header: {
                            id,
                            relativePath: id,
                            name: `Note ${i}`,
                            description: `Thread hint thread-${thread}. Entry ${i}.`,
                            type: 'project',
                            scope: 'project',
                            projectId: `thread-${thread}`,
                            updatedAt: timestamp,
                            capturedAt: timestamp,
                        },
                        content: `## Current Stage\nThread ${thread} entry ${i} with distinct detail number ${thread * 100 + i}.`,
                    });
                }
            }
            await importMemoryFiles(records);

            counters.manifest = 0;
            counters.body = 0;
            const outcome = await supersedeRestatedMemories();

            expect(outcome.superseded).toBe(0);
            // One manifest read for the whole pass, whatever the thread count.
            expect(counters.manifest).toBe(1);
            // And exactly one body read per file — no repeat reads, no scanning
            // files that cannot be candidates.
            expect(counters.body).toBe(THREADS * PER_THREAD);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
    it('catches a restatement at the tail of a thread longer than the old window', async () => {
        // Two stacked 50s hid this pair, both of them silent. The scan window was
        // 50 files, so the newest 50 of a 62-file thread were all it compared; and
        // the door it read through, `listMemoryFiles`, caps `limit` at 50 because
        // it feeds prompts and UI pages, so widening the window to 400 changed
        // nothing until the per-thread entry point stopped using it. Captured
        // first with 60 unrelated memories after it, this pair was permanently
        // invisible: superseded 0. It is now caught.
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            const timestamp = (minute: number) => new Date(Date.UTC(2026, 8, 1, 0, minute, 0)).toISOString();
            const records: MemoryFileImportRecord[] = [];
            const push = (name: string, content: string, minute: number) => {
                const id = `projects/desk/Project/${name}.md`;
                records.push({
                    header: {
                        id,
                        relativePath: id,
                        name,
                        description: `Desk entry ${name}.`,
                        type: 'project',
                        scope: 'project',
                        projectId: 'desk',
                        updatedAt: timestamp(minute),
                        capturedAt: timestamp(minute),
                    },
                    content,
                });
            };
            const staleBody = '## Current Stage\nThe writing desk sits by the north window. A brass lamp stands '
                + 'on the left corner, the notebook tray is centred under the shelf, and a wool mat covers the '
                + 'keyboard area. Nothing else lives on the surface.';
            push('stale', staleBody, 0);
            push('current', staleBody + ' The lamp bulb was swapped for a warmer one last week.', 1);
            for (let i = 0; i < 60; i += 1) {
                push(`filler-${i}`, `## Current Stage\nUnrelated note ${i} about topic ${i * 7} with its own separate wording and details entirely.`, 2 + i);
            }
            await importMemoryFiles(records);

            const outcome = await supersedeRestatedMemoriesInThread('desk');

            expect(outcome.superseded).toBe(1);
            expect(outcome.truncated).toEqual([]);

            // Asserted through the uncapped door on purpose. `listMemoryFiles`
            // pages newest-first with a max of 50, so the pair — the oldest two of
            // 62 — is outside every page it can return; reading the live set
            // through it would have "confirmed" the supersession without ever
            // looking at the records in question. 61 of 62 also pins that the door
            // really is uncapped.
            const headers = await listMemoryHeadersForThread('desk');
            expect(headers).toHaveLength(61);
            expect(headers.some((h) => h.name === 'stale')).toBe(false);
            expect(headers.some((h) => h.name === 'current')).toBe(true);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('reports threads that exceed the scan window instead of silently skipping them', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        try {
            const timestamp = new Date(Date.UTC(2026, 8, 1, 9, 0, 0)).toISOString();
            const records: MemoryFileImportRecord[] = [];
            for (let i = 0; i <= SUPERSEDE_SCAN_LIMIT; i += 1) {
                const id = `projects/wide/Project/note-${i}.md`;
                records.push({
                    header: {
                        id,
                        relativePath: id,
                        name: `Note ${i}`,
                        description: `Wide thread entry ${i}.`,
                        type: 'project',
                        scope: 'project',
                        projectId: 'wide',
                        updatedAt: timestamp,
                        capturedAt: timestamp,
                    },
                    content: `## Current Stage\nEntry ${i} with distinct detail number ${i * 13} and its own wording.`,
                });
            }
            await importMemoryFiles(records);

            const outcome = await supersedeRestatedMemories();

            expect(outcome.truncated).toEqual(['wide']);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('scan window'));
        } finally {
            warn.mockRestore();
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('never supersedes the _tmp backlog, which promotion owns', async () => {
        // Deprecating a staged file here would remove it from `listTmpFiles`
        // before Dream ever promoted it — a memory silently dropped instead of
        // folded into a thread. The whole-store pass always skipped `_tmp`; the
        // per-thread door had to be told, so the guard now lives in the shared
        // comparison both entry points run.
        const older = await stage(BASE_BODY, 'Kiln log one', '2026-01-01T00:00:00.000Z', '_tmp');
        const newer = await stage(BASE_BODY + '\n' + EXTENSION, 'Kiln log two', '2026-03-01T00:00:00.000Z', '_tmp');

        const outcome = await supersedeRestatedMemoriesInThread('_tmp');

        expect(outcome.superseded).toBe(0);
        expect((await listTmpFiles()).map((h) => h.id)).toEqual([older.id, newer.id]);
    });
});
