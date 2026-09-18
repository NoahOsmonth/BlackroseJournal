import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { hasEnvDirectApiKey } from '@/services/ai/directConfig';
import { DEFAULT_AI_BASE_URL, filterFreeModels, hostLabelFromBaseUrl, isFreeModelId } from '@/utils/ai/modelDisplay';
import type { ChatModelOption } from '@/features/chat/modelPicker.types';

export interface UseChatModelPickerReturn {
    mode: 'byok';
    visible: boolean;
    open: () => void;
    close: () => void;
    models: ChatModelOption[];
    recentModels: ChatModelOption[];
    selectedModelId: string | null;
    freeOnly: boolean;
    hostLabel: string;
    hasApiKey: boolean;
    isLoading: boolean;
    isFetching: boolean;
    error: string | null;
    selectModel: (modelId: string) => Promise<void>;
    refreshModels: () => Promise<void>;
    openSettings: () => void;
}

export function useChatModelPicker(options?: {
    readonly disabled?: boolean;
}): UseChatModelPickerReturn {
    const router = useRouter();
    const customAi = useCustomAiModels();
    // The picker mirrors the transport: direct (BYOK) is the only mode.
    const mode = customAi.settings.enabled || hasEnvDirectApiKey() ? 'byok' : 'byok';
    const { refresh: refreshContext } = useActiveModelContext();
    const [visible, setVisible] = useState(false);

    // Bootstrap: when direct mode is active but no models are loaded yet, fetch
    // them from the configured gateway once (skips after success/error).
    useEffect(() => {
        if (customAi.isLoading || customAi.isFetching) return;
        if (customAi.settings.models.length > 0) return;
        if (customAi.status.kind !== 'idle') return;
        if (!(customAi.draft.baseUrl.trim() && customAi.draft.apiKey.trim())) return;
        void customAi.fetchModels();
    }, [customAi]);
    const freeOnly = customAi.settings.freeOnly;
    const models = useMemo<ChatModelOption[]>(() => {
        return freeOnly
            ? filterFreeModels(customAi.settings.models)
            : customAi.settings.models;
    }, [customAi.settings.models, freeOnly]);

    const recentModels = useMemo(() => {
        const byId = new Map<string, ChatModelOption>(
            models.map((model): [string, ChatModelOption] => [model.id, model])
        );
        return customAi.settings.recentModelIds
            .map((id) => byId.get(id))
            .filter((model): model is ChatModelOption => Boolean(model));
    }, [customAi.settings.recentModelIds, models]);

    const hostLabel = hostLabelFromBaseUrl(
        customAi.draft.baseUrl || customAi.settings.baseUrl || DEFAULT_AI_BASE_URL
    );

    const hasApiKey = Boolean(
        (customAi.draft.apiKey || customAi.settings.apiKey).trim()
    );

    const open = useCallback(() => {
        if (options?.disabled) return;
        setVisible(true);
    }, [options?.disabled]);

    const close = useCallback(() => setVisible(false), []);

    const selectModel = useCallback(async (modelId: string) => {
        if (freeOnly && !isFreeModelId(modelId)) return;
        await customAi.selectModel(modelId);
        await refreshContext();
        setVisible(false);
    }, [customAi, freeOnly, refreshContext]);

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
        mode,
        visible,
        open,
        close,
        models,
        recentModels,
        selectedModelId: customAi.settings.selectedModelId,
        freeOnly,
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
