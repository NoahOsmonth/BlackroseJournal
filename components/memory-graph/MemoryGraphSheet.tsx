import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, MemoryLayerColors } from '@/constants/theme';
import { navAwareBottomPadding } from '@/constants/spacing';
import type { LocalMemorySource } from '@/services/memory/localMemory.types';
import type { MemoryGraphAtom } from '@/services/memory/memoryGraph.types';
import { truncateToWordCount } from '@/services/memory/memoryGraphUtils';

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

interface SheetProps {
    atom: MemoryGraphAtom;
    insight: string | null;
    isLoading: boolean;
    onClose: () => void;
    onSynthesize: () => void;
}

export function MemoryGraphSheet({
    atom,
    insight,
    isLoading,
    onClose,
    onSynthesize,
}: SheetProps) {
    const colorScheme = useColorScheme();
    const insets = useSafeAreaInsets();
    const iconColor = colorScheme === 'dark' ? Colors.dark.text : Colors.light.text;
    const displayedInsight = useMemo(
        () => (insight ? truncateToWordCount(insight, 50) : null),
        [insight]
    );

    return (
        <View
            pointerEvents="box-none"
            className="absolute left-0 right-0 max-h-[48%] items-center px-3"
            style={{ bottom: navAwareBottomPadding(insets.bottom) }}
        >
            <View
                className="w-full max-w-xl rounded-3xl border
                border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-4"
                style={{
                    flexShrink: 1,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 24,
                    elevation: 12,
                }}
            >
                <View className="mb-3 h-1 w-10 self-center rounded-full bg-divider-light dark:bg-divider-dark" />
                <View className="mb-3 flex-row items-start justify-between">
                    <View className="flex-1 pr-3">
                        <Text className="text-lg font-bold text-text-light dark:text-text-dark">
                            {atom.title}
                        </Text>
                        <View className="mt-1 flex-row gap-2">
                            <Text
                                className="self-start rounded-full px-2 py-1 text-[10px] font-bold
                                uppercase text-background-dark dark:text-background-dark"
                                style={{ backgroundColor: MemoryLayerColors[atom.layer] }}
                            >
                                {atom.layer}
                            </Text>
                            <Text
                                className="self-start rounded-full bg-background-light px-2 py-1
                                text-[10px] font-bold uppercase text-text-secondary-light
                                dark:bg-background-dark dark:text-text-secondary-dark"
                            >
                                {sourceLabel(atom.source)}
                            </Text>
                        </View>
                    </View>
                    <Pressable
                        accessibilityLabel="Close memory detail"
                        accessibilityRole="button"
                        className="h-9 w-9 items-center justify-center rounded-full
                        bg-background-light dark:bg-background-dark"
                        onPress={onClose}
                    >
                        <MaterialIcons name="close" size={18} color={iconColor} />
                    </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <Text className="text-sm leading-6 text-text-secondary-light dark:text-text-secondary-dark">
                        {atom.content}
                    </Text>

                    {atom.tags.length > 0 && (
                        <View className="mt-4 flex-row flex-wrap gap-2">
                            {atom.tags.slice(0, 8).map((tag) => (
                                <Text
                                    key={tag}
                                    className="rounded-lg border border-divider-light dark:border-divider-dark px-2 py-1
                                    text-xs text-text-secondary-light dark:text-text-secondary-dark"
                                >
                                    {tag}
                                </Text>
                            ))}
                        </View>
                    )}

                    {displayedInsight && (
                        <View className="mt-4 rounded-2xl bg-background-light dark:bg-background-dark p-3">
                            <Text className="text-xs font-bold uppercase text-primary dark:text-primary">
                                LLM Insight
                            </Text>
                            <Text className="mt-2 text-sm leading-5 text-text-light dark:text-text-dark">
                                {displayedInsight}
                            </Text>
                        </View>
                    )}

                    <Pressable
                        accessibilityLabel="Synthesize memory insight"
                        accessibilityRole="button"
                        className="mb-2 mt-4 min-h-12 items-center justify-center rounded-2xl bg-primary px-4"
                        disabled={isLoading}
                        onPress={onSynthesize}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={Colors.dark.background} />
                        ) : (
                            <Text className="text-sm font-bold text-background-dark dark:text-background-dark">
                                Synthesize Insight
                            </Text>
                        )}
                    </Pressable>
                </ScrollView>
            </View>
        </View>
    );
}
