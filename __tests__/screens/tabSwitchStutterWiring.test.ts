import fs from 'fs';
import path from 'path';

import { relPosix } from '../mocks/repoPath';

const root = path.resolve(__dirname, '..', '..');
const read = (file: string): string => fs.readFileSync(path.join(root, file), 'utf8');
const src = (p: string): string => read(relPosix(root, path.join(root, p)));

describe('tab-switch stutter wiring (Kaneo #87)', () => {
    const today = src('app/(tabs)/today.tsx');
    const entries = src('app/(tabs)/entries.tsx');
    const adapter = src('services/account/accountScopedStorage.ts');
    const helper = src('hooks/collections/useCollectionRefresh.ts');
    const journal = src('hooks/journal/useJournalEntries.ts');
    const intentions = src('hooks/intentions/useIntentions.ts');
    const checkIns = src('hooks/intentions/useIntentionCheckIns.ts');
    const goals = src('hooks/goals/useGoals.ts');

    it('Today no longer re-reads four collections on focus', () => {
        expect(today).not.toContain('refreshAll');
        expect(today).not.toContain('useFocusEffect');
        expect(today).not.toContain('refreshEntries');
        expect(today).not.toContain('refreshCheckIns');
        expect(today).not.toContain('refreshIntentions');
        expect(today).not.toContain('refreshGoals');
    });

    it('History keeps only the small draft-banner focus check', () => {
        expect(entries).toContain('useFocusEffect(');
        expect(entries).toContain('getMostRecentActiveSession()');
        expect(entries).not.toContain('void refreshFeed()');
    });

    it('all four collection hooks subscribe to real writes', () => {
        for (const hook of [journal, intentions, checkIns, goals]) {
            expect(hook).toContain('useCollectionRefresh(');
        }
        // The journal watches its index AND all 16 shard keys.
        expect(journal).toContain('JOURNAL_ENTRIES_STORAGE_KEY');
        expect(journal).toContain('JOURNAL_ENTRIES_SHARD_KEY_PREFIX');
        expect(journal).toContain('JOURNAL_ENTRIES_SHARD_COUNT');
        expect(intentions).toContain("'@intentions'");
        expect(checkIns).toContain("'@intention_checkins'");
        expect(goals).toContain("'@goals'");
    });

    it('the bus is storage-level, so backup/seed/Explore writes are covered', () => {
        expect(adapter).toContain('subscribeCollectionChanges');
        expect(adapter).toContain('notifyCollectionChanged(key)');
        expect(adapter).toContain('await adapter.setItem(scopedKey, value)');
        expect(adapter).toContain('await adapter.removeItem(scopedKey)');
        // NOT a settled-value cache (round 32 regression).
        expect(adapter).toContain('round 32 reverted one');
        expect(adapter).not.toContain('settledValues');
    });

    it('a failed write never signals, and one bad listener cannot break it', () => {
        expect(adapter).toContain('try {');
        expect(adapter).toContain('catch {');
        const busTest = src('__tests__/services/collectionChangeBus.test.ts');
        expect(busTest).toContain('does NOT notify when a write fails');
        expect(busTest).toContain('a broken listener cannot break the write');
    });

    it('the helper coalesces a burst into one refresh', () => {
        expect(helper).toContain('if (scheduled) return;');
        expect(helper).toContain('Promise.resolve().then(');
        const helperTest = src('__tests__/hooks/useCollectionRefresh.test.ts');
        expect(helperTest).toContain('collapses a burst of shard writes into ONE refresh');
    });

    it('account switch and clear-history paths still exist', () => {
        for (const hook of [journal, intentions, checkIns, goals]) {
            expect(hook).toContain('hasLoadedRef.current = false;');
            expect(hook).toContain('useActiveAccountId()');
        }
    });
});
