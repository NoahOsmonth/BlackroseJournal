import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

export interface IntentionFormValues {
    title: string;
    description: string;
}

interface IntentionFormProps {
    title: string;
    submitLabel: string;
    initialValues: IntentionFormValues;
    areaLabel?: string;
    onSubmit: (values: IntentionFormValues) => void;
    onCancel: () => void;
    onChange?: (values: IntentionFormValues) => void;
    isSaving?: boolean;
}

export function IntentionForm({
    title,
    submitLabel,
    initialValues,
    areaLabel,
    onSubmit,
    onCancel,
    onChange,
    isSaving = false,
}: IntentionFormProps) {
    const [values, setValues] = useState<IntentionFormValues>(initialValues);
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    useEffect(() => {
        setValues(initialValues);
    }, [initialValues]);

    const updateValues = (next: IntentionFormValues) => {
        setValues(next);
        onChange?.(next);
    };

    const canSubmit = values.title.trim().length > 0 && !isSaving;

    return (
        <View className="flex-1 bg-background-light dark:bg-background-dark">
            <View className="flex-row items-center justify-between px-4 py-3">
                <Pressable
                    onPress={onCancel}
                    className="p-2 -ml-2"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                </Pressable>
                <Text className="text-[17px] font-semibold text-text-light dark:text-text-dark">
                    {title}
                </Text>
                <Pressable
                    onPress={() => canSubmit && onSubmit(values)}
                    disabled={!canSubmit}
                    accessibilityLabel={submitLabel}
                >
                    <Text className={`text-[17px] ${canSubmit ? 'text-primary' : 'text-text-secondary-light'}`}>
                        {submitLabel}
                    </Text>
                </Pressable>
            </View>

            <View className="px-4 pb-10">
                {areaLabel && (
                    <View className="items-center py-4">
                        <View className="px-4 py-1 rounded-full bg-surface-light dark:bg-surface-dark border border-divider-light dark:border-divider-dark">
                            <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                {areaLabel}
                            </Text>
                        </View>
                    </View>
                )}

                <View className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-soft mb-6">
                    <View className="border-b border-divider-light dark:border-divider-dark">
                        <TextInput
                            value={values.title}
                            onChangeText={(text) => updateValues({ ...values, title: text })}
                            placeholder="Intention title"
                            placeholderTextColor="#9CA3AF"
                            className="px-4 py-3 text-[17px] text-text-light dark:text-text-dark"
                            maxLength={80}
                        />
                    </View>
                    <View className="p-4">
                        <TextInput
                            value={values.description}
                            onChangeText={(text) => updateValues({ ...values, description: text })}
                            placeholder="Describe why this intention matters..."
                            placeholderTextColor="#9CA3AF"
                            className="text-[17px] text-text-light dark:text-text-dark h-32"
                            multiline
                            maxLength={280}
                        />
                        <View className="absolute bottom-4 right-4">
                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                                {values.description.length} / 280
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}
