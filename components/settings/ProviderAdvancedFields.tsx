/**
 * The collapsed "Advanced" block of the AI provider form: model filters, the
 * fallback context size, and the manual model-id escape hatch.
 *
 * Split out of `CustomModelSettingsSection` to keep that file under the
 * design-limit cap. The inputs are fully controlled — this component owns only
 * the manual-model draft and its in-flight flag.
 */
import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { LoadingBar } from '@/components/ui/LoadingBar';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const INPUT_CLASS = [
    'rounded-control border border-hairline-light dark:border-hairline-dark',
    'bg-surface-light dark:bg-surface-dark px-3.5 py-3',
    'text-text-light dark:text-text-dark',
].join(' ');
const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';
const FIELD_LABEL = 'mb-2 text-[13px] text-text-secondary-light dark:text-text-secondary-dark';

type ProviderAdvancedFieldsProps = {
    readonly modelFilterPatterns: string;
    readonly onChangeModelFilterPatterns: (value: string) => void;
    readonly fallbackContextWindow: string;
    readonly onChangeFallbackContextWindow: (value: string) => void;
    /** Adds a model id the endpoint's catalogue did not list. */
    readonly onAddManualModel: (modelId: string) => Promise<void>;
};

export function ProviderAdvancedFields({
    modelFilterPatterns,
    onChangeModelFilterPatterns,
    fallbackContextWindow,
    onChangeFallbackContextWindow,
    onAddManualModel,
}: ProviderAdvancedFieldsProps) {
    const [manualModelId, setManualModelId] = useState('');
    const [isAddingManual, setIsAddingManual] = useState(false);
    const isDark = useColorScheme() === 'dark';
    const placeholderColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    const handleAddManualModel = () => {
        const id = manualModelId.trim();
        if (!id || isAddingManual) return;
        setIsAddingManual(true);
        void onAddManualModel(id).finally(() => {
            setIsAddingManual(false);
            setManualModelId('');
        });
    };

    return (
        <View className="gap-3 mb-2">
            <View>
                <Text className={FIELD_LABEL}>Model filters</Text>
                <TextInput
                    value={modelFilterPatterns}
                    onChangeText={onChangeModelFilterPatterns}
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
                <Text className={FIELD_LABEL}>Fallback context tokens</Text>
                <TextInput
                    value={fallbackContextWindow}
                    onChangeText={onChangeFallbackContextWindow}
                    placeholder="128000"
                    placeholderTextColor={placeholderColor}
                    keyboardType="number-pad"
                    className={INPUT_CLASS}
                    accessibilityLabel="Fallback context tokens"
                />
            </View>
            <View>
                <Text className={FIELD_LABEL}>Add model manually</Text>
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
    );
}
