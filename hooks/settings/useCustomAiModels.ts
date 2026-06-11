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
    saveCustomAiProviderSettings,
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
    setEnabled: (enabled: boolean) => Promise<void>;
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
                setSettings(loaded);
                setDraft(toDraft(loaded));
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
            });
            const selectedModelId = result.models.some((model) => (
                model.id === settings.selectedModelId
            )) ? settings.selectedModelId : result.models[0]?.id ?? null;
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
            setStatus({ kind: 'success', message: `${result.models.length} models loaded.` });
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
            setStatus({ kind: 'success', message: 'Custom model saved and enabled.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        } finally {
            setIsSaving(false);
        }
    }, [draft, persist, settings]);

    const selectModel = useCallback(async (modelId: string) => {
        const selected = settings.models.some((model) => model.id === modelId);
        if (!selected) {
            setStatus({ kind: 'error', message: 'Selected model is not available.' });
            return;
        }

        await persist({ ...settings, enabled: true, selectedModelId: modelId });
        setStatus({ kind: 'success', message: 'Custom model selected and enabled.' });
    }, [persist, settings]);

    const setEnabled = useCallback(async (enabled: boolean) => {
        if (enabled && !selectedOrFirst(settings)) {
            setStatus({ kind: 'error', message: 'Fetch and select a model first.' });
            return;
        }
        await persist({ ...settings, enabled, selectedModelId: selectedOrFirst(settings) });
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
        setEnabled,
    };
}

export { DEFAULT_FALLBACK_CONTEXT_WINDOW };
