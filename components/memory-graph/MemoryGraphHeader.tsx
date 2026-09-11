import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { RoseMark } from '@/components/ui/RoseMark';

interface HeaderProps {
    query: string;
    onQueryChange: (text: string) => void;
    onBack?: () => void;
}

/**
 * Threads header: back, the line rose mark centred, serif "Threads" title, then
 * a hairline search field. Matches black-rose-threads.png.
 */
export function MemoryGraphHeader({ query, onQueryChange, onBack }: HeaderProps) {
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const muted = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;

    return (
        <View className="px-5 pb-3 pt-2">
            <View className="flex-row items-center justify-between">
                <View className="w-10">
                    {onBack ? (
                        <Pressable
                            onPress={onBack}
                            accessibilityRole="button"
                            accessibilityLabel="Back from memory graph"
                            hitSlop={8}
                            className="h-10 w-10 items-center justify-center"
                        >
                            <MaterialIcons name="chevron-left" size={26} color={ink} />
                        </Pressable>
                    ) : null}
                </View>

                <RoseMark
                    size={30}
                    color={isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent}
                />

                <Text
                    className="w-24 text-right text-[22px] text-text-light dark:text-text-dark"
                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                >
                    Threads
                </Text>
            </View>

            <View className="mt-3 flex-row items-center border-b border-hairline-light dark:border-hairline-dark pb-2">
                <MaterialIcons name="search" size={18} color={muted} />
                <TextInput
                    accessibilityLabel="Search memory graph"
                    className="ml-2 flex-1 py-1.5 text-[15px] text-text-light dark:text-text-dark"
                    placeholder="Search memories, themes, keywords…"
                    placeholderTextColor={muted}
                    value={query}
                    onChangeText={onQueryChange}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                />
            </View>
        </View>
    );
}
