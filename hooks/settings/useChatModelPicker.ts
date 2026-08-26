import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useActiveModelContext } from '@/hooks/settings/useActiveModelContext';
import { useManagedAiCatalog } from '@/hooks/settings/useManagedAiCatalog';
import { filterFreeModels, hostLabelFromBaseUrl, isFreeModelId } from '@/utils/ai/modelDisplay';
import type { ChatModelOption } from '@/features/chat/modelPicker.types';

export interface UseChatModelPickerReturn {
    mode: 'managed' | 'byok';
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
    const managedAi = useManagedAiCatalog({
        enabled: !customAi.isLoading && !customAi.settings.enabled,
    });
    const { refresh: refreshContext } = useActiveModelContext();
    const [visible, setVisible] = useState(false);

    const mode = customAi.settings.enabled ? 'byok' : 'managed';
    const freeOnly = mode === 'byok' ? customAi.settings.freeOnly : false;
    const models = useMemo<ChatModelOption[]>(() => {
        if (mode === 'managed') {
            return managedAi.models.map((model) => ({
                id: model.id,
                name: model.label,
                publicId: model.publicModelId,
                contextWindow: model.contextWindow,
                availability: model.availability,
            }));
        }
        const list = freeOnly
            ? filterFreeModels(customAi.settings.models)
            : customAi.settings.models;
        return list;
    }, [customAi.settings.models, freeOnly, managedAi.models, mode]);

    const recentModels = useMemo(() => {
        const byId = new Map<string, ChatModelOption>(
            models.map((model): [string, ChatModelOption] => [model.id, model])
        );
        if (mode === 'managed') return [];
        return customAi.settings.recentModelIds
            .map((id) => byId.get(id))
            .filter((model): model is ChatModelOption => Boolean(model));
    }, [customAi.settings.recentModelIds, mode, models]);

    const hostLabel = mode === 'managed'
        ? 'Blackrose managed'
        : hostLabelFromBaseUrl(
            customAi.draft.baseUrl || customAi.settings.baseUrl || 'https://openrouter.ai/api/v1'
        );

    const hasApiKey = mode === 'managed' || Boolean(
        (customAi.draft.apiKey || customAi.settings.apiKey).trim()
    );

    const open = useCallback(() => {
        if (options?.disabled) return;
        setVisible(true);
    }, [options?.disabled]);

    const close = useCallback(() => setVisible(false), []);

    const selectModel = useCallback(async (modelId: string) => {
        if (mode === 'managed') {
            const model = managedAi.models.find((candidate) => candidate.id === modelId);
            if (!model || model.availability === 'unavailable') return;
            await managedAi.selectModel(modelId);
            await refreshContext();
            setVisible(false);
            return;
        }
        if (freeOnly && !isFreeModelId(modelId)) return;
        await customAi.selectModel(modelId);
        await refreshContext();
        setVisible(false);
    }, [customAi, freeOnly, managedAi, mode, refreshContext]);

    const refreshModels = useCallback(async () => {
        if (mode === 'managed') {
            await managedAi.refresh();
            await refreshContext();
            return;
        }
        await customAi.fetchModels();
        await refreshContext();
    }, [customAi, managedAi, mode, refreshContext]);

    const openSettings = useCallback(() => {
        setVisible(false);
        router.navigate('/(tabs)/settings');
    }, [router]);

    const managedSelectionError = managedAi.selection.availability === 'unavailable'
        ? 'Your selected managed model is unavailable. Choose another model to continue.'
        : null;
    const error = mode === 'managed'
        ? managedAi.error ?? managedSelectionError
        : customAi.status.kind === 'error' ? customAi.status.message : null;

    return {
        mode,
        visible,
        open,
        close,
        models,
        recentModels,
        selectedModelId: mode === 'managed'
            ? managedAi.selection.selectedModelId
            : customAi.settings.selectedModelId,
        freeOnly,
        hostLabel,
        hasApiKey,
        isLoading: mode === 'managed' ? managedAi.isLoading : customAi.isLoading,
        isFetching: mode === 'managed' ? managedAi.isRefreshing : customAi.isFetching,
        error,
        selectModel,
        refreshModels,
        openSettings,
    };
}
