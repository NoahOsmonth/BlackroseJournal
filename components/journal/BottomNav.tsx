/**
 * Bottom Navigation Component
 * Tab bar with Today, Explore, Entries, Settings
 * Matches journal-history.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type TabName = 'today' | 'explore' | 'entries' | 'settings';

interface BottomNavProps {
    activeTab: TabName;
    onTabPress: (tab: TabName) => void;
}

interface TabConfig {
    name: TabName;
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
}

const tabs: TabConfig[] = [
    { name: 'today', icon: 'wb-sunny', label: 'Today' },
    { name: 'explore', icon: 'bubble-chart', label: 'Explore' },
    { name: 'entries', icon: 'book', label: 'Entries' },
    { name: 'settings', icon: 'settings', label: 'Settings' },
];

export function BottomNav({ activeTab, onTabPress }: BottomNavProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <View className="absolute bottom-0 w-full bg-surface-light dark:bg-surface-dark border-t border-divider-light dark:border-divider-dark pt-2 px-2 z-30 pb-6">
            <View className="flex-row justify-around items-end h-14 pb-2">
                {tabs.map((tab, index) => {
                    const isActive = activeTab === tab.name;

                    // Add extra margin for center spacing around FAB
                    const marginClass = index === 1 ? 'mr-8' : index === 2 ? 'ml-8' : '';

                    return (
                        <Pressable
                            key={tab.name}
                            onPress={() => onTabPress(tab.name)}
                            className={`flex items-center justify-center w-16 ${marginClass}`}
                        >
                            <MaterialIcons
                                name={tab.icon}
                                size={24}
                                color={
                                    isActive
                                        ? isDark ? '#E5E5E7' : '#1C1C1E'
                                        : '#8E8E93'
                                }
                                style={{ marginBottom: 4 }}
                            />
                            <Text
                                className={`text-[10px] ${isActive
                                    ? 'font-bold text-text-light dark:text-text-dark'
                                    : 'font-medium text-subtext-light dark:text-subtext-dark'
                                    }`}
                            >
                                {tab.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
