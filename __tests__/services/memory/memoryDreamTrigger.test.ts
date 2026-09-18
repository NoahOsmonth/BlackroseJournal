/**
 * R1 idle Dream trigger: the gate (foreground / streaming turn / backlog
 * threshold), single-flight, and the "no timer survives backgrounding" rule.
 *
 * Dream itself is the real code path (offline plan; no key in tests means the
 * LLM plan attempt soft-fails), so these tests never mock the unit under test.
 */
import {
    beginChatTurn,
    endChatTurn,
    resetChatTurnActivity,
} from '../../../services/ai/chatTurnActivity';
import {
    listMemoryFiles,
    listMemoryHeadersForThread,
    listTmpFiles,
    resetMemoryFilesStorageAdapter,
    setMemoryFilesStorageAdapter,
    stageTmpMemory,
} from '../../../services/memory/memoryFiles';
import { runMemoryDream } from '../../../services/memory/memoryDream';
import {
    DREAM_IDLE_DELAY_MS,
    DREAM_MIN_STAGED_FILES,
    getDreamTriggerState,
    maybeRunIdleDream,
    noteDreamActivity,
    resetDreamTrigger,
    setDreamForeground,
} from '../../../services/memory/memoryDreamTrigger';

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

async function stageStaged(count: number): Promise<void> {
    for (let i = 0; i < count; i += 1) {
        await stageTmpMemory({
            type: 'project',
            name: `Staged note ${i + 1}`,
            description: `Thread hint copper-lighthouse. Staged body ${i + 1}.`,
            body: `## Current Stage\nStaged body ${i + 1}`,
        });
    }
}

describe('memoryDreamTrigger (R1 idle Dream)', () => {
    beforeEach(() => {
        setMemoryFilesStorageAdapter(createAdapter());
        resetChatTurnActivity();
        resetDreamTrigger();
    });

    afterEach(() => {
        resetDreamTrigger();
        resetChatTurnActivity();
        resetMemoryFilesStorageAdapter();
    });

    it('declines while a chat turn is streaming', async () => {
        await stageStaged(DREAM_MIN_STAGED_FILES);
        beginChatTurn();
        try {
            const outcome = await maybeRunIdleDream();
            expect(outcome).toBeNull();
            expect(getDreamTriggerState().lastSkipReason).toBe('turn-in-flight');
            expect(getDreamTriggerState().runs).toBe(0);
        } finally {
            endChatTurn();
        }
    });

    it('declines while the app is backgrounded', async () => {
        await stageStaged(DREAM_MIN_STAGED_FILES);
        setDreamForeground(false);
        const outcome = await maybeRunIdleDream();
        expect(outcome).toBeNull();
        expect(getDreamTriggerState().lastSkipReason).toBe('backgrounded');
        expect(getDreamTriggerState().runs).toBe(0);
    });

    it('declines below the staged-file threshold', async () => {
        await stageStaged(DREAM_MIN_STAGED_FILES - 1);
        const outcome = await maybeRunIdleDream();
        expect(outcome).toBeNull();
        expect(getDreamTriggerState().lastSkipReason).toBe('below-threshold');
    });

    it('promotes the backlog and reports the outcome', async () => {
        await stageStaged(DREAM_MIN_STAGED_FILES);
        const outcome = await maybeRunIdleDream();
        expect(outcome?.promoted).toBe(DREAM_MIN_STAGED_FILES);
        expect(outcome?.tmpRemaining).toBe(0);
        expect(getDreamTriggerState().runs).toBe(1);

        const headers = await listMemoryFiles({});
        expect(headers.every((h) => h.projectId !== '_tmp')).toBe(true);
    });

    it('runs one Dream for concurrent callers (single-flight)', async () => {
        await stageStaged(DREAM_MIN_STAGED_FILES);
        const [first, second] = await Promise.all([
            maybeRunIdleDream(),
            maybeRunIdleDream(),
        ]);
        // Both callers observe the same run, and only one consolidation happened.
        expect(first).toBe(second);
        expect(getDreamTriggerState().runs).toBe(1);
        expect(first?.promoted).toBe(DREAM_MIN_STAGED_FILES);
    });

    it('drains a backlog larger than MAX_DREAM_FILES over repeated runs, losing nothing (R2.5)', async () => {
        // R2 left this unpriced: "a large backlog needs repeated idle windows — worth
        // pricing before anyone assumes one pass drains everything." Priced here.
        // 50 is deliberately past the 20-file window (`MAX_DREAM_FILES`, not exported
        // — pinned by the expected run lengths below).
        const total = 50;
        await stageStaged(total);
        expect(await listTmpFiles()).toHaveLength(total);

        const runs: number[] = [];
        for (let pass = 0; pass < 6; pass += 1) {
            const outcome = await runMemoryDream({ tryLlm: false });
            runs.push(outcome.promoted);
            // The cap is not silent: each run reports what it left behind.
            expect(outcome.tmpRemaining).toBe(total - runs.reduce((a, b) => a + b, 0));
            if (outcome.tmpRemaining === 0) break;
        }

        // Two full windows then the remainder — not one pass and then a stall. This
        // works because `listTmpFiles` holds only *unpromoted* files and promotion
        // removes them from the head, which is exactly what `memory_flush` lacked.
        expect(runs).toEqual([20, 20, 10]);
        expect(await listTmpFiles()).toHaveLength(0);

        // Nothing lost on the way: every staged memory is now in a formal thread.
        const promoted = await listMemoryHeadersForThread('copper-lighthouse');
        expect(promoted).toHaveLength(total);
    });

    it('arms one idle deadline and no timer survives backgrounding', async () => {
        jest.useFakeTimers();
        try {
            await stageStaged(DREAM_MIN_STAGED_FILES);
            noteDreamActivity();
            expect(getDreamTriggerState().scheduled).toBe(true);

            // Backgrounding must cancel the deferred run outright.
            setDreamForeground(false);
            expect(getDreamTriggerState().scheduled).toBe(false);
            jest.advanceTimersByTime(DREAM_IDLE_DELAY_MS * 3);
            await Promise.resolve();
            expect(getDreamTriggerState().runs).toBe(0);

            setDreamForeground(true);
            noteDreamActivity();
            await jest.advanceTimersByTimeAsync(DREAM_IDLE_DELAY_MS + 10);
            expect(getDreamTriggerState().runs).toBe(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('re-arming replaces the previous deadline instead of stacking timers', () => {
        jest.useFakeTimers();
        try {
            noteDreamActivity();
            noteDreamActivity();
            noteDreamActivity();
            // One deadline is tracked no matter how many activity events arrive.
            expect(getDreamTriggerState().scheduled).toBe(true);
            expect(jest.getTimerCount()).toBe(1);
        } finally {
            jest.useRealTimers();
        }
    });
});
