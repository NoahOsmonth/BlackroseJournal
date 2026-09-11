/**
 * SectionLabel — the small uppercase caption above a group of rows
 * (INTENTIONS, GOALS). Concept language: quiet, letter-spaced, secondary ink.
 */

import React from 'react';
import { Text, View } from 'react-native';

interface SectionLabelProps {
    readonly children: string;
    /** Optional trailing action rendered on the right (e.g. "Add"). */
    readonly action?: React.ReactNode;
}

export function SectionLabel({ children, action }: SectionLabelProps) {
    return (
        <View className="flex-row items-center justify-between">
            <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                {children}
            </Text>
            {action}
        </View>
    );
}
