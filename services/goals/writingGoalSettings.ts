/**
 * A gentle writing goal — the saved setting.
 *
 * One storage key, one owner (AGENTS.md storage-key table). The payload has a
 * schemaVersion envelope so a future shape can migrate instead of being
 * misread. Every mutation goes through this module's serialized queue because
 * AsyncStorage has no transactions and two interleaved read-modify-write
 * cycles would silently drop one side's change.
 */
import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import {
    DEFAULT_WRITING_GOAL,
    normalizeWritingGoalSettings,
    type WritingGoalSettings,
} from '@/utils/writingGoal';

export const WRITING_GOAL_KEY = '@blackrose_writing_goal';

const SCHEMA_VERSION = 1;

interface WritingGoalPayload {
    schemaVersion: number;
    wordsPerDay: number;
    restDaysPerWeek: number;
    updatedAt: number;
}

function emptyPayload(): WritingGoalPayload {
    return {
        schemaVersion: SCHEMA_VERSION,
        wordsPerDay: DEFAULT_WRITING_GOAL.wordsPerDay,
        restDaysPerWeek: DEFAULT_WRITING_GOAL.restDaysPerWeek,
        updatedAt: 0,
    };
}

let mutationQueue: Promise<void> = Promise.resolve();

type WritingGoalListener = (settings: WritingGoalSettings) => void;
const changeListeners = new Set<WritingGoalListener>();

/** Screens subscribe instead of polling on focus, so a preset tap lands at once. */
export function subscribeWritingGoal(listener: WritingGoalListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifyWritingGoal(settings: WritingGoalSettings): void {
    changeListeners.forEach((listener) => {
        try { listener(settings); } catch { /* one bad listener must not break a write */ }
    });
}

registerAccountTeardown(() => { mutationQueue = Promise.resolve(); });

/** Safe parse: a corrupt or older payload never throws into the UI. */
function parsePayload(raw: string | null): WritingGoalPayload {
    if (!raw) return emptyPayload();
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPayload();
        const record = parsed as Record<string, unknown>;
        const safe = normalizeWritingGoalSettings({
            wordsPerDay: typeof record.wordsPerDay === 'number' ? record.wordsPerDay : undefined,
            restDaysPerWeek: typeof record.restDaysPerWeek === 'number' ? record.restDaysPerWeek : undefined,
        });
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            wordsPerDay: safe.wordsPerDay,
            restDaysPerWeek: safe.restDaysPerWeek,
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return emptyPayload();
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<WritingGoalPayload> {
    return parsePayload(await storage.getItem(WRITING_GOAL_KEY));
}

async function writePayload(storage: AccountStorageAdapter, payload: WritingGoalPayload): Promise<void> {
    await storage.setItem(WRITING_GOAL_KEY, JSON.stringify(payload));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function toSettings(payload: WritingGoalPayload): WritingGoalSettings {
    return normalizeWritingGoalSettings({
        wordsPerDay: payload.wordsPerDay,
        restDaysPerWeek: payload.restDaysPerWeek,
    });
}

/** Read the saved setting. Missing or corrupt storage returns the calm default. */
export function getWritingGoalSettings(): Promise<WritingGoalSettings> {
    return runAccountBoundOperation('writing-goal-get', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return toSettings(payload);
    });
}

/** Save a preset change. Values outside the supported presets are clamped. */
export function setWritingGoalSettings(next: Partial<WritingGoalSettings>): Promise<WritingGoalSettings> {
    return runAccountBoundOperation('writing-goal-set', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const current = toSettings(await readPayload(storage));
            const safe: WritingGoalSettings = normalizeWritingGoalSettings({
                wordsPerDay: next.wordsPerDay ?? current.wordsPerDay,
                restDaysPerWeek: next.restDaysPerWeek ?? current.restDaysPerWeek,
            });
            await writePayload(storage, { ...emptyPayload(), ...safe, updatedAt: Date.now() });
            notifyWritingGoal(safe);
            assertAccountOperationActive(context);
            return safe;
        });
    });
}

/**
 * Clear History entry point. Writes a default envelope (not removeItem) so
 * the key stays owned by this module and its shape stays valid, then notifies
 * subscribers so an open screen cannot keep showing the old target forever.
 */
export function clearWritingGoalSettings(): Promise<void> {
    return runAccountBoundOperation('writing-goal-clear', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await writePayload(storage, { ...emptyPayload(), updatedAt: Date.now() });
            notifyWritingGoal(DEFAULT_WRITING_GOAL);
        });
    });
}
