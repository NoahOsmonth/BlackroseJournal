/**
 * Bottom Navigation Component
 * Tab bar with Today, Explore, FAB, Entries, Settings
 * Matches example-design/today.html exactly
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabName = 'today' | 'explore' | 'entries' | 'settings';

interface BottomNavProps {
    activeTab: TabName;
    onTabPress: (tab: TabName) => void;
    onFabPress?: () => void;
}

interface TabConfig {
    name: TabName;
    icon: keyof typeof MaterialIcons.glyphMap;
    label: string;
}

// Tabs split around FAB: left side and right side
const leftTabs: TabConfig[] = [
    { name: 'today', icon: 'wb-sunny', label: 'Today' },
    { name: 'explore', icon: 'bubble-chart', label: 'Explore' },
];

const rightTabs: TabConfig[] = [
    { name: 'entries', icon: 'style', label: 'Entries' },
    { name: 'settings', icon: 'settings', label: 'Settings' },
];

export function BottomNav({ activeTab, onTabPress, onFabPress }: BottomNavProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();

    const renderTab = (tab: TabConfig) => {
        const isActive = activeTab === tab.name;

        return (
            <Pressable
                key={tab.name}
                onPress={() => onTabPress(tab.name)}
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                className="flex items-center justify-center w-16"
            >
                <MaterialIcons
                    name={tab.icon}
                    size={24}
                    color={isActive ? '#E91E63' : isDark ? '#A0A0A0' : '#757575'}
                    style={{ marginBottom: 4 }}
                />
                <Text
                    className={`text-[10px] ${isActive
                            ? 'font-bold text-primary'
                            : 'font-medium text-text-secondary-light dark:text-text-secondary-dark'
                        }`}
                >
                    {tab.label}
                </Text>
            </Pressable>
        );
    };

    return (
        <View
            className="absolute bottom-0 w-full bg-surface-light dark:bg-surface-dark rounded-t-2xl z-30"
            style={{
                paddingBottom: insets.bottom > 0 ? insets.bottom : 24,
                paddingTop: 12,
                borderTopWidth: 1,
                borderColor: isDark ? '#333333' : '#E5E7EB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 10,
            }}
        >
            <View className="flex-row justify-between items-end px-6">
                {/* Left tabs */}
                <View className="flex-row">
                    {leftTabs.map(renderTab)}
                </View>

                {/* Center FAB */}
                <View className="relative -top-8 mx-2">
                    <Pressable
                        onPress={onFabPress}
                        accessibilityLabel="Create new entry"
                        accessibilityRole="button"
                        className="w-16 h-16 rounded-full bg-primary items-center justify-center"
                        style={{
                            borderWidth: 4,
                            borderColor: isDark ? '#121212' : '#F5F5F5',
                            shadowColor: '#E91E63',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.4,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                    >
                        <MaterialIcons name="edit" size={28} color="#FFFFFF" />
                    </Pressable>
                </View>

                {/* Right tabs */}
                <View className="flex-row">
                    {rightTabs.map(renderTab)}
                </View>
            </View>
        </View>
    );
}