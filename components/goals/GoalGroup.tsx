import React from 'react';
import { Pressable, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface GoalItem {
    readonly id: string;
    readonly title: string;
    readonly completed: boolean;
    /** Trailing meta, e.g. "4 day streak". */
    readonly meta?: string;
}

interface GoalGroupProps {
    readonly label: string;
    readonly items: readonly GoalItem[];
    readonly emptyMessage: string;
    readonly onToggle: (id: string) => void;
}

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

/**
 * One bordered group, hairline-divided rows, and a square checkbox on the LEFT
 * — the concept's goal/habit list. A completed box fills with sage; the label
 * stays in ink either way.
 */
function GoalGroup({ label, items, emptyMessage, onToggle }: GoalGroupProps) {
    const isDark = useColorScheme() === 'dark';
    const emptyColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const checkColor = isDark ? BLACKROSE_PALETTE.dark.bg : BLACKROSE_PALETTE.light.surface;

    return (
        <View className="gap-3">
            <Text
                className="text-[19px] text-text-light dark:text-text-dark"
                style={{ fontFamily: 'PlayfairDisplayRegular' }}
            >
                {label}
            </Text>

            {items.length === 0 ? (
                <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                    {emptyMessage}
                </Text>
            ) : (
                <View className={`overflow-hidden rounded-card border ${HAIRLINE}`}>
                    {items.map((item, index) => (
                        <Pressable
                            key={item.id}
                            onPress={() => onToggle(item.id)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: item.completed }}
                            accessibilityLabel={item.title}
                            className={`min-h-14 flex-row items-center gap-3.5 px-4 py-3 ${
                                index > 0 ? `border-t ${HAIRLINE}` : ''
                            }`}
                        >
                            <View
                                className={
                                    item.completed
                                        ? 'h-7 w-7 items-center justify-center rounded-[3px] bg-ok-light dark:bg-ok-dark'
                                        : `h-7 w-7 items-center justify-center rounded-[3px] border ${HAIRLINE}`
                                }
                            >
                                {item.completed ? (
                                    <MaterialIcons name="check" size={18} color={checkColor} />
                                ) : null}
                            </View>

                            <Text
                                className="min-w-0 flex-1 text-[17px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                numberOfLines={2}
                            >
                                {item.title}
                            </Text>

                            {item.meta ? (
                                <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {item.meta}
                                </Text>
                            ) : null}
                        </Pressable>
                    ))}
                </View>
            )}
        </View>
    );
}

export { GoalGroup };
