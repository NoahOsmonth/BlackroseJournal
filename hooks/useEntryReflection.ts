import { useCallback, useEffect, useMemo, useState } from 'react';

import { generateEntryReflection, type EntryReflectionResult } from '@/services/ai';
import { getEntry } from '@/services/journalStorage';
import type { JournalEntry } from '@/services/journalStorage.types';

interface UseEntryReflectionState {
    entry: JournalEntry | null;
    data: EntryReflectionResult | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const reflectionCache = new Map<string, EntryReflectionResult>();

function buildEntryText(entry: JournalEntry): string {
    const parts = entry.messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content.trim())
        .filter(Boolean);

    return parts.join('\n\n');
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

    const load = useCallback(async () => {
        if (!resolvedEntryId) {
            setEntry(null);
            setData(null);
            setError('Missing entryId');
            return;
        }

        const cached = reflectionCache.get(resolvedEntryId);
        if (cached) {
            setIsLoading(false);
            setError(null);
            setData(cached);
        }

        setIsLoading(true);
        setError(null);

        try {
            const storedEntry = await getEntry(resolvedEntryId);
            setEntry(storedEntry);

            if (!storedEntry) {
                setData(null);
                setError('Entry not found');
                return;
            }

            if (!cached) {
                const entryText = buildEntryText(storedEntry);
                const reflection = await generateEntryReflection({ entryText });
                reflectionCache.set(resolvedEntryId, reflection);
                setData(reflection);
            }
        } catch (e) {
            setData(null);
            setError(e instanceof Error ? e.message : 'Failed to load reflection');
        } finally {
            setIsLoading(false);
        }
    }, [resolvedEntryId]);

    useEffect(() => {
        load();
    }, [load]);

    return {
        entry,
        data,
        isLoading,
        error,
        refresh: load,
    };
}
