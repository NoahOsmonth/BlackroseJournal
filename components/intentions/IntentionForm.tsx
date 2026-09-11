import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
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

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/** Quiet editor: serif header, hairline field card, muted counter. */
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
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const quietInk = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

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
            <View className="flex-row items-center justify-between px-5 py-4">
                <Pressable
                    onPress={onCancel}
                    className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={26} color={ink} />
                </Pressable>
                <Text
                    className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    {title}
                </Text>
                <Pressable
                    onPress={() => canSubmit && onSubmit(values)}
                    disabled={!canSubmit}
                    accessibilityLabel={submitLabel}
                    className="min-h-11 items-center justify-center"
                >
                    <Text
                        className={`text-[17px] ${
                            canSubmit
                                ? 'text-text-light underline dark:text-text-dark'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                    >
                        {submitLabel}
                    </Text>
                </Pressable>
            </View>

            <View className="px-5 pb-10">
                {areaLabel && (
                    <View className="items-center py-4">
                        <View className={`rounded-full border ${HAIRLINE} px-4 py-1.5`}>
                            <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                {areaLabel}
                            </Text>
                        </View>
                    </View>
                )}

                <View className={`mb-6 overflow-hidden rounded-card border ${HAIRLINE} bg-surface-light dark:bg-surface-dark`}>
                    <View className={`border-b ${HAIRLINE}`}>
                        <TextInput
                            value={values.title}
                            onChangeText={(text) => updateValues({ ...values, title: text })}
                            placeholder="Intention title"
                            placeholderTextColor={quietInk}
                            className="min-h-14 px-4 py-3 text-[19px] text-text-light dark:text-text-dark"
                            maxLength={80}
                        />
                    </View>
                    <View className="p-4">
                        <TextInput
                            value={values.description}
                            onChangeText={(text) => updateValues({ ...values, description: text })}
                            placeholder="Describe why this intention matters..."
                            placeholderTextColor={quietInk}
                            className="h-32 text-[17px] text-text-light dark:text-text-dark"
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
