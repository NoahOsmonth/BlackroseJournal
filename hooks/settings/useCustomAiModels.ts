import { useCallback, useEffect, useState } from 'react';
import {
    CustomAiProviderSettings,
    CustomModelSettingsError,
    DEFAULT_FALLBACK_CONTEXT_WINDOW,
    ProviderProfile,
    addProviderProfile,
    createProviderProfile,
    fetchOpenAiCompatibleModels,
    getActiveProfile,
    getDefaultCustomAiProviderSettings,
    loadCustomAiProviderSettings,
    normalizeFallbackContextWindow,
    normalizeOpenAiBaseUrl,
    pickModelAfterFetch,
    readEnvProviderSeed,
    removeProviderProfile,
    saveCustomAiProviderSettings,
    setActiveProfile,
    withManualModel,
    withSelectedModel,
    withUpdatedProfile,
} from '@/services/ai/customModels';

type StatusKind = 'idle' | 'success' | 'error';

interface CustomAiDraft {
    label: string;
    baseUrl: string;
    apiKey: string;
    fallbackContextWindow: string;
    /** Raw, comma-separated filter patterns as typed by the user. */
    modelFilterPatterns: string;
}

interface StatusState {
    kind: StatusKind;
    message: string;
}

export interface UseCustomAiModelsReturn {
    settings: CustomAiProviderSettings;
    profile: ProviderProfile | null;
    draft: CustomAiDraft;
    isLoading: boolean;
    isFetching: boolean;
    isSaving: boolean;
    status: StatusState;
    setLabel: (value: string) => void;
    setBaseUrl: (value: string) => void;
    setApiKey: (value: string) => void;
    setFallbackContextWindow: (value: string) => void;
    setModelFilterPatterns: (value: string) => void;
    fetchModels: () => Promise<void>;
    saveSettings: () => Promise<void>;
    selectModel: (modelId: string) => Promise<void>;
    addManualModel: (modelId: string) => Promise<void>;
    setEnabled: (enabled: boolean) => Promise<void>;
    addProfile: () => Promise<void>;
    removeActiveProfile: () => Promise<void>;
    selectProfile: (profileId: string) => Promise<void>;
}

const EMPTY_STATUS: StatusState = { kind: 'idle', message: '' };

/** Split the user's comma/newline separated filter string into patterns. */
export function parseFilterPatterns(value: string): string[] {
    return value
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function toDraft(profile: ProviderProfile | null): CustomAiDraft {
    return {
        label: profile?.label ?? '',
        baseUrl: profile?.baseUrl ?? '',
        apiKey: profile?.apiKey ?? '',
        fallbackContextWindow: String(
            profile?.fallbackContextWindow ?? DEFAULT_FALLBACK_CONTEXT_WINDOW
        ),
        modelFilterPatterns: (profile?.modelFilterPatterns ?? []).join(', '),
    };
}

function errorMessage(error: unknown): string {
    if (error instanceof CustomModelSettingsError) return error.message;
    return error instanceof Error ? error.message : 'Something went wrong.';
}

function selectedOrFirst(profile: ProviderProfile | null): string | null {
    if (!profile) return null;
    return profile.models.some((model) => model.id === profile.selectedModelId)
        ? profile.selectedModelId
        : profile.models[0]?.id ?? null;
}

function requireApiKey(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) throw new CustomModelSettingsError('API key is required.');
    return trimmed;
}

export function useCustomAiModels(): UseCustomAiModelsReturn {
    const [settings, setSettings] = useState(getDefaultCustomAiProviderSettings);
    const [draft, setDraft] = useState<CustomAiDraft>(() => toDraft(null));
    const [isLoading, setIsLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<StatusState>(EMPTY_STATUS);

    const profile = getActiveProfile(settings);

    useEffect(() => {
        let mounted = true;
        loadCustomAiProviderSettings()
            .then((loaded) => {
                if (!mounted) return;
                setSettings(loaded);
                setDraft(toDraft(getActiveProfile(loaded)));
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
        setDraft(toDraft(getActiveProfile(saved)));
        return saved;
    }, []);

    const setLabel = useCallback((value: string) => {
        setDraft((current) => ({ ...current, label: value }));
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

    const setModelFilterPatterns = useCallback((value: string) => {
        setDraft((current) => ({ ...current, modelFilterPatterns: value }));
    }, []);

    const fetchModels = useCallback(async () => {
        setIsFetching(true);
        setStatus(EMPTY_STATUS);
        try {
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            const patterns = parseFilterPatterns(draft.modelFilterPatterns);
            const result = await fetchOpenAiCompatibleModels({
                baseUrl: draft.baseUrl,
                apiKey: draft.apiKey,
                fallbackContextWindow: fallback,
                modelFilterPatterns: patterns,
            });
            const seed = readEnvProviderSeed();
            const selectedModelId = pickModelAfterFetch(
                result.models,
                profile?.selectedModelId ?? null,
                seed.model
            );
            const base = profile ?? createProviderProfile();
            await persist(withUpdatedProfile(settings, {
                ...base,
                label: draft.label.trim() || base.label,
                baseUrl: result.baseUrl,
                apiKey: requireApiKey(draft.apiKey),
                fallbackContextWindow: fallback,
                modelFilterPatterns: patterns,
                models: result.models,
                selectedModelId,
                lastFetchedAt: result.fetchedAt,
                lastFetchError: undefined,
                updatedAt: Date.now(),
            }));
            setStatus({
                kind: 'success',
                message: `${result.models.length} model${result.models.length === 1 ? '' : 's'} loaded.`,
            });
        } catch (error) {
            const message = errorMessage(error);
            if (profile) {
                setSettings((current) => withUpdatedProfile(current, {
                    ...profile,
                    lastFetchError: message,
                }));
            }
            setStatus({ kind: 'error', message });
        } finally {
            setIsFetching(false);
        }
    }, [draft, persist, profile, settings]);

    const saveSettings = useCallback(async () => {
        setIsSaving(true);
        setStatus(EMPTY_STATUS);
        try {
            const baseUrl = normalizeOpenAiBaseUrl(draft.baseUrl);
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            const selectedModelId = selectedOrFirst(profile);
            if (!selectedModelId) {
                throw new CustomModelSettingsError('Fetch and select a model first.');
            }
            const base = profile ?? createProviderProfile();
            await persist(withUpdatedProfile(settings, {
                ...base,
                label: draft.label.trim() || base.label,
                baseUrl,
                apiKey: requireApiKey(draft.apiKey),
                fallbackContextWindow: fallback,
                modelFilterPatterns: parseFilterPatterns(draft.modelFilterPatterns),
                selectedModelId,
                updatedAt: Date.now(),
            }));
            setStatus({ kind: 'success', message: 'Provider saved.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        } finally {
            setIsSaving(false);
        }
    }, [draft, persist, profile, settings]);

    const selectModel = useCallback(async (modelId: string) => {
        try {
            if (!profile) throw new CustomModelSettingsError('Add a provider first.');
            await persist({
                ...withUpdatedProfile(settings, withSelectedModel(profile, modelId)),
                enabled: true,
            });
            setStatus({ kind: 'success', message: 'Model selected.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [persist, profile, settings]);

    const addManualModel = useCallback(async (modelId: string) => {
        try {
            if (!profile) throw new CustomModelSettingsError('Add a provider first.');
            const fallback = normalizeFallbackContextWindow(draft.fallbackContextWindow);
            await persist({
                ...withUpdatedProfile(settings, withManualModel(profile, modelId, fallback)),
                enabled: true,
            });
            setStatus({ kind: 'success', message: `Added ${modelId}.` });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [draft.fallbackContextWindow, persist, profile, settings]);

    const setEnabled = useCallback(async (enabled: boolean) => {
        if (enabled && !selectedOrFirst(profile)) {
            setStatus({ kind: 'error', message: 'Fetch and select a model first.' });
            return;
        }
        await persist({
            ...settings,
            enabled,
            profiles: profile
                ? settings.profiles.map((entry) => (entry.id === profile.id
                    ? { ...entry, selectedModelId: selectedOrFirst(profile) }
                    : entry))
                : settings.profiles,
        });
    }, [persist, profile, settings]);

    const addProfile = useCallback(async () => {
        try {
            await persist(addProviderProfile(settings, createProviderProfile({
                label: `Provider ${settings.profiles.length + 1}`,
            })));
            setStatus({ kind: 'success', message: 'New provider added. Enter its details.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [persist, settings]);

    const removeActiveProfile = useCallback(async () => {
        try {
            if (!profile) return;
            await persist(removeProviderProfile(settings, profile.id));
            setStatus({ kind: 'success', message: 'Provider removed.' });
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [persist, profile, settings]);

    const selectProfile = useCallback(async (profileId: string) => {
        try {
            await persist(setActiveProfile(settings, profileId));
        } catch (error) {
            setStatus({ kind: 'error', message: errorMessage(error) });
        }
    }, [persist, settings]);

    return {
        settings,
        profile,
        draft,
        isLoading,
        isFetching,
        isSaving,
        status,
        setLabel,
        setBaseUrl,
        setApiKey,
        setFallbackContextWindow,
        setModelFilterPatterns,
        fetchModels,
        saveSettings,
        selectModel,
        addManualModel,
        setEnabled,
        addProfile,
        removeActiveProfile,
        selectProfile,
    };
}

export { DEFAULT_FALLBACK_CONTEXT_WINDOW };
