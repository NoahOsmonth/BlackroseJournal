import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

const EXAMPLE_CHIPS = [
    'A warm encouraging coach',
    'A blunt stoic mentor',
    'A playful curious friend',
];

interface PersonaGenerateInputProps {
    onBack: () => void;
    onGenerate: (description: string) => void;
    isGenerating: boolean;
}

/** Describe-phase UI for AI persona generation: a prompt, input, and chips. */
export function PersonaGenerateInput({
    onBack,
    onGenerate,
    isGenerating,
}: PersonaGenerateInputProps) {
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const [description, setDescription] = useState('');

    const trimmed = description.trim();
    const canSubmit = trimmed.length > 0 && !isGenerating;

    return (
        <View className="flex-1">
            <View className="min-h-[56px] flex-row items-center px-4 py-2">
                <Pressable
                    onPress={onBack}
                    className="h-11 w-11 items-center justify-center"
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                >
                    <MaterialIcons name="arrow-back" size={26} color={inkColor} />
                </Pressable>
                <Text
                    className="ml-1 flex-1 text-center text-[26px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    Generate
                </Text>
                <View className="w-11" />
            </View>
            <View className="h-px bg-hairline-light dark:bg-hairline-dark" />

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text
                    className="text-[30px] leading-[38px] text-text-light dark:text-text-dark"
                    style={SERIF}
                >
                    Describe the guide you want
                </Text>
                <Text className="mb-6 mt-3 text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                    A sentence or two about their personality and tone. AI will draft the rest.
                </Text>

                <View className="mb-5 h-40 rounded-card border border-hairline-light p-4 dark:border-hairline-dark">
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="e.g. a calm stoic mentor who asks short questions"
                        placeholderTextColor={mutedColor}
                        className="h-full text-[16px] text-text-light dark:text-text-dark"
                        multiline
                        maxLength={500}
                        editable={!isGenerating}
                        accessibilityLabel="Persona description"
                    />
                </View>

                <View className="mb-8 flex-row flex-wrap gap-2">
                    {EXAMPLE_CHIPS.map((chip) => (
                        <Pressable
                            key={chip}
                            onPress={() => setDescription(chip)}
                            disabled={isGenerating}
                            accessibilityRole="button"
                            accessibilityLabel={`Use example: ${chip}`}
                            className="min-h-11 justify-center rounded-full border border-hairline-light px-4 py-2 dark:border-hairline-dark"
                        >
                            <Text className="text-[14px] text-text-light dark:text-text-dark">{chip}</Text>
                        </Pressable>
                    ))}
                </View>

                <Pressable
                    onPress={() => canSubmit && onGenerate(trimmed)}
                    disabled={!canSubmit}
                    accessibilityRole="button"
                    accessibilityLabel="Generate persona"
                    accessibilityState={{ disabled: !canSubmit }}
                    className={`min-h-[56px] flex-row items-center justify-center gap-2.5 rounded-control border ${
                        canSubmit
                            ? 'border-bone-light dark:border-bone-dark'
                            : 'border-hairline-light dark:border-hairline-dark'
                    }`}
                >
                    <MaterialIcons
                        name="auto-awesome"
                        size={20}
                        color={canSubmit ? inkColor : mutedColor}
                    />
                    <Text
                        className={`text-[19px] ${
                            canSubmit
                                ? 'text-text-light dark:text-text-dark'
                                : 'text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                        style={SERIF}
                    >
                        {isGenerating ? 'Generating…' : 'Generate persona'}
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}
