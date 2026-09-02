import { MEMORY_LAYER_LABELS } from '@/components/memory/memoryDisplay';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { navAwareBottomPadding } from '@/constants/spacing';
import { Colors, MemoryLayerColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { LocalMemorySource } from '@/services/memory/localMemory.types';
import type {
    MemoryGraphAtom,
    MemorySourcePreview,
} from '@/services/memory/memoryGraph.types';
import { truncateToWordCount } from '@/services/memory/memoryGraphUtils';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useMemo } from 'react';
import {
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MemoryGraphSourceCard } from './MemoryGraphSourceCard';

function sourceLabel(source: LocalMemorySource): string {
    switch (source) {
        case 'journal': return 'Journal';
        case 'intention': return 'Intention';
        case 'feedback': return 'Feedback';
        case 'manual': return 'Note';
        case 'system': return 'System';
        default: return source;
    }
}

function formatRelativeDate(iso: string): string {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return '';
    const days = Math.floor((Date.now() - ts) / 86_400_000);
    if (days <= 0) return 'Today';
    if (days === 1) return '1d ago';
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface SheetProps {
    atom: MemoryGraphAtom;
    localInsight: string | null;
    isGlanceLoading?: boolean;
    remoteInsight: string | null;
    isDeepening: boolean;
    sourcePreview: MemorySourcePreview | null;
    isSourceLoading: boolean;
    sourceMissing: boolean;
    relatedAtoms: readonly MemoryGraphAtom[];
    onClose: () => void;
    onDeepen: () => void;
    onOpenSource: () => void;
    onSelectRelated?: (id: string) => void;
}

export function MemoryGraphSheet({
    atom,
    localInsight,
    isGlanceLoading = false,
    remoteInsight,
    isDeepening,
    sourcePreview,
    isSourceLoading,
    sourceMissing,
    relatedAtoms,
    onClose,
    onDeepen,
    onOpenSource,
    onSelectRelated,
}: SheetProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const insets = useSafeAreaInsets();
    const iconColor = isDark ? Colors.dark.text : Colors.light.text;
    const layerColor = MemoryLayerColors[atom.layer];
    const displayedRemote = useMemo(
        () => (remoteInsight ? truncateToWordCount(remoteInsight, 50) : null),
        [remoteInsight]
    );
    const dateLabel = formatRelativeDate(atom.createdAt);

    return (
        <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 max-h-[62%] items-center px-3"
            style={{ bottom: navAwareBottomPadding(insets.bottom) }}
        >
            <View
                className="w-full max-w-xl overflow-hidden rounded-[28px] border
                border-divider-light dark:border-divider-dark
                bg-surface-light dark:bg-surface-dark"
                style={{
                    flexShrink: 1,
                    shadowColor: layerColor,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: isDark ? 0.28 : 0.16,
                    shadowRadius: 28,
                    elevation: 16,
                }}
            >
                {/* Aurora accent rail */}
                <View
                    className="h-1 w-full"
                    style={{
                        backgroundColor: layerColor,
                        opacity: isDark ? 0.85 : 0.75,
                    }}
                />

                <View className="px-4 pb-2 pt-3">
                    <View className="mb-3 h-1 w-10 self-center rounded-full bg-divider-light dark:bg-divider-dark" />
                    <View className="mb-3 flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1">
                            <Text
                                className="text-xl font-bold leading-7 text-text-light dark:text-text-dark"
                                numberOfLines={2}
                                style={{ fontFamily: 'PlayfairDisplayBold' }}
                            >
                                {atom.title}
                            </Text>
                            <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
                                <View
                                    className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
                                    style={{ backgroundColor: `${layerColor}${isDark ? '33' : '40'}` }}
                                >
                                    <View
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ backgroundColor: layerColor }}
                                    />
                                    <Text
                                        className="text-[11px] font-semibold text-text-light dark:text-white"
                                    >
                                        {MEMORY_LAYER_LABELS[atom.layer]}
                                    </Text>
                                </View>
                                <Text
                                    className="rounded-full bg-background-light px-2.5 py-1
                                    text-[11px] font-medium text-text-secondary-light
                                    dark:bg-background-dark dark:text-text-secondary-dark"
                                >
                                    {sourceLabel(atom.source)}
                                </Text>
                                {dateLabel ? (
                                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {dateLabel}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                        <Pressable
                            accessibilityLabel="Close memory detail"
                            accessibilityRole="button"
                            className="h-10 w-10 items-center justify-center rounded-2xl
                            bg-background-light dark:bg-background-dark"
                            onPress={onClose}
                        >
                            <MaterialIcons name="close" size={18} color={iconColor} />
                        </Pressable>
                    </View>
                </View>

                <ScrollView
                    className="px-4"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 8 }}
                >
                    <Text className="text-[15px] leading-6 text-text-secondary-light dark:text-text-secondary-dark">
                        {atom.content}
                    </Text>

                    {atom.tags.length > 0 && (
                        <View className="mt-3.5 flex-row flex-wrap gap-2">
                            {atom.tags.slice(0, 8).map((tag) => (
                                <Text
                                    key={tag}
                                    className="rounded-xl border border-divider-light px-2.5 py-1.5
                                    text-xs text-text-secondary-light
                                    dark:border-divider-dark dark:text-text-secondary-dark"
                                >
                                    {tag}
                                </Text>
                            ))}
                        </View>
                    )}

                    {(isGlanceLoading || localInsight) ? (
                        <View
                            className="mt-4 rounded-2xl border border-divider-light p-3.5
                            dark:border-divider-dark dark:bg-background-dark"
                            style={{ backgroundColor: isDark ? undefined : `${layerColor}12` }}
                        >
                            <Text
                                className="text-[11px] font-bold uppercase tracking-wider"
                                style={{ color: layerColor }}
                            >
                                At a glance
                            </Text>
                            {isGlanceLoading && !localInsight ? (
                                <SkeletonText
                                    lines={2}
                                    lineClassName="h-4"
                                    className="mt-3 gap-2"
                                    accessibilityLabel="Writing insight"
                                />
                            ) : (
                                <Text className="mt-2 text-sm leading-5 text-text-light dark:text-text-dark">
                                    {localInsight}
                                </Text>
                            )}
                        </View>
                    ) : null}

                    <MemoryGraphSourceCard
                        preview={sourcePreview}
                        isLoading={isSourceLoading}
                        missing={sourceMissing}
                        onOpen={onOpenSource}
                    />

                    {relatedAtoms.length > 0 ? (
                        <View className="mt-4 gap-2">
                            <Text className="text-[11px] font-bold uppercase tracking-wider
                            text-text-secondary-light dark:text-text-secondary-dark">
                                Linked stars
                            </Text>
                            {relatedAtoms.map((related) => (
                                <Pressable
                                    key={related.id}
                                    accessibilityLabel={`Open related memory ${related.title}`}
                                    accessibilityRole="button"
                                    className="flex-row items-center gap-2.5 rounded-2xl border
                                    border-divider-light px-3 py-2.5
                                    dark:border-divider-dark dark:bg-background-dark"
                                    onPress={() => onSelectRelated?.(related.id)}
                                >
                                    <View
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: MemoryLayerColors[related.layer] }}
                                    />
                                    <Text
                                        className="min-w-0 flex-1 text-sm font-medium
                                        text-text-light dark:text-text-dark"
                                        numberOfLines={1}
                                    >
                                        {related.title}
                                    </Text>
                                    <Text className="text-[11px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {MEMORY_LAYER_LABELS[related.layer]}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    ) : null}

                    {displayedRemote ? (
                        <View className="mt-4 rounded-2xl bg-background-light p-3.5 dark:bg-background-dark">
                            <Text className="text-[11px] font-bold uppercase tracking-wider
                            text-primary dark:text-primary-dark">
                                Deeper read
                            </Text>
                            <Text className="mt-2 text-sm leading-5 text-text-light dark:text-text-dark">
                                {displayedRemote}
                            </Text>
                        </View>
                    ) : null}

                    <Pressable
                        accessibilityLabel="Deepen with AI"
                        accessibilityRole="button"
                        className="mb-3 mt-4 min-h-12 items-center justify-center rounded-2xl px-4"
                        style={{ backgroundColor: layerColor }}
                        disabled={isDeepening}
                        onPress={onDeepen}
                    >
                        {isDeepening ? (
                            <LoadingBar size="sm" accessibilityLabel="Deepening with AI" />
                        ) : (
                            <Text className="text-sm font-bold text-text-light">
                                Deepen with AI
                            </Text>
                        )}
                    </Pressable>
                </ScrollView>
            </View>
        </View>
    );
}
