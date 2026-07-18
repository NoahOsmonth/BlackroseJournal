import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveModelContext } from './useActiveModelContext';
import {
    DEFAULT_GENERATION,
    GenerationSettings,
    loadGenerationSettings,
    resetGenerationSettings,
    sanitizeGenerationSettings,
    saveGenerationSettings,
} from '@/services/ai/generationSettings';
import type { ModelContextInfo } from '@/services/ai/modelContext';

export interface UseGenerationSettingsReturn {
    settings: GenerationSettings;
    modelContext: ModelContextInfo | null;
    contextError: string | null;
    isLoading: boolean;
    update: (partial: Partial<GenerationSettings>) => Promise<void>;
    reset: () => Promise<void>;
    refreshContext: () => Promise<void>;
}

export function useGenerationSettings(): UseGenerationSettingsReturn {
    const model = useActiveModelContext();
    const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_GENERATION);
    const [isLoading, setIsLoading] = useState(true);
    const settingsRef = useRef(settings);
    settingsRef.current = settings;
    const saveQueue = useRef(Promise.resolve());

    useEffect(() => {
        let mounted = true;
        loadGenerationSettings(model.context?.contextWindow)
            .then((loaded) => {
                if (mounted) {
                    settingsRef.current = loaded;
                    setSettings(loaded);
                }
            })
            .finally(() => mounted && setIsLoading(false));
        return () => {
            mounted = false;
        };
    }, [model.context?.contextWindow]);

    useEffect(() => {
        if (!model.context) return;
        setSettings((current) => {
            const next = sanitizeGenerationSettings(
                current,
                model.context?.contextWindow
            );
            settingsRef.current = next;
            return next;
        });
    }, [model.context]);

    const update = useCallback(async (partial: Partial<GenerationSettings>) => {
        const next = sanitizeGenerationSettings(
            { ...settingsRef.current, ...partial },
            model.context?.contextWindow
        );
        settingsRef.current = next;
        setSettings(next);
        // Serialize AsyncStorage writes so rapid slider commits cannot clobber each other.
        const run = saveQueue.current.then(() =>
            saveGenerationSettings(next, model.context?.contextWindow)
        );
        saveQueue.current = run.then(() => undefined, () => undefined);
        await run;
    }, [model.context?.contextWindow]);

    const reset = useCallback(async () => {
        const defaults = await resetGenerationSettings(model.context?.contextWindow);
        settingsRef.current = defaults;
        setSettings(defaults);
    }, [model.context?.contextWindow]);

    return {
        settings,
        modelContext: model.context,
        contextError: model.error,
        isLoading: isLoading || model.isLoading,
        update,
        reset,
        refreshContext: model.refresh,
    };
}
