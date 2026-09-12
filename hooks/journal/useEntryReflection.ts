import { useCallback, useEffect, useMemo, useState } from 'react';

import { generateEntryReflection } from '@/services/ai/insights';
import type { EntryReflectionResult } from '@/services/ai/insightsTypes';
import { getEntry } from '@/services/journal/journalStorage';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

interface UseEntryReflectionState {
    entry: JournalEntry | null;
    data: EntryReflectionResult | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

interface ReflectionSetters {
    setEntry: (entry: JournalEntry | null) => void;
    setData: (data: EntryReflectionResult | null) => void;
    setIsLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
}

const reflectionCache = new Map<string, EntryReflectionResult>();

/**
 * In-flight loads keyed by `<entryId>:<force>`.
 *
 * A screen that re-renders while a load is pending must not fire a second AI
 * call. Without this guard a render loop on the reflection screen queued
 * thousands of `generateEntryReflection` requests, saturating the browser's
 * per-origin connection pool and starving every later AI call (including the
 * entry title on the next Finish).
 */
const inFlightLoads = new Map<string, Promise<void>>();

function buildEntryText(entry: JournalEntry): string {
    const parts = entry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter(Boolean);

    return parts.join('\n\n');
}

async function loadReflection(
    entryId: string,
    forceRegenerate: boolean,
    { setEntry, setData, setIsLoading, setError }: ReflectionSetters,
): Promise<void> {
    // A cached reflection is a source-of-truth for the initial mount, but
    // refresh() must force a fresh generation — otherwise editing an entry
    // leaves a stale reflection forever and "Regenerate" is a silent no-op.
    if (forceRegenerate) {
        reflectionCache.delete(entryId);
    }

    const cached = forceRegenerate ? undefined : reflectionCache.get(entryId);
    if (cached) {
        setIsLoading(false);
        setError(null);
        setData(cached);
    }

    setIsLoading(true);
    setError(null);

    try {
        const storedEntry = await getEntry(entryId);
        setEntry(storedEntry);

        if (!storedEntry) {
            setData(null);
            setError('Entry not found');
            return;
        }

        if (!cached) {
            const entryText = buildEntryText(storedEntry);
            const reflection = await generateEntryReflection({ entryText });
            reflectionCache.set(entryId, reflection);
            setData(reflection);
        }
    } catch (e) {
        setData(null);
        setError(e instanceof Error ? e.message : 'Failed to load reflection');
    } finally {
        setIsLoading(false);
    }
}

export function useEntryReflection(entryId?: string): UseEntryReflectionState {
    const resolvedEntryId = useMemo(() => {
        if (!entryId) return undefined;
        return Array.isArray(entryId) ? entryId[0] : entryId;
    }, [entryId]);

    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [data, setData] = useState<EntryReflectionResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (forceRegenerate = false): Promise<void> => {
        if (!resolvedEntryId) {
            setEntry(null);
            setData(null);
            setError('Missing entryId');
            return;
        }

        const loadKey = `${resolvedEntryId}:${forceRegenerate ? 'force' : 'cached'}`;
        const pending = inFlightLoads.get(loadKey);
        if (pending) return pending;

        const run = loadReflection(resolvedEntryId, forceRegenerate, {
            setEntry,
            setData,
            setIsLoading,
            setError,
        });
        inFlightLoads.set(loadKey, run);

        try {
            await run;
        } finally {
            if (inFlightLoads.get(loadKey) === run) {
                inFlightLoads.delete(loadKey);
            }
        }
    }, [resolvedEntryId]);

    // `refresh` must keep a stable identity: consumers list it in effect
    // dependency arrays, and an inline arrow here re-fires those effects on
    // every render.
    const refresh = useCallback(() => load(true), [load]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        entry,
        data,
        isLoading,
        error,
        refresh,
    };
}
