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
        <View className="mb-6 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
            <Text className="mb-4 text-[12px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                {title}
            </Text>
            {children}
        </View>
    );
}
