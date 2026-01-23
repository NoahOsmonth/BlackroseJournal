/**
 * Entry Reflection Screen
 * Shown immediately after finishing a journal entry.
 */

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEntryReflection } from '@/hooks/useEntryReflection';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type EntryReflectionParams = {
    entryId?: string;
};

export default function EntryReflectionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<EntryReflectionParams>();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const entryId = useMemo(() => {
        const raw = params.entryId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.entryId]);

    const { data, isLoading, error } = useEntryReflection(entryId);

    const handleBack = () => {
        router.replace('/(tabs)/entries');
    };

    const handleOpenSuggestions = () => {
        router.push({ pathname: '/suggestions', params: { entryId } });
    };

    const handleContinue = () => {
        router.push({ pathname: '/streak-haiku', params: { entryId } });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable
                        onPress={handleBack}
                        className="p-2 -ml-2"
                        accessibilityLabel="Back to entries"
                    >
                        <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                        />
                    </Pressable>

                    <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        Entry Reflection
                    </Text>

                    <View className="flex-row items-center">
                        <Pressable
                            onPress={() => { }}
                            className="p-2"
                            accessibilityLabel="Share reflection"
                        >
                            <MaterialIcons
                                name="share"
                                size={22}
                                color={isDark ? '#E5E5E7' : '#1C1C1E'}
                            />
                        </Pressable>
                    </View>
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    {isLoading && (
                        <View className="items-center py-10">
                            <ActivityIndicator size="small" color="#E91E63" />
                            <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                Generating your reflection…
                            </Text>
                        </View>
                    )}

                    {!isLoading && error && (
                        <View className="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
                            <Text className="text-text-main-light dark:text-text-main-dark font-semibold">
                                Couldn’t load reflection
                            </Text>
                            <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                {error}
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && data && (
                        <>
                            {/* Reflection card */}
                            <View className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark shadow-card">
                                <Text className="text-base leading-6 text-text-main-light dark:text-text-main-dark">
                                    {data.reflection}
                                </Text>

                                {/* Feedback */}
                                <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-divider-light dark:border-divider-dark">
                                    <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                                        Feedback
                                    </Text>
                                    <View className="flex-row items-center">
                                        <Pressable
                                            onPress={() => { }}
                                            className="p-2"
                                            accessibilityLabel="Thumbs up"
                                        >
                                            <MaterialIcons
                                                name="thumb-up-off-alt"
                                                size={20}
                                                color={isDark ? '#A1A1AA' : '#71717A'}
                                            />
                                        </Pressable>
                                        <Pressable
                                            onPress={() => { }}
                                            className="p-2"
                                            accessibilityLabel="Thumbs down"
                                        >
                                            <MaterialIcons
                                                name="thumb-down-off-alt"
                                                size={20}
                                                color={isDark ? '#A1A1AA' : '#71717A'}
                                            />
                                        </Pressable>
                                    </View>
                                </View>
                            </View>

                            {/* Key insight */}
                            <View className="mt-4">
                                <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3 ml-1">
                                    Key Insight
                                </Text>
                                <View className="p-5 rounded-2xl bg-surface-light dark:bg-surface-dark">
                                    <Text className="text-base leading-6 text-text-main-light dark:text-text-main-dark">
                                        {data.keyInsight}
                                    </Text>
                                </View>
                            </View>

                            {/* Suggestions CTA */}
                            <View className="mt-4">
                                <Pressable
                                    onPress={handleOpenSuggestions}
                                    className="flex-row items-center justify-between p-5 rounded-2xl bg-surface-light dark:bg-surface-dark"
                                    accessibilityLabel="Open suggestions"
                                >
                                    <View>
                                        <Text className="text-base font-bold text-text-main-light dark:text-text-main-dark">
                                            Suggestions
                                        </Text>
                                        <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                                            Turn today’s reflection into a small habit.
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Text className="text-sm font-bold text-primary mr-2">
                                            {data.suggestions.length}
                                        </Text>
                                        <MaterialIcons
                                            name="chevron-right"
                                            size={24}
                                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                                        />
                                    </View>
                                </Pressable>
                            </View>
                        </>
                    )}

                    <View className="h-28" />
                </ScrollView>

                {/* Sticky continue */}
                <View className="px-4 pb-6 pt-3 border-t border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark">
                    <Pressable
                        onPress={handleContinue}
                        disabled={isLoading || !!error || !data}
                        accessibilityLabel="Continue"
                        className={`py-4 rounded-2xl items-center justify-center ${isLoading || !!error || !data ? 'bg-slate-200 dark:bg-slate-800' : 'bg-primary'
                            }`}
                    >
                        <Text className={`text-[15px] font-bold ${isLoading || !!error || !data ? 'text-slate-500 dark:text-slate-400' : 'text-white'
                            }`}>
                            Continue
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
