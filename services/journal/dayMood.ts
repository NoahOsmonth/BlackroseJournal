/**
 * How each day felt, and what shaped it (Kaneo #98).
 *
 * One storage key, one owner. One record per calendar day. A schemaVersion
 * envelope, a serialized mutation queue and a safe parse keep this store honest,
 * for the same reason every other store here has them: AsyncStorage has no
 * transactions, and a bare JSON.parse of a corrupt payload throws into the UI.
 */
import { AccountStorageAdapter, getStorageForAccount } from '@/services/account/accountScopedStorage';
import {
    assertAccountOperationActive,
    registerAccountTeardown,
    runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { isDayKey, MAX_DAY_FACTORS, normalizeFactorIds, normalizeMoodId } from '@/utils/dayMood';

export const DAY_MOODS_KEY = '@blackrose_day_moods';

const SCHEMA_VERSION = 1;

export interface DayMood {
    readonly moodId: string | null;
    readonly factorIds: readonly string[];
    readonly updatedAt: number;
}

interface DayMoodPayload {
    schemaVersion: number;
    days: Record<string, DayMood>;
    updatedAt: number;
}

type DayMoodMap = Record<string, DayMood>;

function emptyPayload(): DayMoodPayload {
    return { schemaVersion: SCHEMA_VERSION, days: {}, updatedAt: 0 };
}

let mutationQueue: Promise<void> = Promise.resolve();

type DayMoodListener = (days: Readonly<DayMoodMap>) => void;
const changeListeners = new Set<DayMoodListener>();

export function subscribeDayMoods(listener: DayMoodListener): () => void {
    changeListeners.add(listener);
    return () => { changeListeners.delete(listener); };
}

function notifyDayMoods(days: Readonly<DayMoodMap>): void {
    changeListeners.forEach((listener) => {
        try { listener(days); } catch { /* one bad listener must not block the rest */ }
    });
}

registerAccountTeardown(() => { mutationQueue = Promise.resolve(); });

function parseEntry(raw: unknown): DayMood | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const record = raw as Record<string, unknown>;
    const moodId = normalizeMoodId(record.moodId);
    const factorIds = normalizeFactorIds(record.factorIds);
    // A day with neither a feeling nor a cause carries no information; drop it
    // rather than keep an empty row that would render as a blank chip row.
    if (!moodId && factorIds.length === 0) return null;
    return {
        moodId,
        factorIds,
        updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    };
}

function parsePayload(raw: string | null): DayMoodPayload {
    if (!raw) return emptyPayload();
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPayload();
        const record = parsed as Record<string, unknown>;
        const source = record.days;
        const days: DayMoodMap = {};
        if (source && typeof source === 'object' && !Array.isArray(source)) {
            for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
                if (!isDayKey(key)) continue;
                const entry = parseEntry(value);
                if (entry) days[key] = entry;
            }
        }
        return {
            schemaVersion: typeof record.schemaVersion === 'number' ? record.schemaVersion : SCHEMA_VERSION,
            days,
            updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
        };
    } catch {
        return emptyPayload();
    }
}

async function readPayload(storage: AccountStorageAdapter): Promise<DayMoodPayload> {
    return parsePayload(await storage.getItem(DAY_MOODS_KEY));
}

async function writePayload(storage: AccountStorageAdapter, payload: DayMoodPayload): Promise<void> {
    await storage.setItem(DAY_MOODS_KEY, JSON.stringify(payload));
}

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

/**
 * Apply one change to one day, then drop the day entirely if it ends up empty.
 * Every writer below goes through here, so the "no empty rows" rule has exactly
 * one home.
 */
function mutateDay(
    name: string,
    dateKey: string,
    apply: (current: DayMood | null) => { moodId: string | null; factorIds: string[] } | null,
): Promise<DayMoodMap> {
    return runAccountBoundOperation(name, async (context) => {
        const storage = getStorageForAccount(context.accountId);
        if (!isDayKey(dateKey)) return (await readPayload(storage)).days;
        return enqueueMutation(async () => {
            assertAccountOperationActive(context);
            const payload = await readPayload(storage);
            const current = payload.days[dateKey] ?? null;
            const applied = apply(current);
            const nextDays: DayMoodMap = { ...payload.days };
            if (!applied) {
                delete nextDays[dateKey];
            } else {
                const moodId = normalizeMoodId(applied.moodId);
                const factorIds = normalizeFactorIds(applied.factorIds);
                if (!moodId && factorIds.length === 0) delete nextDays[dateKey];
                else nextDays[dateKey] = { moodId, factorIds, updatedAt: Date.now() };
            }
            await writePayload(storage, {
                schemaVersion: SCHEMA_VERSION,
                days: nextDays,
                updatedAt: Date.now(),
            });
            notifyDayMoods(nextDays);
            assertAccountOperationActive(context);
            return nextDays;
        });
    });
}

export function listDayMoods(): Promise<DayMoodMap> {
    return runAccountBoundOperation('day-moods-list', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return payload.days;
    });
}

export function readDayMood(dateKey: string): Promise<DayMood | null> {
    return runAccountBoundOperation('day-moods-read', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        assertAccountOperationActive(context);
        const payload = await readPayload(storage);
        assertAccountOperationActive(context);
        return payload.days[dateKey] ?? null;
    });
}

/** Tapping the chosen feeling again clears it; the causes stay. */
export function setDayMoodFeeling(dateKey: string, moodId: string | null): Promise<DayMoodMap> {
    return mutateDay('day-moods-feeling', dateKey, (current) => {
        const next = normalizeMoodId(moodId);
        if (!next && (!current || current.factorIds.length === 0)) return null;
        return { moodId: next, factorIds: [...(current?.factorIds ?? [])] };
    });
}

/** Toggle one cause. Past the cap a new cause is refused, not silently dropped. */
export function toggleDayFactor(dateKey: string, factorId: string): Promise<DayMoodMap> {
    return mutateDay('day-moods-factor', dateKey, (current) => {
        const known = normalizeFactorIds([factorId]);
        if (known.length === 0) return current ? { moodId: current.moodId, factorIds: [...current.factorIds] } : null;
        const id = known[0];
        const existing = current?.factorIds ?? [];
        const has = existing.includes(id);
        if (!has && existing.length >= MAX_DAY_FACTORS) {
            return { moodId: current?.moodId ?? null, factorIds: [...existing] };
        }
        const factorIds = has ? existing.filter((each) => each !== id) : [...existing, id];
        return { moodId: current?.moodId ?? null, factorIds };
    });
}

export function clearDayMood(dateKey: string): Promise<DayMoodMap> {
    return mutateDay('day-moods-clear', dateKey, () => null);
}

/** Clear History entry point: empty envelope, key stays owned here. */
export function clearAllDayMoods(): Promise<void> {
    return runAccountBoundOperation('day-moods-clear-all', async (context) => {
        const storage = getStorageForAccount(context.accountId);
        await enqueueMutation(async () => {
            assertAccountOperationActive(context);
            await writePayload(storage, emptyPayload());
            notifyDayMoods({});
            assertAccountOperationActive(context);
        });
    });
}
