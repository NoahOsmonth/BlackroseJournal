/**
 * Feeds the pure writing-goal builder from collections the app has already
 * loaded. One settings read through the service; no extra journal or check-in
 * reads (R2 in docs/perf/ui-performance-rules.md).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { buildEntryText } from '@/utils/entryText';
import {
    buildWritingGoalProgress,
    DEFAULT_WRITING_GOAL,
    type WritingGoalRecord,
    type WritingGoalSettings,
} from '@/utils/writingGoal';
import {
    getWritingGoalSettings,
    setWritingGoalSettings,
    subscribeWritingGoal,
} from '@/services/goals/writingGoalSettings';

function countWords(text: string): number {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

export interface UseWritingGoalReturn {
    readonly progress: ReturnType<typeof buildWritingGoalProgress>;
    readonly settings: WritingGoalSettings;
    readonly isLoading: boolean;
    readonly updateSettings: (next: Partial<WritingGoalSettings>) => Promise<void>;
}

export function useWritingGoal(): UseWritingGoalReturn {
    const { completed: entries, isLoading: entriesLoading } = useJournalEntries();
    const { completed: checkIns, isLoading: checkInsLoading } = useIntentionCheckIns();
    const [settings, setSettings] = useState<WritingGoalSettings>(DEFAULT_WRITING_GOAL);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    useEffect(() => {
        let alive = true;
        void getWritingGoalSettings().then((saved) => {
            if (alive) { setSettings(saved); setSettingsLoaded(true); }
        }).catch(() => {
            if (alive) setSettingsLoaded(true);
        });
        const unsubscribe = subscribeWritingGoal((saved) => {
            if (alive) { setSettings(saved); setSettingsLoaded(true); }
        });
        return () => { alive = false; unsubscribe(); };
    }, []);

    const progress = useMemo(() => {
        const records: WritingGoalRecord[] = [];
        entries.forEach((entry) => {
            records.push({ createdAt: entry.createdAt, words: countWords(buildEntryText(entry.messages)) });
        });
        checkIns.forEach((checkIn) => {
            const text = [checkIn.title, checkIn.summary].filter(Boolean).join(' ');
            records.push({ createdAt: checkIn.createdAt, words: countWords(text) });
        });
        return buildWritingGoalProgress(records, settings, new Date());
    }, [entries, checkIns, settings]);

    const updateSettings = useCallback(async (next: Partial<WritingGoalSettings>) => {
        // Optimistic: the service notifies subscribers too, so this stays true
        // even if the screen unmounts before the promise resolves.
        setSettings((current) => ({ ...current, ...next }));
        const saved = await setWritingGoalSettings(next);
        setSettings(saved);
    }, []);

    return {
        progress,
        settings,
        isLoading: entriesLoading || checkInsLoading || !settingsLoaded,
        updateSettings,
    };
}
