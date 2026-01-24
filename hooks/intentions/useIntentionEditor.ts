import { useCallback, useEffect, useState } from 'react';
import { getIntention, updateIntention } from '@/services/intentions/intentionsStorage';
import { Intention, IntentionUpdateInput } from '@/services/intentions/intentionsStorage.types';

export interface IntentionEditorValues {
    title: string;
    description: string;
}

interface UseIntentionEditorReturn {
    intention: Intention | null;
    values: IntentionEditorValues;
    isLoading: boolean;
    error: Error | null;
    setValues: (values: IntentionEditorValues) => void;
    save: () => Promise<Intention | null>;
    refresh: () => Promise<void>;
}

const defaultValues: IntentionEditorValues = {
    title: '',
    description: '',
};

export function useIntentionEditor(intentionId?: string): UseIntentionEditorReturn {
    const [intention, setIntention] = useState<Intention | null>(null);
    const [values, setValues] = useState<IntentionEditorValues>(defaultValues);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!intentionId) {
            setIntention(null);
            setValues(defaultValues);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const loaded = await getIntention(intentionId);
            setIntention(loaded);
            setValues({
                title: loaded?.title ?? '',
                description: loaded?.description ?? '',
            });
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load intention'));
        } finally {
            setIsLoading(false);
        }
    }, [intentionId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const save = useCallback(async () => {
        if (!intentionId) return null;
        const updates: IntentionUpdateInput = {
            title: values.title,
            description: values.description,
        };
        const updated = await updateIntention(intentionId, updates);
        if (updated) {
            setIntention(updated);
        }
        return updated;
    }, [intentionId, values.description, values.title]);

    return {
        intention,
        values,
        isLoading,
        error,
        setValues,
        save,
        refresh,
    };
}
