import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Text, View } from 'react-native';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface StatsProps {
    memories: number;
    links: number;
    themes: number;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/**
 * Threads foot strip from black-rose-threads.png: memories / links / themes as
 * three hairline-divided cells, numerals set in the serif.
 */
export function MemoryGraphStats({ memories, links, themes }: StatsProps) {
    const isDark = useColorScheme() === 'dark';
    const muted = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const cells = [
        { key: 'memories', icon: 'apps' as const, value: memories, label: 'Memories' },
        { key: 'links', icon: 'link' as const, value: links, label: 'Links' },
        { key: 'themes', icon: 'track-changes' as const, value: themes, label: 'Themes' },
    ];

    return (
        <View className={`mx-5 mb-3 flex-row overflow-hidden rounded-card border ${HAIRLINE}`}>
            {cells.map((cell, index) => (
                <View
                    key={cell.key}
                    className={
                        index > 0
                            ? `min-w-0 flex-1 flex-row items-center gap-3 border-l px-4 py-3.5 ${HAIRLINE}`
                            : 'min-w-0 flex-1 flex-row items-center gap-3 px-4 py-3.5'
                    }
                >
                    <MaterialIcons name={cell.icon} size={22} color={muted} />
                    <View className="min-w-0">
                        <Text
                            className="text-[26px] leading-8 text-text-light dark:text-text-dark"
                            style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        >
                            {cell.value}
                        </Text>
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            {cell.label}
                        </Text>
                    </View>
                </View>
            ))}
        </View>
    );
}
