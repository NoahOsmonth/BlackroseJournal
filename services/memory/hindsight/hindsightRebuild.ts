import { accountScopedStorage } from '@/services/account/accountScopedStorage';
import {
    getActiveAccountId, runAccountBoundOperation,
} from '@/services/account/accountRuntime';
import { listCompleted } from '@/services/journal/journalStorage';
import type { JournalEntry } from '@/services/journal/journalStorage.types';
import { listCompletedCheckIns } from '@/services/intentions/intentionsStorage';
import type { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { hindsightClear, hindsightRebuild, type HindsightRetainItem } from './hindsightClient';
import { buildRetainItemsFromCheckIn, buildRetainItemsFromJournalEntry } from './hindsightRetain';

const REBUILD_STATE_KEY = '@blackrose_hindsight_rebuild';
const SCHEMA_VERSION = 1;
const MAX_REBUILD_ITEMS = 500;
interface RebuildState { schemaVersion: 1; completedAt: number }
export type HindsightRebuildResult = 'rebuilt' | 'already-complete' | 'failed' | 'stale-account';
export interface HindsightRebuildDependencies {
    listJournals(): Promise<JournalEntry[]>;
    listCheckIns(): Promise<IntentionCheckIn[]>;
    rebuild(items: HindsightRetainItem[], accountId: string): Promise<boolean>;
    clear(accountId: string): Promise<boolean>;
}
const defaultDependencies: HindsightRebuildDependencies = {
    listJournals: listCompleted,
    listCheckIns: listCompletedCheckIns,
    rebuild: hindsightRebuild,
    clear: hindsightClear,
};
let mutationQueue: Promise<void> = Promise.resolve();

async function loadState(): Promise<RebuildState | null> {
    const raw = await accountScopedStorage.getItem(REBUILD_STATE_KEY);
    if (!raw) return null;
    try {
        const value = JSON.parse(raw) as Partial<RebuildState>;
        return value.schemaVersion === SCHEMA_VERSION && typeof value.completedAt === 'number'
            ? value as RebuildState : null;
    } catch { return null; }
}

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(() => undefined, () => undefined);
    return result;
}

function newestBoundedItems(journals: JournalEntry[], checkIns: IntentionCheckIn[]): HindsightRetainItem[] {
    return [
        ...journals.flatMap(buildRetainItemsFromJournalEntry),
        ...checkIns.flatMap(buildRetainItemsFromCheckIn),
    ].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_REBUILD_ITEMS);
}

export function ensurePrivateHindsightRebuild(
    accountId: string,
    dependencies: HindsightRebuildDependencies = defaultDependencies,
): Promise<HindsightRebuildResult> {
    return runAccountBoundOperation('hindsight-private-rebuild', ({ accountId: leasedAccountId,
        signal }) => enqueue(async () => {
        const isStale = () => signal.aborted || leasedAccountId !== accountId
            || getActiveAccountId() !== accountId;
        if (isStale()) return 'stale-account';
        if (await loadState()) return isStale() ? 'stale-account' : 'already-complete';
        const [journals, checkIns] = await Promise.all([
            dependencies.listJournals(), dependencies.listCheckIns(),
        ]);
        if (isStale()) return 'stale-account';
        const items = newestBoundedItems(journals, checkIns);
        const succeeded = items.length > 0
            ? await dependencies.rebuild(items, accountId)
            : await dependencies.clear(accountId);
        if (isStale()) return 'stale-account';
        if (!succeeded) return 'failed';
        await accountScopedStorage.setItem(REBUILD_STATE_KEY, JSON.stringify({
            schemaVersion: SCHEMA_VERSION, completedAt: Date.now(),
        } satisfies RebuildState));
        return isStale() ? 'stale-account' : 'rebuilt';
    })).catch(() => 'failed');
}

export function clearHindsightRebuildState(): Promise<void> {
    return runAccountBoundOperation(
        'hindsight-rebuild-state',
        () => enqueue(() => accountScopedStorage.removeItem(REBUILD_STATE_KEY))
    );
}
