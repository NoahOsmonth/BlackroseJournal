import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { filterFreeModels, hostLabelFromBaseUrl, isFreeModelId } from '@/utils/ai/modelDisplay';
import type { CustomAiModel } from '@/services/ai/customModels';

export interface UseChatModelPickerReturn {
    visible: boolean;
    open: () => void;
    close: () => void;
    models: CustomAiModel[];
    recentModels: CustomAiModel[];
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
    const { refresh: refreshContext } = useActiveModelContext();
    const [visible, setVisible] = useState(false);

    const freeOnly = customAi.settings.freeOnly;
    const models = useMemo(() => {
        const list = freeOnly
            ? filterFreeModels(customAi.settings.models)
            : customAi.settings.models;
        return list;
    }, [customAi.settings.models, freeOnly]);

    const recentModels = useMemo(() => {
        const byId = new Map(models.map((model) => [model.id, model]));
        return customAi.settings.recentModelIds
            .map((id) => byId.get(id))
            .filter((model): model is CustomAiModel => Boolean(model));
    }, [customAi.settings.recentModelIds, models]);

    const hostLabel = hostLabelFromBaseUrl(
        customAi.draft.baseUrl || customAi.settings.baseUrl || 'https://openrouter.ai/api/v1'
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
