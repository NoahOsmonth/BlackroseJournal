/**
 * R2.4 — `memory_flush`'s backlog stall.
 *
 * The tool sliced the *examined* sessions to the newest 20, so once those twenty
 * were staged every later call re-examined the same twenty, found them already
 * staged, and reported success — while the backlog behind them never moved. Here
 * the external stores are mocked (a journal with more completed entries than the
 * budget) but the tool, the staging and the file store are the real code.
 */
/* eslint-disable import/first */
jest.mock('../../../services/journal/journalStorage', () => ({
    listEntries: jest.fn(),
}));
jest.mock('../../../services/intentions/intentionsStorage', () => ({
    listCompletedCheckIns: jest.fn(async () => []),
}));

import { memoryFlushTool } from '../../../services/ai/tools/memoryFileTools';
import { runMemoryDream } from '../../../services/memory/memoryDream';
import {
    clearMemoryFiles,
    deprecateRecord,
    hasStagedSession,
    listMemoryFiles,
    listStagedSessionKeys,
    listTmpFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../../services/memory/memoryFiles';
import { listEntries } from '../../../services/journal/journalStorage';
import type { JournalEntry } from '../../../services/journal/journalStorage.types';

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

/** Newest-first completed entries, ids `entry-0` .. `entry-{count-1}`. */
function entriesNewestFirst(count: number): JournalEntry[] {
    const all: JournalEntry[] = [];
    for (let i = count - 1; i >= 0; i -= 1) {
        const t = 1000 + i;
        all.push({
            id: `entry-${i}`,
            title: `Entry ${i}`,
            emoji: 'x',
            messages: [{
                id: `m${i}`,
                role: 'user',
                content: `Note ${i} about the kiln and the glaze and the shelf.`,
                timestamp: t,
            }],
            status: 'completed',
            createdAt: t,
            updatedAt: t,
        });
    }
    return all;
}

describe('memory_flush backlog drain (R2.4)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
    });

    afterEach(async () => {
        await clearMemoryFiles();
        resetMemoryFilesStorageAdapter();
        (listEntries as jest.Mock).mockReset();
    });

    it('advances past already-staged sessions instead of re-examining the same newest twenty', async () => {
        (listEntries as jest.Mock).mockResolvedValue(entriesNewestFirst(25));

        const first = await memoryFlushTool({});
        expect(await listTmpFiles()).toHaveLength(20);
        // The backlog left behind is stated, not implied.
        expect(first).toContain('5 session(s) still unstaged');

        // The old code stopped here forever: pass 2 re-sliced the same newest 20.
        const second = await memoryFlushTool({});
        expect(await listTmpFiles()).toHaveLength(25);
        expect(second).toContain('staged 5 file(s) from 5 session(s)');

        const third = await memoryFlushTool({});
        expect(third).toContain('staged 0 file(s) from 0 session(s)');
        expect(third).toContain('25 session(s) already staged');
        expect(third).not.toContain('still unstaged');
    });

    it('repeats until a backlog larger than the budget is fully drained', async () => {
        (listEntries as jest.Mock).mockResolvedValue(entriesNewestFirst(45));

        const seen = new Set<string>();
        for (let pass = 0; pass < 5; pass += 1) {
            const out = await memoryFlushTool({});
            if (!out.includes('still unstaged')) break;
            seen.add(out);
        }

        expect(await listTmpFiles()).toHaveLength(45);
        // Three passes at 20/20/5, not one pass and then a stall.
        expect(seen.size).toBe(2);
    });

    it('still counts a session whose promoted memory was later superseded', async () => {
        (listEntries as jest.Mock).mockResolvedValue(entriesNewestFirst(5));

        expect(await memoryFlushTool({})).toContain('staged 5 file(s) from 5 session(s)');
        expect((await runMemoryDream({ tryLlm: false })).promoted).toBe(5);

        // Supersession retires a promoted file *in place*, so for that session the
        // deprecated header is the only carrier of its key. Flush reads a batch of
        // staged keys, while the per-session guard inside staging is
        // `hasStagedSession` — the two must agree on deprecated headers, or a memory
        // supersession deliberately retired would be staged all over again here.
        const promoted = await listMemoryFiles({});
        await deprecateRecord(promoted[0].id, { reason: 'restated by a newer memory' });
        expect(await hasStagedSession(promoted[0].sourceSessionKey as string)).toBe(true);
        expect(await listStagedSessionKeys()).toEqual(new Set(entriesNewestFirst(5).map((e) => e.id)));

        const afterDream = await memoryFlushTool({});
        expect(afterDream).toContain('staged 0 file(s) from 0 session(s)');
        expect(afterDream).toContain('5 session(s) already staged');
        expect(await listTmpFiles()).toHaveLength(0);
    });

    it('drains a backlog whose head is entirely already staged, in one call', async () => {
        const all = entriesNewestFirst(25);
        (listEntries as jest.Mock).mockResolvedValue(all);

        // The newest 20 — exactly the old window — are already staged, which is the
        // state every repeated call used to leave behind. The remaining 5 are older
        // than the window, so a head-slice walk can never see them.
        for (const e of all.slice(0, 20)) {
            await stageTmpMemory({
                type: 'project',
                name: `Pre-staged ${e.id}`,
                description: `Thread hint work. Pre-staged ${e.id}.`,
                body: `## Current Stage\nPre-staged body for ${e.id}.`,
                sourceSessionKey: e.id,
            });
        }
        expect(await listTmpFiles()).toHaveLength(20);

        const out = await memoryFlushTool({});

        expect(out).toContain('staged 5 file(s) from 5 session(s)');
        expect(out).toContain('20 session(s) already staged');
        expect(out).not.toContain('still unstaged');
        expect(await listTmpFiles()).toHaveLength(25);
    });
});
