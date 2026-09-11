import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NewPersonaAvatar } from './NewPersonaAvatar';
import { BLACKROSE_PALETTE } from '@/constants/theme';

interface NewPersonaCardProps {
    onCreate: () => void;
    onGenerate?: () => void;
}

/**
 * "New voice" tile: dashed hairline frame, line rose mark, outline controls.
 * Both actions are outlined (concept `black-rose-persona.png`); the active
 * voice keeps the only emphasised border in the carousel.
 */
export function NewPersonaCard({ onCreate, onGenerate }: NewPersonaCardProps) {
    const isDark = useColorScheme() === 'dark';

    return (
        <View
            testID="new-persona-card"
            className="snap-center shrink-0 w-[80vw] max-w-sm bg-transparent rounded-card p-6 flex flex-col items-center justify-between text-center relative border border-dashed border-hairline-light dark:border-hairline-dark h-[380px]"
        >
            <View className="flex-1 items-center justify-center gap-5">
                <NewPersonaAvatar />
                <View className="items-center gap-1">
                    <Text
                        className="text-[22px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        New voice
                    </Text>
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        Build your dream team
                    </Text>
                </View>
            </View>
            <View className="w-full gap-3">
                {onGenerate && (
                    <Pressable
                        onPress={onGenerate}
                        testID="new-persona-generate"
                        className="min-h-12 w-full flex-row items-center justify-center gap-2 rounded-control border border-hairline-light py-3 dark:border-hairline-dark"
                        accessibilityLabel="Generate persona with AI"
                    >
                        <MaterialIcons name="auto-awesome" size={18} color={isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent} />
                        <Text className="text-[16px] text-text-light dark:text-text-dark">Generate with AI</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={onCreate}
                    testID="new-persona-create"
                    className="min-h-12 w-full items-center justify-center rounded-control border border-bone-light py-3 dark:border-bone-dark"
                    accessibilityLabel="Create persona"
                >
                    <Text
                        className="text-[18px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Create
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
