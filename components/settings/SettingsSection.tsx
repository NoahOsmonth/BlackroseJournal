import React from 'react';
import { Text, View } from 'react-native';

interface SettingsSectionProps {
    readonly title: string;
    readonly children: React.ReactNode;
    /** When true, render body only (accordion shell owns the card chrome). */
    readonly embedded?: boolean;
}

export function SettingsSection({
    title,
    children,
    embedded = false,
}: SettingsSectionProps) {
    if (embedded) {
        return <View>{children}</View>;
    }

    return (
        <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
            <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                {title}
            </Text>
            {children}
        </View>
    );
}
