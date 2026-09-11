import { MEMORY_LAYER_LABELS } from '@/components/memory/memoryDisplay';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { navAwareBottomPadding } from '@/constants/spacing';
import { BLACKROSE_PALETTE, memoryLayerShades } from '@/constants/theme';
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
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MemoryGraphSourceCard } from './MemoryGraphSourceCard';

const SERIF = 'PlayfairDisplayRegular';
const SECONDARY_TEXT = 'text-text-secondary-light dark:text-text-secondary-dark';
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';
const SECTION = `mt-5 border-t pt-4 ${HAIRLINE}`;
const CHIP = `rounded-control border px-2.5 py-1 text-[13px] text-text-light ${HAIRLINE} dark:text-text-dark`;

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

function SectionHeading({ children }: { children: string }) {
    return (
        <Text className="text-[19px] text-text-light dark:text-text-dark" style={{ fontFamily: SERIF }}>
            {children}
        </Text>
    );
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

/**
 * Node sheet for a selected memory. Matches black-rose-graph-node-sheet.png:
 * a bone rule runs the sheet's full height, the title and section headings are
 * the serif moments, and every chip / row / action is an outline on hairlines.
 */
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
    const { height: windowHeight } = useWindowDimensions();
    // Percentage max-height is unreliable on web, so the cap is resolved to px:
    // the sheet must never grow past its share of the screen and shove its own
    // title off the top. The body scrolls inside the cap instead.
    const sheetMaxHeight = Math.round(windowHeight * 0.62);
    const scheme = isDark ? 'dark' : 'light';
    const palette = isDark ? BLACKROSE_PALETTE.dark : BLACKROSE_PALETTE.light;
    const displayedRemote = useMemo(
        () => (remoteInsight ? truncateToWordCount(remoteInsight, 50) : null),
        [remoteInsight]
    );
    const dateLabel = formatRelativeDate(atom.createdAt);

    return (
        <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 items-center px-3"
            style={{ bottom: navAwareBottomPadding(insets.bottom) }}
        >
            <View
                className={`w-full max-w-xl overflow-hidden rounded-sheet border bg-surface-light dark:bg-surface-dark ${HAIRLINE}`}
                style={{
                    maxHeight: sheetMaxHeight,
                    shadowColor: palette.bg,
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: isDark ? 0.55 : 0.14,
                    shadowRadius: 28,
                    elevation: 16,
                }}
            >
                <View className="items-center pb-1 pt-3">
                    <View className="h-1 w-10 rounded-full bg-hairline-light dark:bg-hairline-dark" />
                </View>

                <View className="min-h-0 flex-1 flex-row">
                    <View className="ml-5 w-px self-stretch bg-bone-light dark:bg-bone-dark" />

                    <View className="min-h-0 min-w-0 flex-1">
                        <View className="flex-row items-start gap-3 pl-4 pr-1 pt-2">
                            <View className="min-w-0 flex-1 gap-3">
                                <Text
                                    className="text-[28px] leading-9 text-text-light dark:text-text-dark"
                                    numberOfLines={2}
                                    style={{ fontFamily: SERIF }}
                                >
                                    {atom.title}
                                </Text>
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className={CHIP}>{MEMORY_LAYER_LABELS[atom.layer]}</Text>
                                    <Text className={CHIP}>{sourceLabel(atom.source)}</Text>
                                    {dateLabel ? (
                                        <Text className={`text-[13px] ${SECONDARY_TEXT}`}>
                                            {dateLabel}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                            <Pressable
                                accessibilityLabel="Close memory detail"
                                accessibilityRole="button"
                                hitSlop={8}
                                className="h-10 w-10 items-center justify-center"
                                onPress={onClose}
                            >
                                <MaterialIcons name="close" size={20} color={palette.text2} />
                            </Pressable>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                        >
                            <Text
                                className="mt-3 text-[16px] leading-7 text-text-light dark:text-text-dark"
                                style={{ fontFamily: SERIF }}
                            >
                                {atom.content}
                            </Text>

                            {atom.tags.length > 0 && (
                                <View className="mt-4 flex-row flex-wrap gap-2">
                                    {atom.tags.slice(0, 4).map((tag) => (
                                        <Text key={tag} className={CHIP}>
                                            {tag}
                                        </Text>
                                    ))}
                                </View>
                            )}

                            {isGlanceLoading || localInsight ? (
                                <View className={SECTION}>
                                    <SectionHeading>At a glance</SectionHeading>
                                    {isGlanceLoading && !localInsight ? (
                                        <SkeletonText
                                            lines={2}
                                            lineClassName="h-4"
                                            className="mt-3 gap-2"
                                            accessibilityLabel="Writing insight"
                                        />
                                    ) : (
                                        <Text className={`mt-2 text-[15px] leading-6 ${SECONDARY_TEXT}`}>
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
                                <View className={SECTION}>
                                    <SectionHeading>Linked stars</SectionHeading>
                                    <View className={`mt-3 overflow-hidden rounded-card border ${HAIRLINE}`}>
                                        {relatedAtoms.map((related, index) => (
                                            <Pressable
                                                key={related.id}
                                                accessibilityLabel={`Open related memory ${related.title}`}
                                                accessibilityRole="button"
                                                className={
                                                    index > 0
                                                        ? `flex-row items-center gap-3 border-t px-4 py-3.5 ${HAIRLINE}`
                                                        : 'flex-row items-center gap-3 px-4 py-3.5'
                                                }
                                                onPress={() => onSelectRelated?.(related.id)}
                                            >
                                                <View
                                                    className={`h-4 w-4 items-center justify-center rounded-full border ${HAIRLINE}`}
                                                >
                                                    <View
                                                        className="h-2 w-2 rounded-full"
                                                        style={{
                                                            backgroundColor: memoryLayerShades(
                                                                related.layer,
                                                                scheme
                                                            ).deep,
                                                        }}
                                                    />
                                                </View>
                                                <Text
                                                    className="min-w-0 flex-1 text-[15px] text-text-light dark:text-text-dark"
                                                    numberOfLines={1}
                                                    style={{ fontFamily: SERIF }}
                                                >
                                                    {related.title}
                                                </Text>
                                                <MaterialIcons
                                                    name="chevron-right"
                                                    size={20}
                                                    color={palette.text2}
                                                />
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            ) : null}

                            {displayedRemote ? (
                                <View className={SECTION}>
                                    <SectionHeading>Deeper read</SectionHeading>
                                    <Text className={`mt-2 text-[15px] leading-6 ${SECONDARY_TEXT}`}>
                                        {displayedRemote}
                                    </Text>
                                </View>
                            ) : null}

                            <Pressable
                                accessibilityLabel="Deepen with AI"
                                accessibilityRole="button"
                                className={`mt-5 min-h-12 flex-row items-center justify-center gap-2 rounded-control border px-4 ${HAIRLINE}`}
                                disabled={isDeepening}
                                onPress={onDeepen}
                            >
                                {isDeepening ? (
                                    <LoadingBar size="sm" accessibilityLabel="Deepening with AI" />
                                ) : (
                                    <>
                                        <MaterialIcons
                                            name="auto-awesome"
                                            size={18}
                                            color={palette.accent}
                                        />
                                        <Text
                                            className="text-[15px] text-text-light dark:text-text-dark"
                                            style={{ fontFamily: SERIF }}
                                        >
                                            Deepen with AI
                                        </Text>
                                    </>
                                )}
                            </Pressable>
                        </ScrollView>
                    </View>
                </View>
            </View>
        </View>
    );
}
