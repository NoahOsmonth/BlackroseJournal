import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, useReducedMotion } from 'react-native-reanimated';

import { LoadingBar } from './LoadingBar';

interface LoadingStatusProps {
    /** Clear, human-readable description of the work in progress. */
    label: string;
    /** Optional second line for longer-running work. */
    detail?: string;
    /** Condense to a single line for tight spaces such as action footers. */
    compact?: boolean;
    className?: string;
}

/**
 * A small, accessible status row for async work. It pairs an animated wave
 * with real language so a task never looks like an empty or frozen control.
 */
export function LoadingStatus({
    label,
    detail,
    compact = false,
    className = '',
}: LoadingStatusProps) {
    const reduceMotion = useReducedMotion();

    return (
        <Animated.View
            entering={reduceMotion ? undefined : FadeInDown.duration(180)}
            exiting={reduceMotion ? undefined : FadeOutUp.duration(140)}
            accessibilityRole="progressbar"
            accessibilityLabel={label}
            className={`flex-row items-center gap-3 ${compact ? '' : 'rounded-2xl bg-primary/10 dark:bg-primary/20 px-4 py-3'} ${className}`}
        >
            <LoadingBar size="sm" tone="primary" accessibilityLabel={`${label} animation`} />
            <View className="min-w-0 flex-1 gap-0.5">
                <Text className="text-sm font-semibold text-text-light dark:text-text-dark">
                    {label}
                </Text>
                {detail ? (
                    <Text className="text-xs leading-4 text-text-secondary-light dark:text-text-secondary-dark">
                        {detail}
                    </Text>
                ) : null}
            </View>
        </Animated.View>
    );
}
