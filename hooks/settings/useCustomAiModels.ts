import { useCallback, useEffect, useState } from 'react';
import {
    CustomAiProviderSettings,
    CustomModelSettingsError,
    DEFAULT_FALLBACK_CONTEXT_WINDOW,
    fetchOpenAiCompatibleModels,
    getDefaultCustomAiProviderSettings,
    loadCustomAiProviderSettings,
    normalizeFallbackContextWindow,
    normalizeOpenAiBaseUrl,
    pickModelAfterFetch,
    readEnvProviderSeed,
    saveCustomAiProviderSettings,
    withManualModel,
    withSelectedModel,
} from '@/services/ai/customModels';

type StatusKind = 'idle' | 'success' | 'error';

interface CustomAiDraft {
    baseUrl: string;
    apiKey: string;
    fallbackContextWindow: string;
}

interface StatusState {
    kind: StatusKind;
    message: string;
}

export interface UseCustomAiModelsReturn {
    settings: CustomAiProviderSettings;
    draft: CustomAiDraft;
    isLoading: boolean;
    isFetching: boolean;
    isSaving: boolean;
    status: StatusState;
    setBaseUrl: (value: string) => void;
    setApiKey: (value: string) => void;
    setFallbackContextWindow: (value: string) => void;
    fetchModels: () => Promise<void>;
    saveSettings: () => Promise<void>;
    selectModel: (modelId: string) => Promise<void>;
    addManualModel: (modelId: string) => Promise<void>;
    setEnabled: (enabled: boolean) => Promise<void>;
    setFreeOnly: (freeOnly: boolean) => Promise<void>;
}

const EMPTY_STATUS: StatusState = { kind: 'idle', message: '' };

function toDraft(settings: CustomAiProviderSettings): CustomAiDraft {
    return {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        fallbackContextWindow: String(settings.fallbackContextWindow),
    };
}

function errorMessage(error: unknown): string {
    if (error instanceof CustomModelSettingsError) return error.message;
    return error instanceof Error ? error.message : 'Something went wrong.';
}

function selectedOrFirst(settings: CustomAiProviderSettings): string | null {
    return settings.models.some((model) => model.id === settings.selectedModelId)
        ? settings.selectedModelId
        : settings.models[0]?.id ?? null;
}

function requireApiKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new CustomModelSettingsError('API key is required.');
    return trimmed;
}

export function useCustomAiModels(): UseCustomAiModelsReturn {
    const [settings, setSettings] = useState(getDefaultCustomAiProviderSettings);
    const [draft, setDraft] = useState<CustomAiDraft>(() => toDraft(settings));
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<StatusState>(EMPTY_STATUS);

    useEffect(() => {
        let mounted = true;
        loadCustomAiProviderSettings()
            .then((loaded) => {
                if (!mounted) return;
                // First-run / empty storage already includes env seed in defaults.
                setSettings(loaded);
                setDraft(toDraft(loaded));
                if (loaded.freeOnly && loaded.selectedModelId === null && loaded.models.length > 0) {
                    setStatus({
                        kind: 'error',
                        message: 'Previous model unavailable (not free). Choose a free model.',
                    });
                }
            })
            .catch((error) => setStatus({ kind: 'error', message: errorMessage(error) }))
            .finally(() => mounted && setIsLoading(false));
        return () => {
            mounted = false;
        };
    }, []);

    const persist = useCallback(async (next: CustomAiProviderSettings) => {
        const saved = await saveCustomAiProviderSettings(next);
        setSettings(saved);
        setDraft(toDraft(saved));
        return saved;
    }, []);

    const setBaseUrl = useCallback((value: string) => {
        setDraft((current) => ({ ...current, baseUrl: value }));
    }, []);

    const setApiKey = useCallback((value: string) => {
        setDraft((current) => ({ ...current, apiKey: value }));
    }, []);

    const setFallbackContextWindow = useCallback((value: string) => {
        setDraft((current) => ({ ...current, fallbackContextWindow: value }));
    }, []);

    const fetchModels = useCallback(async () => {
        setIsFetching(true);
        setStatus(EMPTY_STATUS);
        try {
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            const result = await fetchOpenAiCompatibleModels({
                baseUrl: draft.baseUrl,
                apiKey: draft.apiKey,
                fallbackContextWindow: fallback,
                freeOnly: settings.freeOnly,
            });
            const seed = readEnvProviderSeed();
            const selectedModelId = pickModelAfterFetch(
                result.models,
                settings.selectedModelId,
                seed.model
            );
            await persist({
                ...settings,
                baseUrl: result.baseUrl,
                apiKey: requireApiKey(draft.apiKey),
                fallbackContextWindow: fallback,
                models: result.models,
                selectedModelId,
                lastFetchedAt: result.fetchedAt,
                lastFetchError: undefined,
            });
            setStatus({
                kind: 'success',
                message: settings.freeOnly
                    ? `${result.models.length} free models loaded.`
                    : `${result.models.length} models loaded.`,
            });
        } catch (error) {
            const message = errorMessage(error);
            setSettings((current) => ({ ...current, lastFetchError: message }));
            setStatus({ kind: 'error', message });
        } finally {
            setIsFetching(false);
        }
    }, [draft, persist, settings]);

    const saveSettings = useCallback(async () => {
        setIsSaving(true);
        setStatus(EMPTY_STATUS);
        try {
            const baseUrl = normalizeOpenAiBaseUrl(draft.baseUrl);
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            const selectedModelId = selectedOrFirst(settings);
            if (!selectedModelId) throw new CustomModelSettingsError('Fetch and select a model first.');
            await persist({
                ...settings,
                enabled: true,
                baseUrl,
                apiKey: requireApiKey(draft.apiKey),
                fallbackContextWindow: fallback,
                selectedModelId,
            });
            setStatus({ kind: 'success', message: 'AI model saved and enabled.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        } finally {
            setIsSaving(false);
        }
    }, [draft, persist, settings]);

    const selectModel = useCallback(async (modelId: string) => {
        try {
            const next = withSelectedModel(settings, modelId);
            await persist(next);
            setStatus({ kind: 'success', message: 'Model selected and enabled.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [persist, settings]);

    const addManualModel = useCallback(async (modelId: string) => {
        try {
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            const next = withManualModel(settings, modelId, fallback);
            await persist(next);
            setStatus({ kind: 'success', message: `Added ${modelId} and enabled it.` });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [draft.fallbackContextWindow, persist, settings]);

    const setEnabled = useCallback(async (enabled: boolean) => {
        if (enabled && !selectedOrFirst(settings)) {
            setStatus({ kind: 'error', message: 'Fetch and select a model first.' });
            return;
        }
        await persist({ ...settings, enabled, selectedModelId: selectedOrFirst(settings) });
    }, [persist, settings]);

    const setFreeOnly = useCallback(async (freeOnly: boolean) => {
        const { filterFreeModels, isFreeModelId } = await import('@/utils/ai/modelDisplay');
        let selectedModelId = settings.selectedModelId;
        let models = settings.models;
        if (freeOnly) {
            models = filterFreeModels(settings.models);
            if (selectedModelId && !isFreeModelId(selectedModelId)) {
                selectedModelId = models[0]?.id ?? null;
            } else if (selectedModelId && !models.some((m) => m.id === selectedModelId)) {
                selectedModelId = models[0]?.id ?? null;
            }
        }
        await persist({
            ...settings,
            freeOnly,
            models,
            selectedModelId,
        });
        setStatus({
            kind: 'success',
            message: freeOnly ? 'Free models only is on.' : 'All models allowed (paid may incur charges).',
        });
    }, [persist, settings]);

    return {
        settings,
        draft,
        isLoading,
        isFetching,
        isSaving,
        status,
        setBaseUrl,
        setApiKey,
        setFallbackContextWindow,
        fetchModels,
        saveSettings,
        selectModel,
        addManualModel,
        setEnabled,
        setFreeOnly,
    };
}

export { DEFAULT_FALLBACK_CONTEXT_WINDOW };
