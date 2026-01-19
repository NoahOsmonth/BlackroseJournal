/**
 * StatCard Component
 * Single stat card (Streak/Entries/Words)
 * Matches today.html design
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface StatCardProps {
    label: string;
    value: string | number;
    onPress?: () => void;
    accessibilityLabel?: string;
}

export function StatCard({ label, value, onPress, accessibilityLabel }: StatCardProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const Card = onPress ? Pressable : View;

    return (
        <Card
            {...(onPress && { onPress })}
            accessibilityLabel={accessibilityLabel || `${label}: ${value}`}
            accessibilityRole={onPress ? 'button' : 'text'}
            className={`bg-surface-light dark:bg-surface-dark rounded-xl p-3 h-20 flex flex-col items-center justify-center ${isDark ? 'border border-border-dark' : ''
                }`}
            style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0 : 0.03,
                shadowRadius: 5,
                elevation: isDark ? 0 : 2,
            }}
        >
            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark mb-1">
                {label}
            </Text>
            <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                {value}
            </Text>
        </Card>
    );
}
