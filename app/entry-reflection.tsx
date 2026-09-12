/**
 * Entry Reflection Screen
 * Shown immediately after finishing a journal entry.
 *
 * Presentation follows `black-rose-entry-reflection.png`: Close, a serif
 * “Your entry is saved.” hero, a bordered Reflection card carrying the rose
 * mark, the Helpful / Not quite pair, “Tell us more”, and one outline action.
 */

import { EntryReflectionSkeleton } from '@/components/entries/EntryReflectionSkeleton';
import { FinishBackgroundBanner } from '@/components/entries/FinishBackgroundBanner';
import { FeedbackCommentModal } from '@/components/intentions/FeedbackCommentModal';
import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useRefreshOnFinishRun } from '@/hooks/journal/useRefreshOnFinishRun';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEntryReflection } from '@/hooks/useEntryReflection';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';
import { saveAiFeedback } from '@/services/feedback/feedbackStorage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

type EntryReflectionParams = {
    entryId?: string;
};

export default function EntryReflectionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<EntryReflectionParams>();
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const [feedbackValue, setFeedbackValue] = useState<AiFeedbackValue | null>(null);
    const [pendingFeedback, setPendingFeedback] = useState<{
        value: AiFeedbackValue;
        comment: string;
    } | null>(null);

    const entryId = useMemo(() => {
        const raw = params.entryId;
        return Array.isArray(raw) ? raw[0] : raw;
    }, [params.entryId]);

    const { data, isLoading, error, refresh } = useEntryReflection(entryId);

    // When the background analysis lands, refresh the reflection so the
    // entry's analysis-backed content (and any regenerated reflection) shows.
    // One refresh per finished run — never one per render.
    useRefreshOnFinishRun(refresh, entryId);

    const handleBack = () => {
        router.replace('/(tabs)/entries');
    };

    const handleOpenSuggestions = () => {
        router.push({ pathname: '/suggestions', params: { entryId } });
    };

    const handleContinue = () => {
        router.push({ pathname: '/streak-haiku', params: { entryId } });
    };

    const openFeedback = (value: AiFeedbackValue) => {
        setPendingFeedback({ value, comment: '' });
    };

    const handleSaveFeedback = async () => {
        if (!pendingFeedback || !data) return;
        await saveAiFeedback({
            scope: 'journal',
            messageId: `entry-reflection-${entryId ?? 'current'}`,
            conversationId: entryId,
            value: pendingFeedback.value,
            comment: pendingFeedback.comment,
            messageContent: data.reflection,
        });
        setFeedbackValue(pendingFeedback.value);
        setPendingFeedback(null);
    };

    const canContinue = !isLoading && !error && Boolean(data);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="min-h-[56px] flex-row items-center justify-end px-5">
                    <Pressable
                        onPress={handleBack}
                        className="min-h-11 justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Back to entries"
                    >
                        <Text className="text-[17px] text-text-light dark:text-text-dark">Close</Text>
                    </Pressable>
                </View>

                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />

                <FinishBackgroundBanner />

                <ScrollView
                    className="flex-1 px-5"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingTop: 32, paddingBottom: 32 }}
                >
                    <Text
                        className="text-[40px] leading-[48px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Your entry is saved.
                    </Text>
                    <Text className="mt-3 text-[16px] leading-[24px] text-text-secondary-light dark:text-text-secondary-dark">
                        A private reflection is ready.
                    </Text>

                    {isLoading && <EntryReflectionSkeleton />}

                    {!isLoading && error && (
                        <View className="mt-8 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                            <Text className="text-[16px] text-text-light dark:text-text-dark">
                                Couldn’t load reflection
                            </Text>
                            <Text className="mt-1.5 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                {error}
                            </Text>
                        </View>
                    )}

                    {!isLoading && !error && data && (
                        <>
                            <View className="mt-8 rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                                <View className="flex-row items-center gap-3">
                                    <RoseMark size={26} color={accentColor} strokeWidth={1.3} variant="sprig" />
                                    <Text
                                        className="text-[22px] text-text-light dark:text-text-dark"
                                        style={SERIF}
                                    >
                                        Reflection
                                    </Text>
                                </View>

                                <View className="mt-4 h-px bg-hairline-light dark:bg-hairline-dark" />

                                <Text
                                    className="mt-5 text-[20px] leading-[32px] text-text-light dark:text-text-dark"
                                    style={SERIF}
                                >
                                    {data.reflection}
                                </Text>
                            </View>

                            <View className="mt-6 flex-row overflow-hidden rounded-card border border-hairline-light dark:border-hairline-dark">
                                <Pressable
                                    onPress={() => openFeedback('up')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Thumbs up"
                                    accessibilityState={{ selected: feedbackValue === 'up' }}
                                    className="min-h-[64px] flex-1 flex-row items-center justify-center gap-2.5 active:opacity-70"
                                >
                                    <MaterialIcons
                                        name="thumb-up-off-alt"
                                        size={22}
                                        color={feedbackValue === 'up' ? accentColor : mutedColor}
                                    />
                                    <Text className="text-[17px] text-text-light dark:text-text-dark">
                                        Helpful
                                    </Text>
                                </Pressable>

                                <View className="w-px bg-hairline-light dark:bg-hairline-dark" />

                                <Pressable
                                    onPress={() => openFeedback('down')}
                                    accessibilityRole="button"
                                    accessibilityLabel="Thumbs down"
                                    accessibilityState={{ selected: feedbackValue === 'down' }}
                                    className="min-h-[64px] flex-1 flex-row items-center justify-center gap-2.5 active:opacity-70"
                                >
                                    <MaterialIcons
                                        name="thumb-down-off-alt"
                                        size={22}
                                        color={feedbackValue === 'down' ? accentColor : mutedColor}
                                    />
                                    <Text className="text-[17px] text-text-light dark:text-text-dark">
                                        Not quite
                                    </Text>
                                </Pressable>
                            </View>

                            <Pressable
                                onPress={() => openFeedback(feedbackValue ?? 'up')}
                                accessibilityRole="button"
                                accessibilityLabel="Tell us more"
                                className="mt-4 min-h-11 flex-row items-center justify-center gap-2 active:opacity-70"
                            >
                                <MaterialIcons name="chat-bubble-outline" size={20} color={mutedColor} />
                                <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                    Tell us more
                                </Text>
                            </Pressable>

                            {data.keyInsight ? (
                                <View className="mt-8 gap-3">
                                    <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                                        Key insight
                                    </Text>
                                    <View className="rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                                        <Text className="text-[16px] leading-[25px] text-text-light dark:text-text-dark">
                                            {data.keyInsight}
                                        </Text>
                                    </View>
                                </View>
                            ) : null}

                            <Pressable
                                onPress={handleOpenSuggestions}
                                accessibilityRole="button"
                                accessibilityLabel="Open suggestions"
                                className="mt-8 min-h-[64px] flex-row items-center justify-between border-t border-hairline-light px-1 dark:border-hairline-dark"
                            >
                                <View className="min-w-0 flex-1">
                                    <Text className="text-[17px] text-text-light dark:text-text-dark">
                                        Suggestions
                                    </Text>
                                    <Text className="mt-1 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                        Turn today’s reflection into a small habit.
                                    </Text>
                                </View>
                                <View className="flex-row items-center gap-1.5">
                                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {data.suggestions.length}
                                    </Text>
                                    <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
                                </View>
                            </Pressable>
                        </>
                    )}
                </ScrollView>

                <View className="border-t border-hairline-light px-5 pb-6 pt-5 dark:border-hairline-dark">
                    <Pressable
                        onPress={handleContinue}
                        disabled={!canContinue}
                        accessibilityRole="button"
                        accessibilityLabel="Continue"
                        accessibilityState={{ disabled: !canContinue }}
                        className={`min-h-[56px] flex-row items-center justify-center gap-3 rounded-control border ${
                            canContinue
                                ? 'border-bone-light dark:border-bone-dark'
                                : 'border-hairline-light dark:border-hairline-dark'
                        }`}
                    >
                        <MaterialIcons name="menu-book" size={22} color={canContinue ? inkColor : mutedColor} />
                        <Text
                            className={`text-[19px] ${
                                canContinue
                                    ? 'text-text-light dark:text-text-dark'
                                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                            }`}
                            style={SERIF}
                        >
                            Continue
                        </Text>
                    </Pressable>
                </View>

                <FeedbackCommentModal
                    visible={pendingFeedback !== null}
                    value={pendingFeedback?.value ?? 'up'}
                    comment={pendingFeedback?.comment ?? ''}
                    onCommentChange={(comment) => setPendingFeedback((current) => (
                        current ? { ...current, comment } : current
                    ))}
                    onClose={() => setPendingFeedback(null)}
                    onSubmit={handleSaveFeedback}
                />
            </View>
        </SafeAreaView>
    );
}
