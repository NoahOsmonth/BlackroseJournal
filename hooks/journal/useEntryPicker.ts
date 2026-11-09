/**
 * The Archive's pick mode, kept out of the screen so it can be tested without a
 * renderer. It owns what is picked, which sheet is open, and the one write that
 * finishes a batch — the screen only renders what this returns.
 */
import { useCallback, useMemo, useState } from 'react';

import type { BulkLabelMode } from '@/components/entries/BulkLabelSheet';
import { sharedLabels } from '@/utils/bulkLabels';

interface PickerDeps {
    readonly tagsByEntry: Readonly<Record<string, readonly string[]>>;
    readonly addTagMany: (entryIds: readonly string[], label: string) => Promise<void>;
    readonly removeTagMany: (entryIds: readonly string[], label: string) => Promise<void>;
}

export interface UseEntryPickerReturn {
    readonly picking: boolean;
    readonly picked: readonly string[];
    readonly pickedSet: ReadonlySet<string>;
    /** Labels every picked entry carries; empty means Remove has nothing to offer. */
    readonly shared: readonly string[];
    readonly sheetOpen: boolean;
    readonly mode: BulkLabelMode;
    /** Start or stop picking; stopping always drops the picks. */
    readonly togglePicking: () => void;
    /** Toggle one row while picking. */
    readonly toggle: (entryId: string) => void;
    /** Replace the picks with every id given (the rows currently on screen). */
    readonly pickAll: (entryIds: readonly string[]) => void;
    readonly openSheet: (mode: BulkLabelMode) => void;
    readonly closeSheet: () => void;
    /** Runs the batch through the hook, then leaves pick mode. */
    readonly submit: (label: string) => void;
}

export function useEntryPicker({ tagsByEntry, addTagMany, removeTagMany }: PickerDeps): UseEntryPickerReturn {
    const [picking, setPicking] = useState(false);
    const [picked, setPicked] = useState<readonly string[]>([]);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [mode, setMode] = useState<BulkLabelMode>('add');

    const pickedSet = useMemo(() => new Set(picked), [picked]);
    const shared = useMemo(() => sharedLabels(picked, tagsByEntry), [picked, tagsByEntry]);

    const togglePicking = useCallback(() => {
        setPicking((was) => {
            if (was) setPicked([]);
            return !was;
        });
        setSheetOpen(false);
    }, []);

    const toggle = useCallback((entryId: string) => {
        setPicked((prev) => (prev.includes(entryId)
            ? prev.filter((id) => id !== entryId)
            : [...prev, entryId]));
    }, []);

    const pickAll = useCallback((entryIds: readonly string[]) => {
        setPicked(Array.from(new Set(entryIds)));
    }, []);

    const openSheet = useCallback((next: BulkLabelMode) => {
        setMode(next);
        setSheetOpen(true);
    }, []);

    const closeSheet = useCallback(() => { setSheetOpen(false); }, []);

    const submit = useCallback((label: string) => {
        const ids = picked;
        setSheetOpen(false);
        setPicking(false);
        setPicked([]);
        if (ids.length === 0) return;
        void (mode === 'add' ? addTagMany(ids, label) : removeTagMany(ids, label));
    }, [picked, mode, addTagMany, removeTagMany]);

    return { picking, picked, pickedSet, shared, sheetOpen, mode, togglePicking, toggle, pickAll, openSheet, closeSheet, submit };
}
