import { useEffect, useState } from 'react';
import { listMemoryRollups } from '@/services/memory/memoryRollupStorage';
import type { MemoryRollup } from '@/services/memory/memoryRollup.types';
import {
    findRecurringThemes,
    hasEnoughRollupsForPatterns,
    type RecurringTheme,
} from '@/utils/recurringThemes';

export interface UseRecurringThemesReturn {
    readonly themes: RecurringTheme[];
    readonly isLoading: boolean;
    /** True when there are simply not enough weeks written to see a pattern yet. */
    readonly needsMoreWeeks: boolean;
    /** Week rollups written so far, for the plain explanation. */
    readonly weekCount: number;
    /**
     * The weekly summaries could not be read at all.
     *
     * Kept separate from "not enough weeks" on purpose: saying "write for a few
     * more weeks" when the read actually failed is a lie the writer cannot see
     * through, and it would tell someone with a year of entries to write more.
     */
    readonly isUnavailable: boolean;
}

/**
 * Themes that keep coming back across weeks (Kaneo #25).
 *
 * Reads the weekly rollups the app already writes and surfaces the topics that
 * recur. Times out quietly to an empty list: a missing pattern is not an error.
 */
export function useRecurringThemes(): UseRecurringThemesReturn {
    const [rollups, setRollups] = useState<MemoryRollup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUnavailable, setIsUnavailable] = useState(false);

    useEffect(() => {
        let isActive = true;
        (async () => {
            try {
                const rows = await listMemoryRollups({ kind: 'week' });
                if (isActive) setRollups(rows);
            } catch {
                if (isActive) {
                    setRollups([]);
                    setIsUnavailable(true);
                }
            } finally {
                if (isActive) setIsLoading(false);
            }
        })();
        return () => { isActive = false; };
    }, []);

    const weekCount = rollups.filter((rollup) => rollup.kind === 'week').length;

    return {
        themes: findRecurringThemes(rollups),
        isLoading,
        needsMoreWeeks: !isLoading && !isUnavailable && !hasEnoughRollupsForPatterns(rollups),
        weekCount,
        isUnavailable,
    };
}
