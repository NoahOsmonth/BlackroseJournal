import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AnimatedRemove } from '@/components/ui/AnimatedRemove';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

interface DraftCardProps {
    /** Sentence-case provenance, e.g. "Journal" or "Intention check-in". */
    label: string;
    title: string;
    /** Relative time, e.g. "Today, 5:17 pm". */
    timeLabel: string;
    removing: boolean;
    onPress?: () => void;
    onDelete: () => void;
    onRestore?: () => void;
    onExited: () => void;
}

/**
 * Draft card from black-rose-drafts.png: quiet provenance line, serif title,
 * hairline, then the timestamp with "Delete" / "Restore" as plain text verbs on
 * the right — no icon buttons, no accent-tinted label.
 */
export function DraftCard({
    label,
    title,
    timeLabel,
    removing,
    onPress,
    onDelete,
    onRestore,
    onExited,
}: DraftCardProps) {
    return (
        <AnimatedRemove removing={removing} onExited={onExited}>
            <View
                className={`overflow-hidden rounded-card border bg-surface-light dark:bg-surface-dark ${HAIRLINE}`}
            >
                <Pressable
                    onPress={onPress}
                    disabled={!onPress}
                    accessibilityRole={onPress ? 'button' : undefined}
                    accessibilityLabel={onPress ? `Resume ${title}` : undefined}
                    className={onPress ? 'px-6 py-5 active:opacity-80' : 'px-6 py-5'}
                >
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        {label}
                    </Text>
                    <Text
                        className="mt-2 text-[22px] leading-snug text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        numberOfLines={3}
                    >
                        {title}
                    </Text>
                </Pressable>

                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                <View className="flex-row items-center justify-between px-6 py-4">
                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        {timeLabel}
                    </Text>
                    <View className="flex-row items-center gap-7">
                        <Pressable onPress={onDelete} accessibilityRole="button" accessibilityLabel="Delete">
                            <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Delete
                            </Text>
                        </Pressable>
                        {onRestore ? (
                            <Pressable onPress={onRestore} accessibilityRole="button" accessibilityLabel="Restore">
                                <Text
                                    className="text-[16px] text-text-light dark:text-text-dark"
                                    style={{ fontFamily: 'PlayfairDisplayRegular' }}
                                >
                                    Restore
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                </View>
            </View>
        </AnimatedRemove>
    );
}
