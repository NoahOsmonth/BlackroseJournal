/**
 * Suggestions Screen
 * Shows HABIT suggestions for an entry and allows adding them to Happiness Recipe.
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEntryReflection } from '@/hooks/useEntryReflection';
import { useHappinessRecipe } from '@/hooks/useHappinessRecipe';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SuggestionsParams {
    entryId?: string;
}

function normalize(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function SuggestionsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const params = useLocalSearchParams<SuggestionsParams>();

    const entryId = useMemo(() => {
        const raw = params.entryId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.entryId]);

    const { data, isLoading, error } = useEntryReflection(entryId);
    const { items, addItem } = useHappinessRecipe();
    const [addingText, setAddingText] = useState<string | null>(null);

    const existingHabits = useMemo(() => {
        return new Set(
            items
                .filter((i) => i.type === 'habit')
                .map((i) => normalize(i.text))
        );
    }, [items]);

    const suggestions = data?.suggestions ?? [];

    const handleAdd = async (text: string) => {
        if (!text.trim()) return;
        if (existingHabits.has(normalize(text))) return;

        setAddingText(text);
        try {
            await addItem('habit', text);
        } finally {
            setAddingText(null);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2" accessibilityLabel="Back">
                        <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                        />
                    </Pressable>
                    <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        Suggestions
                    </Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    {isLoading && (
                        <View className="items-center py-10">
                            <ActivityIndicator size="small" color="#E91E63" />
                            <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Loading suggestions…
                            </Text>
                        </View>
                    )}

                    {!isLoading && error && (
                        <View className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
                            <Text className="text-text-main-light dark:text-text-main-dark font-semibold">
                                Couldn’t load suggestions
                            </Text>
                            <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                {error}
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && suggestions.length === 0 && (
                        <View className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
                            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                No suggestions yet.
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && suggestions.length > 0 && (
                        <View className="gap-y-3">
                            {suggestions.map((s, idx) => {
                                const alreadyAdded = existingHabits.has(normalize(s.text));
                                const isAdding = addingText === s.text;

                                return (
                                    <View
                                        key={`${idx}-${s.text}`}
                                        className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark"
                                    >
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center">
                                                <View className="px-2 py-1 rounded-lg bg-primary/10">
                                                    <Text className="text-[11px] font-bold text-primary">HABIT</Text>
                                                </View>
                                            </View>

                                            <Pressable
                                                onPress={() => handleAdd(s.text)}
                                                disabled={alreadyAdded || isAdding}
                                                accessibilityLabel={`Add habit: ${s.text}`}
                                                className={`px-4 py-2 rounded-xl ${alreadyAdded
                                                        ? 'bg-slate-200 dark:bg-slate-800'
                                                        : 'bg-primary'
                                                    }`}
                                            >
                                                <Text className={`text-sm font-bold ${alreadyAdded
                                                        ? 'text-slate-500 dark:text-slate-400'
                                                        : 'text-white'
                                                    }`}>
                                                    {alreadyAdded ? 'Added' : isAdding ? 'Adding…' : 'Add to list'}
                                                </Text>
                                            </Pressable>
                                        </View>

                                        <Text className="mt-3 text-base leading-6 text-text-main-light dark:text-text-main-dark">
                                            {s.text}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <View className="h-10" />
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
