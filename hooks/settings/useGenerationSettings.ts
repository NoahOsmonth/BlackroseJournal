import { useCallback, useEffect, useState } from 'react';
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

    useEffect(() => {
        let mounted = true;
        loadGenerationSettings(model.context?.contextWindow)
            .then((loaded) => {
                if (mounted) setSettings(loaded);
            })
            .finally(() => mounted && setIsLoading(false));
        return () => {
            mounted = false;
        };
    }, [model.context?.contextWindow]);

    useEffect(() => {
        if (!model.context) return;
        setSettings((current) => sanitizeGenerationSettings(
            current,
            model.context?.contextWindow
        ));
    }, [model.context]);

    const update = useCallback(async (partial: Partial<GenerationSettings>) => {
        const next = sanitizeGenerationSettings(
            { ...settings, ...partial },
            model.context?.contextWindow
        );
        setSettings(next);
        setSettings(await saveGenerationSettings(next, model.context?.contextWindow));
    }, [model.context?.contextWindow, settings]);

    const reset = useCallback(async () => {
        setSettings(await resetGenerationSettings(model.context?.contextWindow));
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
