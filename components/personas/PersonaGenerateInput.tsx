import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';

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
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
    const [description, setDescription] = useState('');

    const trimmed = description.trim();
    const canSubmit = trimmed.length > 0 && !isGenerating;

    return (
        <View className="flex-1">
            <View className="flex-row items-center px-4 py-3 border-b border-divider-light dark:border-divider-dark">
                <Pressable onPress={onBack} className="p-2 -ml-2" accessibilityLabel="Back">
                    <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                </Pressable>
                <Text className="ml-2 text-[20px] font-semibold text-text-light dark:text-white">
                    Generate with AI
                </Text>
            </View>

            <ScrollView
                className="flex-1 px-5"
                contentContainerStyle={{ paddingTop: 24, paddingBottom: 32 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text className="text-[22px] font-semibold text-text-light dark:text-white mb-2">
                    Describe the guide you want
                </Text>
                <Text className="text-[15px] leading-[1.4] text-text-secondary-light dark:text-text-secondary-dark mb-6">
                    A sentence or two about their personality and tone. AI will draft the rest.
                </Text>

                <View className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 shadow-soft h-40 mb-5">
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        placeholder="e.g. a calm stoic mentor who asks short questions"
                        placeholderTextColor="#9CA3AF"
                        className="text-[17px] text-text-light dark:text-white h-full"
                        multiline
                        maxLength={500}
                        editable={!isGenerating}
                        accessibilityLabel="Persona description"
                    />
                </View>

                <Text className="text-[13px] uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark mb-3 pl-1">
                    Try one of these
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-8">
                    {EXAMPLE_CHIPS.map((chip) => (
                        <Pressable
                            key={chip}
                            onPress={() => setDescription(chip)}
                            disabled={isGenerating}
                            className="px-4 py-2 rounded-full border border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark"
                            accessibilityLabel={`Use example: ${chip}`}
                        >
                            <Text className="text-[14px] text-text-light dark:text-text-dark">{chip}</Text>
                        </Pressable>
                    ))}
                </View>

                <Pressable
                    onPress={() => canSubmit && onGenerate(trimmed)}
                    disabled={!canSubmit}
                    className={`flex-row items-center justify-center gap-2 py-4 rounded-2xl ${
                        canSubmit ? 'bg-primary' : 'bg-divider-light dark:bg-divider-dark'
                    }`}
                    accessibilityLabel="Generate persona"
                >
                    <MaterialIcons name="auto-awesome" size={20} color="#FFFFFF" />
                    <Text className="text-[16px] font-semibold text-white">
                        {isGenerating ? 'Generating…' : 'Generate persona'}
                    </Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}
