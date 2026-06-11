import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
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
import type { LocalMemoryAtom } from '@/services/memory/memoryGraph.types';

interface SheetProps {
    atom: LocalMemoryAtom;
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

    return (
        <View
            className="absolute left-3 right-3 max-h-[48%] rounded-3xl border
            border-divider-light dark:border-divider-dark bg-surface-light dark:bg-surface-dark p-4"
            style={{ bottom: navAwareBottomPadding(insets.bottom) }}
        >
            <View className="mb-3 flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                    <Text className="text-lg font-bold text-text-light dark:text-text-dark">
                        {atom.title}
                    </Text>
                    <Text
                        className="mt-1 self-start rounded-full px-2 py-1 text-[10px] font-bold
                        uppercase text-background-dark dark:text-background-dark"
                        style={{ backgroundColor: MemoryLayerColors[atom.layer] }}
                    >
                        {atom.layer}
                    </Text>
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

                {insight && (
                    <View className="mt-4 rounded-2xl bg-background-light dark:bg-background-dark p-3">
                        <Text className="text-xs font-bold uppercase text-primary dark:text-primary">
                            LLM Insight
                        </Text>
                        <Text className="mt-2 text-sm leading-5 text-text-light dark:text-text-dark">
                            {insight}
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
    );
}
