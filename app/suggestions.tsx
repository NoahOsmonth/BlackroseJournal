/**
 * Suggestions — the reflection's habit ideas as hairline rows. Each row is one
 * idea with an outlined verb on the right; no type chip, no brand fill.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SuggestionsSkeleton } from '@/components/entries/SuggestionsSkeleton';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEntryReflection } from '@/hooks/useEntryReflection';
import { useHappinessRecipe } from '@/hooks/useHappinessRecipe';

type SuggestionsParams = {
    entryId?: string;
};

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

function normalize(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function SuggestionsScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
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

    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

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
            <View className="mx-auto w-full max-w-md flex-1">
                <View className="flex-row items-center justify-between px-5 py-4">
                    <Pressable
                        onPress={() => router.back()}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Suggestions
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                    {isLoading && <SuggestionsSkeleton />}

                    {!isLoading && error && (
                        <View className={`rounded-card border ${HAIRLINE} bg-surface-light p-5 dark:bg-surface-dark`}>
                            <Text
                                className="text-[21px] leading-[29px] text-text-light dark:text-text-dark"
                                style={SERIF}
                            >
                                Couldn’t load suggestions
                            </Text>
                            <Text className="mt-2 text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                                {error}
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && suggestions.length === 0 && (
                        <View className={`rounded-card border ${HAIRLINE} bg-surface-light p-5 dark:bg-surface-dark`}>
                            <Text className="text-[15px] leading-[23px] text-text-secondary-light dark:text-text-secondary-dark">
                                No suggestions yet.
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && suggestions.length > 0 && (
                        <View className="gap-3">
                            {suggestions.map((s, idx) => {
                                const alreadyAdded = existingHabits.has(normalize(s.text));
                                const isAdding = addingText === s.text;
                                const disabled = alreadyAdded || isAdding;

                                return (
                                    <View
                                        key={`${idx}-${s.text}`}
                                        className={`rounded-card border ${HAIRLINE} bg-surface-light p-5 dark:bg-surface-dark`}
                                    >
                                        <Text
                                            className="text-[19px] leading-[28px] text-text-light dark:text-text-dark"
                                            style={SERIF}
                                        >
                                            {s.text}
                                        </Text>

                                        <Pressable
                                            onPress={() => handleAdd(s.text)}
                                            disabled={disabled}
                                            accessibilityLabel={`Add habit: ${s.text}`}
                                            className={`mt-4 min-h-12 self-start items-center justify-center rounded-control border px-5 ${
                                                disabled
                                                    ? HAIRLINE
                                                    : 'border-bone-light dark:border-bone-dark'
                                            }`}
                                        >
                                            <Text
                                                className={
                                                    disabled
                                                        ? 'text-[15px] text-text-secondary-light dark:text-text-secondary-dark'
                                                        : 'text-[16px] text-text-light dark:text-text-dark'
                                                }
                                            >
                                                {alreadyAdded ? 'Added' : isAdding ? 'Adding…' : 'Add to list'}
                                            </Text>
                                        </Pressable>
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
