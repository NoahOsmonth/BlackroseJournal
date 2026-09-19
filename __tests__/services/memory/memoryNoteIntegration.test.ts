/**
 * Integration half of the `'note'` memory-file type.
 *
 * `memoryNoteFiles.test.ts` covers the store itself (the type surviving a
 * manifest round-trip, `stageUserNoteMemory`, body-before-header write ordering).
 * This file covers how a note behaves in the machinery *around* the store:
 *
 * 1. Supersession (R2) — a note is the writer's own words, so it is never
 *    auto-deprecated as "restated by a newer memory in the same thread".
 * 2. `memory_list` kind coercion — the tool's accepted kinds are derived from
 *    `MEMORY_FILE_TYPES`, so `{"kind":"note"}` filters to notes instead of
 *    silently falling through to every kind.
 *
 * Split out rather than appended: the store file was already 283 of the 300-line
 * cap, and these concerns are about the callers, not the store.
 */
import { memoryListTool } from '../../../services/ai/tools/memoryFileTools';
import {
    clearMemoryFiles,
    importMemoryFiles,
    listMemoryFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
    stageUserNoteMemory,
} from '../../../services/memory/memoryFiles';
import { supersedeRestatedMemoriesInThread } from '../../../services/memory/memorySupersession';

function createAdapter() {
    const store = new Map<string, string>();
    return {
        store,
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
}

/**
 * Deliberately longer than it reads. Supersession refuses to judge a body below
 * `SUPERSEDE_MIN_BODY_TOKENS` (20) tokens, so a short note would survive by
 * accident and the test would pass without the type guard it exists to check.
 * This body tokenizes to well over 20 distinct tokens, and the control test below
 * proves a pair of this shape *is* superseded when it is not a note.
 */
const NOTE_BODY = [
    '## Note',
    'Calm mornings help me think straight and plan the day before anyone else wakes.',
    'The kitchen is quiet, the kettle is slow, and nothing urgent has started yet.',
    'Writing it down keeps the habit visible when the week gets loud and crowded.',
].join('\n');

const NOTE_EXTENSION = '\nThe shelf notes from that morning made the rest of the day easier to run.';

/** Import one memory into a formal thread, as a promoted file would look. */
function threadRecord(
    projectId: string,
    fileName: string,
    type: 'note' | 'project',
    content: string,
    capturedAt: string,
) {
    const id = `projects/${projectId}/Project/${fileName}.md`;
    return {
        header: {
            id,
            relativePath: id,
            name: fileName === 'morning-note' ? 'Note: calm mornings' : 'Morning pattern',
            description: 'Thread hint mornings.',
            type,
            scope: 'project' as const,
            projectId,
            updatedAt: capturedAt,
            capturedAt,
        },
        content,
    };
}

describe('supersession leaves notes alone', () => {
    it('never deprecates a note even when a newer memory restates it', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await importMemoryFiles([
                threadRecord('work', 'morning-note', 'note', NOTE_BODY, '2026-09-01T10:00:00.000Z'),
                threadRecord('work', 'morning-restated', 'project', NOTE_BODY + NOTE_EXTENSION, '2026-09-10T10:00:00.000Z'),
            ]);

            const outcome = await supersedeRestatedMemoriesInThread('work');

            expect(outcome.superseded).toBe(0);
            const headers = await listMemoryFiles({});
            expect(headers.map((h) => h.type)).toContain('note');
            // The note is not merely present but un-deprecated: nothing was
            // retired, and no audit pointer was written against it.
            const note = headers.find((h) => h.type === 'note');
            expect(note?.deprecated).toBeUndefined();
            expect(note?.supersededBy).toBeUndefined();
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('still supersedes a pair of this exact shape when neither file is a note', async () => {
        // The control for the test above: without it, a note could survive
        // because its body was too short to judge rather than because of the
        // type guard. Same bodies, same timestamps, same thread shape — only the
        // older file's type differs.
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await importMemoryFiles([
                threadRecord('control', 'older', 'project', NOTE_BODY, '2026-09-01T10:00:00.000Z'),
                threadRecord('control', 'newer', 'project', NOTE_BODY + NOTE_EXTENSION, '2026-09-10T10:00:00.000Z'),
            ]);

            const outcome = await supersedeRestatedMemoriesInThread('control');

            expect(outcome.superseded).toBe(1);
            const live = await listMemoryFiles({});
            expect(live.map((h) => h.name)).toEqual(['Morning pattern']);
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});

describe('memory_list kind coercion', () => {
    it('filters to notes for kind=note instead of silently returning everything', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await stageUserNoteMemory({ text: 'A note about the kiln.', sourceEntryId: 'e1' });
            await stageTmpMemory({
                type: 'project', name: 'Kiln', description: 'kiln project',
                body: '## Current Stage\nkiln work', projectId: 'kiln',
            });

            const notes = await memoryListTool({ kind: 'note' });
            expect(notes).toContain('[note]');
            expect(notes).not.toContain('[project]');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });

    it('falls back to all kinds for an unrecognised kind', async () => {
        const adapter = createAdapter();
        setMemoryFilesStorageAdapter(adapter);
        try {
            await stageUserNoteMemory({ text: 'A note about the kiln.', sourceEntryId: 'e1' });
            await stageTmpMemory({
                type: 'project', name: 'Kiln', description: 'kiln project',
                body: '## Current Stage\nkiln work', projectId: 'kiln',
            });

            const all = await memoryListTool({ kind: 'nonsense' });
            expect(all).toContain('[note]');
            expect(all).toContain('[project]');
        } finally {
            await clearMemoryFiles();
            resetMemoryFilesStorageAdapter();
        }
    });
});
