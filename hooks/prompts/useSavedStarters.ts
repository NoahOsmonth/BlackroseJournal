/**
 * Saved starting points for the browse shelf. One subscription to the
 * service owner; a plain subscription, not a focus effect (round 34: that
 * coupled the hook to a navigation object and broke plain renders). Toggles are optimistic so a
 * heart tap feels instant, and the service remains the source of truth.
 */
import { useCallback, useEffect, useState } from 'react';

import {
    listSavedStarters,
    subscribeSavedStarters,
    toggleSavedStarter,
} from '@/services/prompts/savedPromptPacks';

export interface UseSavedStartersReturn {
    readonly savedIds: readonly string[];
    readonly isLoading: boolean;
    readonly toggle: (id: string) => void;
    readonly has: (id: string) => boolean;
}

export function useSavedStarters(): UseSavedStartersReturn {
    const [savedIds, setSavedIds] = useState<readonly string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        void listSavedStarters().then((ids) => {
            if (active) {
                setSavedIds(ids);
                setIsLoading(false);
            }
        }).catch(() => { if (active) setIsLoading(false); });
        const unsubscribe = subscribeSavedStarters((ids) => {
            if (active) setSavedIds(ids);
        });
        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const toggle = useCallback((id: string) => {
        setSavedIds((current) => (
            current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]
        ));
        void toggleSavedStarter(id).then((ids) => setSavedIds(ids)).catch(() => {
            void listSavedStarters().then((ids) => setSavedIds(ids)).catch(() => undefined);
        });
    }, []);

    const has = useCallback((id: string) => savedIds.includes(id), [savedIds]);

    return { savedIds, isLoading, toggle, has };
}
