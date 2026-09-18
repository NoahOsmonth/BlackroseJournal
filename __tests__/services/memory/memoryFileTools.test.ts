/**
 * R2.4 — the silent-cap sweep, second half: two bounds in
 * `services/ai/tools/memoryFileTools.ts` that hid their own effect.
 *
 * 1. `memory_get` clipped every body at an unnamed `slice(0, 4000)`. Nothing in
 *    the returned text distinguished a whole file from the first 4000 characters
 *    of one, so the model could not know it was missing the rest.
 * 2. `memory_flush` sliced the *examined* sessions to the newest 20, so once
 *    those twenty were staged every later call re-examined the same twenty, found
 *    them staged, and reported success while the backlog behind them never moved.
 *
 * This file covers the read path (`memory_get`, `memory_list`); the flush backlog
 * lives in `memoryFlushBacklog.test.ts`, because it needs the journal mocked and
 * this one deliberately does not.
 *
 * Modelled on `memoryRecordLoad.test.ts` (the R2.1 half of the same bug class):
 * the real tool against a real in-memory store, no mock of the unit under test.
 */
import { memoryGetTool, memoryListTool } from '../../../services/ai/tools/memoryFileTools';
import {
    clearMemoryFiles,
    importMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../../services/memory/memoryFiles';
import { RECALL_FILE_MAX_CHARS, RECALL_TOTAL_MAX_CHARS } from '../../../services/memory/memoryRetrieval';

export function createAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: async (key: string) => store.get(key) ?? null,
        setItem: async (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: async (key: string) => {
            store.delete(key);
        },
    };
}

const FILE_ID = 'projects/kiln/Project/long-note.md';
const MARKER = /…\[truncated/;

/** Import one project memory with a body of exactly `chars` characters. */
async function importBody(chars: number, phrase = 'kiln cooling glaze'): Promise<string> {
    const unit = `${phrase} `;
    const body = unit.repeat(Math.ceil(chars / unit.length)).slice(0, chars);
    const timestamp = new Date(Date.UTC(2026, 8, 1, 0, 0, 0)).toISOString();
    await importMemoryFiles([{
        header: {
            id: FILE_ID,
            relativePath: FILE_ID,
            name: 'Long note',
            description: 'A long memory about the kiln.',
            type: 'project',
            scope: 'project',
            projectId: 'kiln',
            updatedAt: timestamp,
            capturedAt: timestamp,
        },
        content: body,
    }]);
    return body;
}

/** Stage `count` distinct files that all land in one thread. */
async function stageMany(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
        await stageTmpMemory({
            type: 'project',
            name: `Note ${i}`,
            description: `Thread hint work. Distinct note number ${i}.`,
            body: `## Current Stage\nBody ${i}`,
        });
    }
}

describe('memory_get body bound (R2.4)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('returns a short body whole, with no truncation marker', async () => {
        const body = await importBody(2000);
        const out = await memoryGetTool({ ids: [FILE_ID] });

        expect(out).toContain(body);
        expect(out).not.toMatch(MARKER);
        expect(out).not.toContain('clipped:');
    });

    it('marks a body clipped past the recall per-file cap instead of cutting it silently', async () => {
        const body = await importBody(RECALL_FILE_MAX_CHARS + 3000);
        const out = await memoryGetTool({ ids: [FILE_ID] });

        expect(out).toMatch(MARKER);
        // The count is what makes the loss legible: 3000 chars were not shown.
        expect(out).toContain('3000 more char(s)');
        expect(out).toContain('clipped: 1 of 1 body(ies)');
        // The old unnamed 4000-char cut must be gone: this body is still mostly here.
        expect(out.length).toBeGreaterThan(4000);
        expect(out.length).toBeLessThan(body.length);
    });

    it('does not claim truncation when a body lands exactly on the cap', async () => {
        const body = await importBody(RECALL_FILE_MAX_CHARS);
        const out = await memoryGetTool({ ids: [FILE_ID] });

        expect(body).toHaveLength(RECALL_FILE_MAX_CHARS);
        expect(out).toContain(body);
        expect(out).not.toMatch(MARKER);
    });

    it('bounds many long bodies by the recall total, and says how many were clipped', async () => {
        const timestamp = new Date(Date.UTC(2026, 8, 2, 0, 0, 0)).toISOString();
        const bodies = [0, 1, 2].map((n) => ({
            header: {
                id: `projects/kiln/Project/note-${n}.md`,
                relativePath: `projects/kiln/Project/note-${n}.md`,
                name: `Note ${n}`,
                description: `Kiln note ${n}.`,
                type: 'project' as const,
                scope: 'project' as const,
                projectId: 'kiln',
                updatedAt: timestamp,
                capturedAt: timestamp,
            },
            content: `note ${n} `.repeat(4000),
        }));
        await importMemoryFiles(bodies);

        const out = await memoryGetTool({ ids: bodies.map((b) => b.header.id) });
        // One section per body header, so a clipped body is attributable to its id.
        const sections = out.split('### [').slice(1);

        // Each body is 28k chars; three of them cannot fit the 30k total, so every
        // one is clipped and every one says so.
        expect(sections).toHaveLength(bodies.length);
        expect(sections.every((s) => MARKER.test(s))).toBe(true);
        expect(sections.filter((s) => s.includes('\n\n…[truncated: '))).toHaveLength(bodies.length);
        expect(out).toContain(`clipped: ${bodies.length} of ${bodies.length} body(ies)`);
        expect(out).toContain(`${RECALL_TOTAL_MAX_CHARS} chars for this call`);
    });
});

describe('memory_list page bound (R2.4)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
    });

    it('announces the per-call page ceiling instead of returning fewer rows in silence', async () => {
        await stageMany(60);

        const out = await memoryListTool({ limit: 100 });
        const rows = out.split('\n').filter((line) => line.startsWith('- '));

        expect(rows).toHaveLength(50);
        expect(out).toContain('asked for 100 row(s)');
        expect(out).toContain('pages at most 50 per call');
        // And the next page is reachable by saying where it starts.
        expect(out).toContain('offset 50');
    });

    it('stays quiet when the page is smaller than the bound', async () => {
        await stageMany(3);

        const out = await memoryListTool({ limit: 10 });

        expect(out.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(3);
        expect(out).not.toContain('pages at most');
        expect(out).not.toContain('offset');
    });

    it('walks a store larger than one page with offset', async () => {
        await stageMany(60);

        const first = await memoryListTool({ limit: 50 });
        const second = await memoryListTool({ limit: 50, offset: 50 });
        const idsOf = (out: string) => out.split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.split(' ')[1]);

        expect(idsOf(second)).toHaveLength(10);
        expect(idsOf(first)).toHaveLength(50);
        // Two disjoint pages, not the same fifty twice.
        expect(idsOf(first).filter((id) => idsOf(second).includes(id))).toHaveLength(0);
    });
});
