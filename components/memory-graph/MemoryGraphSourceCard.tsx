import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MemorySourcePreview } from '@/services/memory/memoryGraph.types';

const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const SECTION = `mt-5 border-t pt-4 ${HAIRLINE}`;
const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';

interface SourceCardProps {
    preview: MemorySourcePreview | null;
    isLoading: boolean;
    missing: boolean;
    onOpen: () => void;
}

function SourceHeading() {
    return (
        <Text className="text-[19px] text-text-light dark:text-text-dark" style={{ fontFamily: 'PlayfairDisplayRegular' }}>
            Source
        </Text>
    );
}

/**
 * Provenance block: the journal entry or check-in a memory came from. One
 * bordered row on hairlines — no filled panel, no emoji glyph.
 */
export function MemoryGraphSourceCard({
    preview,
    isLoading,
    missing,
    onOpen,
}: SourceCardProps) {
    const isDark = useColorScheme() === 'dark';
    const palette = isDark ? BLACKROSE_PALETTE.dark : BLACKROSE_PALETTE.light;

    if (isLoading) {
        return (
            <View className={SECTION} accessibilityLabel="Loading source">
                <SourceHeading />
                <View className={`mt-3 gap-3 rounded-card border px-4 py-3.5 ${HAIRLINE}`}>
                    <Skeleton className="h-3 w-16" accessibilityLabel="Loading source label" />
                    <SkeletonText lines={2} lineClassName="h-4" accessibilityLabel="Loading source title" />
                    <Skeleton className="h-3 w-32" accessibilityLabel="Loading source metadata" />
                </View>
            </View>
        );
    }

    if (missing) {
        return (
            <View className={SECTION}>
                <SourceHeading />
                <View className={`mt-3 rounded-card border px-4 py-3.5 ${HAIRLINE}`}>
                    <Text className={`text-[15px] ${SECONDARY_TEXT}`}>
                        Source no longer available.
                    </Text>
                </View>
            </View>
        );
    }

    if (!preview) {
        return null;
    }

    const kindLabel = preview.kind === 'journal_entry' ? 'Journal' : 'Check-in';
    const metaParts = [
        preview.dateLabel,
        kindLabel,
        preview.messageCount > 0 ? `${preview.messageCount} messages` : null,
        preview.mood,
    ].filter(Boolean);

    return (
        <View className={SECTION}>
            <SourceHeading />
            <Pressable
                accessibilityLabel="Open conversation"
                accessibilityRole="button"
                className={`mt-3 flex-row items-start gap-3 rounded-card border px-4 py-3.5 ${HAIRLINE}`}
                onPress={onOpen}
            >
                <MaterialIcons
                    name={preview.kind === 'journal_entry' ? 'menu-book' : 'flag'}
                    size={20}
                    color={palette.text2}
                />
                <View className="min-w-0 flex-1 gap-1">
                    <Text
                        className="text-[15px] text-text-light dark:text-text-dark"
                        numberOfLines={2}
                    >
                        {preview.title}
                    </Text>
                    <Text className={`text-[13px] ${SECONDARY_TEXT}`} numberOfLines={1}>
                        {metaParts.join(' · ')}
                    </Text>
                    {preview.intentionTitle ? (
                        <Text className={`text-[13px] ${SECONDARY_TEXT}`} numberOfLines={1}>
                            Intention: {preview.intentionTitle}
                        </Text>
                    ) : null}
                    {preview.snippet ? (
                        <Text
                            className={`mt-1 text-[13px] leading-5 ${SECONDARY_TEXT}`}
                            numberOfLines={2}
                        >
                            “{preview.snippet}”
                        </Text>
                    ) : null}
                </View>
                <MaterialIcons name="chevron-right" size={20} color={palette.text2} />
            </Pressable>
        </View>
    );
}
