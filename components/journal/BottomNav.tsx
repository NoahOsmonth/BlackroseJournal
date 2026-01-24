/**
 * Bottom Navigation Component
 * Matches updated today/history designs (glass dark nav + center FAB).
 */

import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabName = 'today' | 'explore' | 'entries' | 'insights' | 'settings';

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

const leftTabs: TabConfig[] = [
    { name: 'today', icon: 'today', label: 'Today' },
    { name: 'explore', icon: 'explore', label: 'Explore' },
];

const rightTabs: TabConfig[] = [
    { name: 'insights', icon: 'lightbulb', label: 'Insights' },
    { name: 'entries', icon: 'history-edu', label: 'History' },
];

export function BottomNav({ activeTab, onTabPress, onFabPress }: BottomNavProps) {
    const insets = useSafeAreaInsets();

    const renderTab = (tab: TabConfig) => {
        const isActive = activeTab === tab.name;
        const color = isActive ? '#FFFFFF' : '#6B7280';

        return (
            <Pressable
                key={tab.name}
                onPress={() => onTabPress(tab.name)}
                accessibilityLabel={tab.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                className="flex items-center justify-center w-14"
            >
                <MaterialIcons name={tab.icon} size={26} color={color} />
                <Text className={`text-[10px] font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>
                    {tab.label}
                </Text>
            </Pressable>
        );
    };

    return (
        <View
            className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/90 px-6 pt-3 pb-8 z-30"
            style={{ paddingBottom: (insets.bottom || 0) + 16 }}
        >
            <View className="flex-row items-end justify-between">
                {leftTabs.map(renderTab)}

                <View className="relative w-16 items-center">
                    <Pressable
                        onPress={onFabPress}
                        accessibilityLabel="Create new entry"
                        accessibilityRole="button"
                        className="w-16 h-16 rounded-full bg-white items-center justify-center"
                        style={{
                            shadowColor: '#000',
                            shadowOpacity: 0.35,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 4 },
                            elevation: 10,
                        }}
                    >
                        <MaterialIcons name="add" size={32} color="#000000" />
                    </Pressable>
                </View>

                {rightTabs.map(renderTab)}
            </View>
            <View className="items-center mt-3">
                <View className="w-32 h-1 rounded-full bg-white/20" />
            </View>
        </View>
    );
}
