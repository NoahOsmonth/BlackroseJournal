import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { hostLabelFromBaseUrl } from '@/utils/ai/modelDisplay';
import type { ChatModelOption } from '@/features/chat/modelPicker.types';

export interface UseChatModelPickerReturn {
    visible: boolean;
    open: () => void;
    close: () => void;
    models: ChatModelOption[];
    recentModels: ChatModelOption[];
    selectedModelId: string | null;
    /** The active provider's filter patterns, for the sheet's filter marker. */
    filterPatterns: readonly string[];
    hostLabel: string;
    hasApiKey: boolean;
    isLoading: boolean;
    isFetching: boolean;
    error: string | null;
    selectModel: (modelId: string) => Promise<void>;
    refreshModels: () => Promise<void>;
    openSettings: () => void;
}

/**
 * View-model for the chat model picker. Direct (BYOK) is the only mode — there
 * is no managed gateway — so this reads the active provider profile.
 */
export function useChatModelPicker(options?: {
    readonly disabled?: boolean;
}): UseChatModelPickerReturn {
    const router = useRouter();
    const customAi = useCustomAiModels();
    const { refresh: refreshContext } = useActiveModelContext();
    const [visible, setVisible] = useState(false);

    // Bootstrap: when a provider is configured but no models are cached yet,
    // fetch them once (skips after success/error).
    useEffect(() => {
        if (customAi.isLoading || customAi.isFetching) return;
        if ((customAi.profile?.models.length ?? 0) > 0) return;
        if (customAi.status.kind !== 'idle') return;
        if (!(customAi.draft.baseUrl.trim() && customAi.draft.apiKey.trim())) return;
        void customAi.fetchModels();
    }, [customAi]);

    const models = useMemo<ChatModelOption[]>(
        () => customAi.profile?.models ?? [],
        [customAi.profile?.models]
    );

    const recentModels = useMemo(() => {
        const byId = new Map<string, ChatModelOption>(
            models.map((model): [string, ChatModelOption] => [model.id, model])
        );
        return (customAi.profile?.recentModelIds ?? [])
            .map((id) => byId.get(id))
            .filter((model): model is ChatModelOption => Boolean(model));
    }, [customAi.profile?.recentModelIds, models]);

    const hostLabel = hostLabelFromBaseUrl(
        customAi.draft.baseUrl || customAi.profile?.baseUrl || ''
    );

    const hasApiKey = Boolean(
        (customAi.draft.apiKey || customAi.profile?.apiKey || '').trim()
    );

    const open = useCallback(() => {
        if (options?.disabled) return;
        setVisible(true);
    }, [options?.disabled]);

    const close = useCallback(() => setVisible(false), []);

    const selectModel = useCallback(async (modelId: string) => {
        await customAi.selectModel(modelId);
        await refreshContext();
        setVisible(false);
    }, [customAi, refreshContext]);

    const refreshModels = useCallback(async () => {
        await customAi.fetchModels();
        await refreshContext();
    }, [customAi, refreshContext]);

    const openSettings = useCallback(() => {
        setVisible(false);
        router.navigate('/(tabs)/settings');
    }, [router]);

    const error = customAi.status.kind === 'error' ? customAi.status.message : null;

    return {
        visible,
        open,
        close,
        models,
        recentModels,
        selectedModelId: customAi.profile?.selectedModelId ?? null,
        filterPatterns: customAi.profile?.modelFilterPatterns ?? [],
        hostLabel,
        hasApiKey,
        isLoading: customAi.isLoading,
        isFetching: customAi.isFetching,
        error,
        selectModel,
        refreshModels,
        openSettings,
    };
}
