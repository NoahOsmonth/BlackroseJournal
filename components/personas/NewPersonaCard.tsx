import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NewPersonaAvatar } from './NewPersonaAvatar';

interface NewPersonaCardProps {
    onCreate: () => void;
    onGenerate?: () => void;
}

export function NewPersonaCard({ onCreate, onGenerate }: NewPersonaCardProps) {
    return (
        <View
            testID="new-persona-card"
            className="snap-center shrink-0 w-[80vw] max-w-sm bg-transparent rounded-3xl p-6 flex flex-col items-center justify-between text-center relative border-2 border-dashed border-gray-300 dark:border-gray-700 h-[380px]"
        >
            <View className="flex-1 items-center justify-center gap-5">
                <NewPersonaAvatar />
                <View className="items-center">
                    <Text className="text-xl font-bold text-text-light dark:text-white">New persona</Text>
                    <Text className="text-text-secondary-light dark:text-gray-400 font-medium">
                        Build your dream team
                    </Text>
                </View>
            </View>
            <View className="w-full gap-2">
                {onGenerate && (
                    <Pressable
                        onPress={onGenerate}
                        testID="new-persona-generate"
                        className="w-full flex-row items-center justify-center gap-2 border border-primary py-4 rounded-2xl"
                        accessibilityLabel="Generate persona with AI"
                    >
                        <MaterialIcons name="auto-awesome" size={18} color="#FF9F0A" />
                        <Text className="font-semibold text-primary">Generate with AI</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={onCreate}
                    testID="new-persona-create"
                    className="w-full bg-gray-900 dark:bg-white py-4 rounded-2xl items-center shadow-lg"
                    accessibilityLabel="Create persona"
                >
                    <Text className="font-semibold text-white dark:text-black">Create</Text>
                </Pressable>
            </View>
        </View>
    );
}
