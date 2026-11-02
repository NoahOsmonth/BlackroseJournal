/**
 * The collapsed "Advanced" block of the AI service form: option filters, the
 * fallback memory size, and the manual option-name escape hatch.
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
    /** Adds an option name the service's list did not include. */
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
                <Text className={FIELD_LABEL}>Show only some options</Text>
                <TextInput
                    value={modelFilterPatterns}
                    onChangeText={onChangeModelFilterPatterns}
                    placeholder="gpt-4o, claude-"
                    placeholderTextColor={placeholderColor}
                    autoCapitalize="none"
                    autoCorrect={false}
                    className={INPUT_CLASS}
                    accessibilityLabel="Words to match in option names"
                />
                <Text className={`text-xs mt-2 ${SECONDARY_TEXT}`}>
                    Words to match in the option names, separated by commas. Leave empty to show everything.
                </Text>
            </View>
            <View>
                <Text className={FIELD_LABEL}>Memory size (if not detected)</Text>
                <TextInput
                    value={fallbackContextWindow}
                    onChangeText={onChangeFallbackContextWindow}
                    placeholder="128000"
                    placeholderTextColor={placeholderColor}
                    keyboardType="number-pad"
                    className={INPUT_CLASS}
                    accessibilityLabel="Memory size if not detected"
                />
                <Text className={`text-xs mt-2 ${SECONDARY_TEXT}`}>
                    How much of a conversation the AI can keep in mind. Only used when the app can’t detect it.
                </Text>
            </View>
            <View>
                <Text className={FIELD_LABEL}>Add an option by name</Text>
                <Text className={`text-xs mt-1 mb-2 ${SECONDARY_TEXT}`}>
                    Type the name your AI service uses when it isn’t listed (for example gpt-4o-mini).
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
                        accessibilityLabel="AI option name"
                    />
                    <TouchableOpacity
                        onPress={handleAddManualModel}
                        disabled={isAddingManual || !manualModelId.trim()}
                        className={`min-h-12 items-center justify-center rounded-control border border-hairline-light px-4 dark:border-hairline-dark ${
                            isAddingManual || !manualModelId.trim() ? 'opacity-50' : ''
                        }`}
                        accessibilityRole="button"
                        accessibilityLabel="Add option by name"
                    >
                        {isAddingManual ? (
                            <LoadingBar size="sm" accessibilityLabel="Adding option" />
                        ) : (
                            <Text className="text-[15px] text-text-light dark:text-text-dark">Add</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
