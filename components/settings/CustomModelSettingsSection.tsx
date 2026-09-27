import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ChatModelPickerSheet } from '@/components/ai/ChatModelPickerSheet';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { AnimatedSwitch } from '@/components/ui/AnimatedSwitch';
import type { UseCustomAiModelsReturn } from '@/hooks/settings/useCustomAiModels';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatPickerModelName, hostLabelFromBaseUrl } from '@/utils/ai/modelDisplay';
import { SettingsSection } from './SettingsSection';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type CustomModelSettingsSectionProps = UseCustomAiModelsReturn & {
    readonly embedded?: boolean;
};

const INPUT_CLASS = [
    'rounded-control border border-hairline-light dark:border-hairline-dark',
    'bg-surface-light dark:bg-surface-dark px-3.5 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');
const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';

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
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const inactive = disabled || busy;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={inactive}
            className={`min-h-12 flex-1 flex-row items-center justify-center gap-2 rounded-control border border-hairline-light px-4 dark:border-hairline-dark ${
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
                    <Text className="text-[15px] text-text-light dark:text-text-dark">
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
        embedded = false,
    } = props;
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [manualModelId, setManualModelId] = useState('');
    const [isAddingManual, setIsAddingManual] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const chevronColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    const models = profile?.models ?? [];
    const selected = models.find((model) => model.id === profile?.selectedModelId);
    const hostLabel = hostLabelFromBaseUrl(draft.baseUrl || profile?.baseUrl || '');
    const selectedLabel = selected
        ? (selected.name ?? formatPickerModelName(selected.id))
        : profile?.selectedModelId
            ? formatPickerModelName(profile.selectedModelId)
            : 'Choose model';
    const canRemoveProvider = settings.profiles.length > 1;

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
                    <Text className="text-[16px] text-text-light dark:text-text-dark">
                        Use a custom AI provider
                    </Text>
                    <Text className={`text-xs mt-1 ${SECONDARY_TEXT}`}>
                        Any OpenAI-compatible endpoint. Base URL, key and model are yours to set.
                    </Text>
                </View>
                <AnimatedSwitch
                    value={settings.enabled}
                    onValueChange={setEnabled}
                    disabled={isLoading}
                    accessibilityLabel="Enable custom AI provider"
                />
            </View>

            {settings.profiles.length > 1 ? (
                <View className="mb-4 gap-2">
                    <Text className={`text-[13px] ${SECONDARY_TEXT}`}>Saved providers</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {settings.profiles.map((entry) => {
                            const active = entry.id === profile?.id;
                            return (
                                <TouchableOpacity
                                    key={entry.id}
                                    onPress={() => {
                                        void selectProfile(entry.id);
                                    }}
                                    className="min-w-0 max-w-full shrink"
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: active }}
                                    accessibilityLabel={`Use provider ${entry.label}`}
                                >
                                    {/* Chrome and the width guard live on a plain child
                                        View: pressables in this codebase have silently
                                        dropped `className` before (AGENTS.md), and this
                                        guard is what stops a long label from running off
                                        a phone screen. */}
                                    <View
                                        testID={`provider-chip-${entry.id}`}
                                        className={`min-w-0 max-w-full shrink rounded-control border px-3 py-2 ${
                                            active
                                                ? 'border-bone-light dark:border-bone-dark'
                                                : 'border-hairline-light dark:border-hairline-dark'
                                        }`}
                                    >
                                        <Text
                                            numberOfLines={1}
                                            className="text-[14px] text-text-light dark:text-text-dark"
                                        >
                                            {entry.label}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ) : null}

            <TouchableOpacity
                onPress={() => setPickerOpen(true)}
                className="mb-4 rounded-control border border-hairline-light px-4 py-3.5 dark:border-hairline-dark"
                accessibilityRole="button"
                accessibilityLabel="Change active model"
            >
                <View className="flex-row items-center justify-between gap-2">
                    <View className="flex-1 min-w-0 gap-1">
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Active model
                        </Text>
                        <Text
                            numberOfLines={1}
                            className="text-[17px] text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            {selectedLabel}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-1">
                            <Text className={`text-xs ${SECONDARY_TEXT}`}>{hostLabel}</Text>
                            {profile && profile.modelFilterPatterns.length > 0 ? (
                                <Text className="text-[10px] uppercase tracking-[1.2px] text-text-secondary-light dark:text-text-secondary-dark">
                                    Filtered
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={chevronColor} />
                </View>
            </TouchableOpacity>

            {/* Provider name is in the main form as well. It is the title of the
                provider you are editing, and it used to live behind "Advanced",
                so a freshly added provider kept its generated "Provider 2" name
                unless you went hunting for the field. */}
            <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                Provider name
            </Text>
            <TextInput
                value={draft.label}
                onChangeText={setLabel}
                placeholder="Provider"
                placeholderTextColor={placeholderColor}
                autoCapitalize="words"
                autoCorrect={false}
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Provider name"
            />

            <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                API key
            </Text>
            <TextInput
                value={draft.apiKey}
                onChangeText={setApiKey}
                placeholder="Provider API key"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Custom AI API key"
            />

            {/* Base URL sits in the main form, not behind "Advanced": it is the
                one field you cannot add a provider without. Hidden here, "Add
                provider" offered a key field and no endpoint. */}
            <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                Base URL
            </Text>
            <TextInput
                value={draft.baseUrl}
                onChangeText={setBaseUrl}
                placeholder="https://host/v1"
                placeholderTextColor={placeholderColor}
                autoCapitalize="none"
                autoCorrect={false}
                className={`${INPUT_CLASS} mb-4`}
                accessibilityLabel="Custom AI base URL"
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
                    disabled={isLoading || isFetching || models.length === 0}
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

            {models.length > 0 ? (
                <Text className={`text-xs mb-4 ${SECONDARY_TEXT}`}>
                    {`${models.length} model${models.length === 1 ? '' : 's'} cached.`}
                    {profile?.lastFetchedAt
                        ? ` Last fetched ${new Date(profile.lastFetchedAt).toLocaleString()}.`
                        : ''}
                </Text>
            ) : (
                <Text className={`text-sm mb-4 ${SECONDARY_TEXT}`}>
                    Fetch models to verify the endpoint and select a model.
                </Text>
            )}

            <View className="flex-row gap-3 mb-2">
                <ActionButton
                    label="Add provider"
                    icon="add-outline"
                    disabled={isLoading || isSaving}
                    onPress={() => {
                        void addProfile();
                    }}
                />
                {canRemoveProvider ? (
                    <ActionButton
                        label="Remove"
                        icon="trash-outline"
                        disabled={isLoading || isSaving}
                        onPress={() => {
                            void removeActiveProfile();
                        }}
                    />
                ) : null}
            </View>

            <TouchableOpacity
                onPress={() => setAdvancedOpen((open) => !open)}
                className="flex-row items-center justify-between py-2 mb-2"
                accessibilityRole="button"
                accessibilityLabel="Advanced AI provider settings"
            >
                <Text className="text-[15px] text-text-light dark:text-text-dark">
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
                        <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Model filters
                        </Text>
                        <TextInput
                            value={draft.modelFilterPatterns}
                            onChangeText={setModelFilterPatterns}
                            placeholder="gpt-4o, claude-"
                            placeholderTextColor={placeholderColor}
                            autoCapitalize="none"
                            autoCorrect={false}
                            className={INPUT_CLASS}
                            accessibilityLabel="Model filter patterns"
                        />
                        <Text className={`text-xs mt-2 ${SECONDARY_TEXT}`}>
                            Comma-separated substrings. Only matching ids load. Leave empty for all.
                        </Text>
                    </View>
                    <View>
                        <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
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
                        <Text className="mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Add model manually
                        </Text>
                        <Text className={`text-xs mt-1 mb-2 ${SECONDARY_TEXT}`}>
                            Type a model id when fetch cannot list it (e.g. gpt-4o-mini).
                        </Text>
                        <View className="flex-row gap-2">
                            <TextInput
                                value={manualModelId}
                                onChangeText={setManualModelId}
                                placeholder="gpt-4o-mini"
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
                                className={`min-h-12 items-center justify-center rounded-control border border-hairline-light px-4 dark:border-hairline-dark ${
                                    isAddingManual || !manualModelId.trim() ? 'opacity-50' : ''
                                }`}
                                accessibilityRole="button"
                                accessibilityLabel="Add manual model"
                            >
                                {isAddingManual ? (
                                    <LoadingBar size="sm" accessibilityLabel="Adding model" />
                                ) : (
                                    <Text className="text-[15px] text-text-light dark:text-text-dark">Add</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            ) : null}

            <ChatModelPickerSheet
                visible={pickerOpen}
                models={models}
                recentModels={(profile?.recentModelIds ?? [])
                    .map((id) => models.find((model) => model.id === id))
                    .filter((model): model is NonNullable<typeof model> => Boolean(model))}
                selectedId={profile?.selectedModelId ?? null}
                filterPatterns={profile?.modelFilterPatterns ?? []}
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
