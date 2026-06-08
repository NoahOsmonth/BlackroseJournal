import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { UseCustomAiModelsReturn } from '@/hooks/settings/useCustomAiModels';
import type { CustomAiModel } from '@/services/ai/customModels';
import { SettingsSection } from './SettingsSection';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type CustomModelSettingsSectionProps = UseCustomAiModelsReturn;

const INPUT_CLASS = [
    'rounded-xl border border-divider-light dark:border-divider-dark',
    'bg-background-light dark:bg-background-dark px-3 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');
const SECONDARY_TEXT = 'text-subtext-light dark:text-subtext-dark';
const MAX_VISIBLE_MODELS = 30;

function contextLabel(model: CustomAiModel): string {
    const formatted = model.contextWindow.toLocaleString();
    if (model.contextWindowSource === 'api') return `${formatted} tokens`;
    if (model.contextWindowSource === 'known') return `${formatted} tokens, mapped`;
    return `${formatted} tokens, fallback`;
}

function ActionButton({
    label,
    icon,
    busy,
    disabled,
    onPress,
}: {
    readonly label: string;
    readonly icon: IoniconName;
    readonly busy?: boolean;
    readonly disabled?: boolean;
    readonly onPress: () => void;
}) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? '#111827' : '#111827';
    const inactive = disabled || busy;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={inactive}
            className={`flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 ${
                inactive ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityState={{ disabled: inactive }}
        >
            <Ionicons name={icon} size={18} color={iconColor} />
            <Text className="font-bold text-text-light dark:text-text-light">
                {busy ? 'Working...' : label}
            </Text>
        </TouchableOpacity>
    );
}

function ModelRow({
    model,
    selected,
    onPress,
}: {
    readonly model: CustomAiModel;
    readonly selected: boolean;
    readonly onPress: () => void;
}) {
    const isDark = useColorScheme() === 'dark';
    const iconColor = selected ? '#111827' : isDark ? '#F9FAFB' : '#111827';

    return (
        <TouchableOpacity
            onPress={onPress}
            className={`rounded-xl border px-3 py-3 mb-2 ${
                selected
                    ? 'bg-primary border-transparent'
                    : 'border-divider-light dark:border-divider-dark'
            }`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
        >
            <View className="flex-row items-start gap-2">
                <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={iconColor}
                />
                <View className="flex-1">
                    <Text className={`font-semibold ${
                        selected
                            ? 'text-text-light dark:text-text-light'
                            : 'text-text-light dark:text-text-dark'
                    }`}>
                        {model.name ?? model.id}
                    </Text>
                    <Text className={`text-xs mt-1 ${
                        selected ? 'text-text-light dark:text-text-light' : SECONDARY_TEXT
                    }`}>
                        {model.id}
                    </Text>
                    <Text className={`text-xs mt-1 ${
                        selected ? 'text-text-light dark:text-text-light' : SECONDARY_TEXT
                    }`}>
                        Context: {contextLabel(model)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

export function CustomModelSettingsSection(props: CustomModelSettingsSectionProps) {
    const {
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
    } = props;
    const [query, setQuery] = useState('');
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const filteredModels = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const models = needle
            ? settings.models.filter((model) => (
                `${model.id} ${model.name ?? ''}`.toLowerCase().includes(needle)
            ))
            : settings.models;
        return models.slice(0, MAX_VISIBLE_MODELS);
    }, [query, settings.models]);
    const fallbackCount = settings.models.filter((model) => (
        model.contextWindowSource === 'fallback'
    )).length;

    return (
        <SettingsSection title="Custom AI Model">
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1 pr-4">
                    <Text className="text-base font-semibold text-text-light dark:text-text-dark">
                        OpenAI-compatible provider
                    </Text>
                    <Text className={`text-xs mt-1 ${SECONDARY_TEXT}`}>
                        Supports providers like OpenRouter, local gateways, and OpenAI API mirrors.
                    </Text>
                </View>
                <Switch
                    value={settings.enabled}
                    onValueChange={setEnabled}
                    disabled={isLoading || settings.models.length === 0}
                    accessibilityLabel="Enable custom AI provider"
                />
            </View>

            <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Base URL
            </Text>
            <TextInput
                value={draft.baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://openrouter.ai/api/v1"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Custom AI base URL"
            />

            <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                API key
            </Text>
            <TextInput
                value={draft.apiKey}
                onChangeText={setApiKey}
                placeholder="sk-or-v1-..."
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Custom AI API key"
            />

            <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                Fallback context tokens
            </Text>
            <TextInput
                value={draft.fallbackContextWindow}
                onChangeText={setFallbackContextWindow}
                placeholder="128000"
                placeholderTextColor={placeholderColor}
                keyboardType="number-pad"
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Fallback context tokens"
            />

            <View className="flex-row gap-3 mb-4">
                <ActionButton
                    label="Fetch models"
                    icon="cloud-download-outline"
                    busy={isFetching}
                    disabled={isLoading || isSaving}
                    onPress={fetchModels}
                />
                <ActionButton
                    label="Save"
                    icon="save-outline"
                    busy={isSaving}
                    disabled={isLoading || isFetching || settings.models.length === 0}
                    onPress={saveSettings}
                />
            </View>

            {status.message ? (
                <Text className={`text-sm mb-4 ${
                    status.kind === 'error' ? 'text-red-600 dark:text-red-400' : SECONDARY_TEXT
                }`}>
                    {status.message}
                </Text>
            ) : null}

            {fallbackCount > 0 ? (
                <Text className="text-xs text-red-600 dark:text-red-400 mb-4">
                    {fallbackCount} model(s) did not report context length. Fallback tokens are used.
                </Text>
            ) : null}

            {settings.models.length > 0 ? (
                <View>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        placeholder="Search models"
                        placeholderTextColor={placeholderColor}
                        autoCapitalize="none"
                        autoCorrect={false}
                        className={`${INPUT_CLASS} mb-3`}
                        accessibilityLabel="Search custom AI models"
                    />
                    {filteredModels.map((model) => (
                        <ModelRow
                            key={model.id}
                            model={model}
                            selected={settings.selectedModelId === model.id}
                            onPress={() => selectModel(model.id)}
                        />
                    ))}
                    {settings.models.length > filteredModels.length ? (
                        <Text className={`text-xs mt-1 ${SECONDARY_TEXT}`}>
                            Showing {filteredModels.length} of {settings.models.length} models.
                        </Text>
                    ) : null}
                </View>
            ) : (
                <Text className={`text-sm ${SECONDARY_TEXT}`}>
                    Fetch models to verify the endpoint and select a model.
                </Text>
            )}
        </SettingsSection>
    );
}
