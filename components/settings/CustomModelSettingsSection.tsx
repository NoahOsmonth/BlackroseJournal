import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ChatModelPickerSheet } from '@/components/ai/ChatModelPickerSheet';
import { FreeOnlyPill } from '@/components/ai/FreeModelBadge';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { AnimatedSwitch } from '@/components/ui/AnimatedSwitch';
import type { UseCustomAiModelsReturn } from '@/hooks/settings/useCustomAiModels';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DEFAULT_AI_BASE_URL, filterFreeModels, formatPickerModelName, hostLabelFromBaseUrl } from '@/utils/ai/modelDisplay';
import { SettingsSection } from './SettingsSection';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type CustomModelSettingsSectionProps = UseCustomAiModelsReturn & {
    readonly embedded?: boolean;
};

const INPUT_CLASS = [
    'rounded-xl border border-divider-light dark:border-divider-dark',
    'bg-background-light dark:bg-background-dark px-3 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');
const SECONDARY_TEXT = 'text-subtext-light dark:text-subtext-dark';

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
    const iconColor = isDark ? '#F9FAFB' : '#111827';
    const inactive = disabled || busy;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={inactive}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 ${
                inactive ? 'opacity-50' : ''
            }`}
            accessibilityRole="button"
            accessibilityState={{ disabled: inactive }}
        >
            {busy ? (
                <LoadingBar size="sm" accessibilityLabel={`Working on ${label}`} />
            ) : (
                <>
                    <Ionicons name={icon} size={18} color={iconColor} />
                    <Text className="font-bold text-text-light dark:text-text-light">
                        {label}
                    </Text>
                </>
            )}
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
        addManualModel,
        setEnabled,
        setFreeOnly,
        embedded = false,
    } = props;
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [manualModelId, setManualModelId] = useState('');
    const [isAddingManual, setIsAddingManual] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? '#9CA3AF' : '#6B7280';
    const chevronColor = isDark ? '#F9FAFB' : '#111827';

    const models = settings.freeOnly ? filterFreeModels(settings.models) : settings.models;
    const selected = models.find((model) => model.id === settings.selectedModelId)
        ?? settings.models.find((model) => model.id === settings.selectedModelId);
    const hostLabel = hostLabelFromBaseUrl(draft.baseUrl || settings.baseUrl);
    const selectedLabel = selected
        ? (selected.name ?? formatPickerModelName(selected.id))
        : settings.selectedModelId
            ? formatPickerModelName(settings.selectedModelId)
            : 'Choose model';

    const handleFreeOnlyToggle = (value: boolean) => {
        if (!value) {
            Alert.alert(
                'Show paid models?',
                'Paid models can incur OpenRouter charges. Blackrose defaults to free models only.',
                [
                    { text: 'Keep free', style: 'cancel' },
                    {
                        text: 'Show all models',
                        style: 'destructive',
                        onPress: () => {
                            void setFreeOnly(false);
                        },
                    },
                ]
            );
            return;
        }
        void setFreeOnly(true);
    };

    const handleAddManualModel = () => {
        const id = manualModelId.trim();
        if (!id || isAddingManual) return;
        setIsAddingManual(true);
        void addManualModel(id).finally(() => {
            setIsAddingManual(false);
            setManualModelId('');
        });
    };

    return (
        <SettingsSection title="AI Model" embedded={embedded}>
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1 pr-4">
                    <Text className="text-base font-semibold text-text-light dark:text-text-dark">
                        Use OpenRouter / custom provider
                    </Text>
                    <Text className={`text-xs mt-1 ${SECONDARY_TEXT}`}>
                        Free models by default. Optional custom base URL and API key.
                    </Text>
                </View>
                <AnimatedSwitch
                    value={settings.enabled}
                    onValueChange={setEnabled}
                    disabled={isLoading}
                    accessibilityLabel="Enable custom AI provider"
                />
            </View>

            <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                className="mb-4 rounded-xl border border-divider-light dark:border-divider-dark px-3 py-3"
                accessibilityRole="button"
                accessibilityLabel="Change active model"
            >
                <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1 min-w-0 gap-1">
                        <Text className="text-sm font-medium text-text-light dark:text-text-dark">
                            Active model
                        </Text>
                        <Text
                            numberOfLines={1}
                            className="text-base font-semibold text-text-light dark:text-text-dark"
                        >
                            {selectedLabel}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                            <Text className={`text-xs ${SECONDARY_TEXT}`}>{hostLabel}</Text>
                            {settings.freeOnly ? <FreeOnlyPill /> : null}
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={chevronColor} />
                </View>
            </TouchableOpacity>

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

            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1 pr-4">
                    <Text className="text-base font-semibold text-text-light dark:text-text-dark">
                        Free models only
                    </Text>
                    <Text className={`text-xs mt-1 ${SECONDARY_TEXT}`}>
                        Only models with :free in the id (and openrouter/free). Recommended.
                    </Text>
                </View>
                <AnimatedSwitch
                    value={settings.freeOnly}
                    onValueChange={handleFreeOnlyToggle}
                    disabled={isLoading}
                    accessibilityLabel="Free models only"
                />
            </View>

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

            {settings.models.length > 0 ? (
                <Text className={`text-xs mb-4 ${SECONDARY_TEXT}`}>
                    {settings.freeOnly
                        ? `${models.length} free models cached.`
                        : `${settings.models.length} models cached.`}
                    {settings.lastFetchedAt
                        ? ` Last fetched ${new Date(settings.lastFetchedAt).toLocaleString()}.`
                        : ''}
                </Text>
            ) : (
                <Text className={`text-sm mb-4 ${SECONDARY_TEXT}`}>
                    Fetch models to verify the endpoint and select a model.
                </Text>
            )}

            <TouchableOpacity
                onPress={() => setAdvancedOpen((open) => !open)}
                className="flex-row items-center justify-between py-2 mb-2"
                accessibilityRole="button"
                accessibilityLabel="Advanced AI provider settings"
            >
                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                    Advanced
                </Text>
                <Ionicons
                    name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={chevronColor}
                />
            </TouchableOpacity>

            {advancedOpen ? (
                <View className="gap-3 mb-2">
                    <View>
                        <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                            Base URL
                        </Text>
                        <TextInput
                            value={draft.baseUrl}
                            onChangeText={setBaseUrl}
                            placeholder={DEFAULT_AI_BASE_URL}
                            placeholderTextColor={placeholderColor}
                            autoCapitalize="none"
                            autoCorrect={false}
                            className={INPUT_CLASS}
                            accessibilityLabel="Custom AI base URL"
                        />
                    </View>
                    <View>
                        <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                            Fallback context tokens
                        </Text>
                        <TextInput
                            value={draft.fallbackContextWindow}
                            onChangeText={setFallbackContextWindow}
                            placeholder="128000"
                            placeholderTextColor={placeholderColor}
                            keyboardType="number-pad"
                            className={INPUT_CLASS}
                            accessibilityLabel="Fallback context tokens"
                        />
                    </View>
                    <View>
                        <Text className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
                            Add model manually
                        </Text>
                        <Text className={`text-xs mt-1 mb-2 ${SECONDARY_TEXT}`}>
                            Type a model id when fetch cannot list it (e.g. qwen-web/qwen3.8-max).
                        </Text>
                        <View className="flex-row gap-2">
                            <TextInput
                                value={manualModelId}
                                onChangeText={setManualModelId}
                                placeholder="qwen-web/qwen3.8-max"
                                placeholderTextColor={placeholderColor}
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="done"
                                onSubmitEditing={handleAddManualModel}
                                className={`${INPUT_CLASS} flex-1`}
                                accessibilityLabel="Manual model id"
                            />
                            <TouchableOpacity
                                onPress={handleAddManualModel}
                                disabled={isAddingManual || !manualModelId.trim()}
                                className={`items-center justify-center rounded-xl bg-primary px-4 ${
                                    isAddingManual || !manualModelId.trim() ? 'opacity-50' : ''
                                }`}
                                accessibilityRole="button"
                                accessibilityLabel="Add manual model"
                            >
                                {isAddingManual ? (
                                    <LoadingBar size="sm" accessibilityLabel="Adding model" />
                                ) : (
                                    <Text className="font-bold text-white">Add</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : null}

            <ChatModelPickerSheet
                visible={pickerOpen}
                mode="byok"
                models={models}
                recentModels={settings.recentModelIds
                    .map((id) => models.find((model) => model.id === id))
                    .filter((model): model is NonNullable<typeof model> => Boolean(model))}
                selectedId={settings.selectedModelId}
                freeOnly={settings.freeOnly}
                hostLabel={hostLabel}
                hasApiKey={Boolean(draft.apiKey.trim())}
                isLoading={isLoading}
                isFetching={isFetching}
                error={status.kind === 'error' ? status.message : null}
                onSelect={(modelId) => {
                    void selectModel(modelId).then(() => setPickerOpen(false));
                }}
                onRefresh={() => {
                    void fetchModels();
                }}
                onClose={() => setPickerOpen(false)}
            />
        </SettingsSection>
    );
}
