import React from 'react';
import { Pressable, Text, View } from 'react-native';

interface ChatErrorCardProps {
    message: string;
    onRetry?: () => void;
    onDismiss: () => void;
}

/** Inline send failure — hairline card, outline retry, quiet dismiss. */
export function ChatErrorCard({ message, onRetry, onDismiss }: ChatErrorCardProps) {
    return (
        <View
            accessibilityRole="alert"
            accessibilityLabel={message}
            className="rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark"
        >
            <Text className="text-sm text-text-light dark:text-text-dark">{message}</Text>
            <View className="mt-3 flex-row items-center justify-end gap-3">
                {onRetry ? (
                    <Pressable
                        onPress={onRetry}
                        accessibilityRole="button"
                        accessibilityLabel="Retry AI request"
                        className="rounded-control border border-hairline-light px-3 py-1.5 dark:border-hairline-dark"
                    >
                        <Text className="text-xs text-text-light dark:text-text-dark">Retry</Text>
                    </Pressable>
                ) : null}
                <Pressable
                    onPress={onDismiss}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss error message"
                    className="px-2 py-1"
                >
                    <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                        Dismiss
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}
