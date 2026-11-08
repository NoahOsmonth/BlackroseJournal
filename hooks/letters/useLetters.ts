import { useCallback, useEffect, useState } from 'react';
import {
    createLetter,
    deleteLetter,
    listLetters,
} from '@/services/letters/lettersStorage';
import { useActiveAccountId } from '@/hooks/account/useActiveAccountId';
import { getLocalDateKey } from '@/utils/date';
import { toListEntries, type LetterListEntry } from '@/utils/letters';

export interface UseLettersReturn {
    readonly letters: LetterListEntry[];
    readonly isLoading: boolean;
    readonly error: string | null;
    readonly refresh: () => Promise<void>;
    readonly seal: (body: string, unlockDate: string) => Promise<boolean>;
    readonly discard: (id: string) => Promise<void>;
}

const LOAD_ERROR = 'Could not open your letters. Try again in a moment.';
const SAVE_ERROR = 'That letter could not be saved. Try again in a moment.';

/** Letters to your future self: read, seal and open. Reads once per mount. */
export function useLetters(): UseLettersReturn {
    const accountId = useActiveAccountId();
    const [letters, setLetters] = useState<LetterListEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const stored = await listLetters();
            setLetters(toListEntries(stored, getLocalDateKey()));
            setError(null);
        } catch {
            setLetters([]);
            setError(LOAD_ERROR);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!accountId) {
            setLetters([]);
            setIsLoading(false);
            return;
        }
        void refresh();
    }, [accountId, refresh]);

    const seal = useCallback(async (body: string, unlockDate: string): Promise<boolean> => {
        try {
            await createLetter({ body, unlockDate });
            await refresh();
            return true;
        } catch {
            setError(SAVE_ERROR);
            return false;
        }
    }, [refresh]);

    const discard = useCallback(async (id: string) => {
        try {
            await deleteLetter(id);
            await refresh();
        } catch {
            setError(LOAD_ERROR);
        }
    }, [refresh]);

    return { letters, isLoading, error, refresh, seal, discard };
}
