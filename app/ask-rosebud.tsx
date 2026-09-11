/**
 * Ask — questions across the journal, answered from local entries.
 *
 * Presentation follows `black-rose-ask.png`: centered serif title, a single
 * outline range pill, the rose mark over a serif invitation, outline suggestion
 * rows, companion replies beside a diamond rail, and one composer bar.
 *
 * The answering path is unchanged: `useAskRosebud` → `services/ask-rosebud`.
 */

import { AskMessageRow, AskTypingRow } from '@/components/ask/AskMessageRow';
import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAskRosebud } from '@/hooks/useAskRosebud';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { TimeRange, TIME_RANGE_LABELS } from '@/services/ask-rosebud/askRosebud';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

const SUGGESTIONS: readonly { readonly icon: string; readonly text: string }[] = [
    { icon: 'waves', text: 'What patterns do you see in my mood?' },
    { icon: 'wb-sunny', text: 'What makes me happiest?' },
    { icon: 'thunderstorm', text: 'What are my main stressors?' },
    { icon: 'trending-up', text: 'How has my mindset changed over time?' },
];

const RANGE_ORDER: readonly TimeRange[] = [
    'all-entries',
    'all-time',
    'this-year',
    'this-month',
    'this-week',
];

export default function AskRosebudScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const iconColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const { completed } = useJournalEntries();
    const { messages, isLoading, errorMessage, sendQuestion } = useAskRosebud();

    const [timeRange, setTimeRange] = useState<TimeRange>('all-entries');
    const [inputText, setInputText] = useState('');

    const filteredEntries = useMemo(() => {
        const now = new Date();
        return completed.filter((entry) => {
            const entryDate = new Date(entry.createdAt);
            switch (timeRange) {
                case 'this-week': {
                    const weekAgo = new Date(now);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return entryDate >= weekAgo;
                }
                case 'this-month': {
                    return entryDate.getMonth() === now.getMonth() &&
                        entryDate.getFullYear() === now.getFullYear();
                }
                case 'this-year': {
                    return entryDate.getFullYear() === now.getFullYear();
                }
                case 'all-entries':
                default:
                    return true;
            }
        });
    }, [completed, timeRange]);

    const handleSendMessage = useCallback(async (question: string) => {
        if (!question.trim() || isLoading) return;

        setInputText('');
        await sendQuestion(question, timeRange, filteredEntries);
    }, [filteredEntries, isLoading, sendQuestion, timeRange]);

    const cycleTimeRange = () => {
        const currentIndex = RANGE_ORDER.indexOf(timeRange);
        setTimeRange(RANGE_ORDER[(currentIndex + 1) % RANGE_ORDER.length]);
    };

    const canSend = Boolean(inputText.trim()) && !isLoading;

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md mx-auto flex-1">
                <View className="min-h-[56px] flex-row items-center justify-between px-4 py-2">
                    <Pressable
                        onPress={() => router.back()}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                        className="h-11 w-11 items-center justify-center"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={iconColor} />
                    </Pressable>
                    <Text
                        className="flex-1 text-center text-[28px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Ask
                    </Text>
                    <Pressable
                        onPress={() => router.push('/saved-insights')}
                        accessibilityRole="button"
                        accessibilityLabel="Open saved insights"
                        className="h-11 w-11 items-center justify-center"
                    >
                        <MaterialIcons name="bookmark-border" size={24} color={iconColor} />
                    </Pressable>
                </View>

                <View className="items-center pb-3 pt-2">
                    <Pressable
                        onPress={cycleTimeRange}
                        accessibilityRole="button"
                        accessibilityLabel={`Time range: ${TIME_RANGE_LABELS[timeRange]}`}
                        className="min-h-11 flex-row items-center gap-2 rounded-full border border-hairline-light px-5 py-2.5 dark:border-hairline-dark"
                    >
                        <Text className="text-[15px] text-text-light dark:text-text-dark">
                            {TIME_RANGE_LABELS[timeRange]}
                        </Text>
                        <MaterialIcons name="expand-more" size={18} color={mutedColor} />
                    </Pressable>
                </View>

                <View className="h-px bg-hairline-light dark:bg-hairline-dark" />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1"
                >
                    <ScrollView
                        className="flex-1 px-6"
                        contentContainerStyle={{ paddingTop: 28, paddingBottom: 32 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {messages.length === 0 && (
                            <View className="items-center">
                                <RoseMark size={56} color={iconColor} strokeWidth={1.1} variant="sprig" />
                                <Text
                                    className="mt-4 text-center text-[30px] leading-[38px] text-text-light dark:text-text-dark"
                                    style={SERIF}
                                >
                                    Ask anything across your entries.
                                </Text>

                                <View className="mt-7 w-full gap-3">
                                    {SUGGESTIONS.map((suggestion) => (
                                        <Pressable
                                            key={suggestion.text}
                                            onPress={() => void handleSendMessage(suggestion.text)}
                                            disabled={isLoading}
                                            accessibilityRole="button"
                                            accessibilityLabel={suggestion.text}
                                            className={`min-h-[64px] flex-row items-center gap-3.5 rounded-card border border-hairline-light px-5 py-3.5 dark:border-hairline-dark ${
                                                isLoading ? 'opacity-50' : 'active:opacity-70'
                                            }`}
                                        >
                                            <MaterialIcons
                                                name={suggestion.icon as never}
                                                size={22}
                                                color={iconColor}
                                            />
                                            <Text className="flex-1 text-[16px] leading-[23px] text-text-light dark:text-text-dark">
                                                {suggestion.text}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        )}

                        {errorMessage && (
                            <View className="mb-5 rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark">
                                <Text className="text-[14px] text-text-light dark:text-text-dark">
                                    {errorMessage}
                                </Text>
                            </View>
                        )}

                        <View className="gap-5">
                            {messages.map((message) => (
                                <AskMessageRow key={message.id} message={message} />
                            ))}
                            {isLoading && <AskTypingRow />}
                        </View>
                    </ScrollView>

                    <View className="border-t border-hairline-light px-6 pb-4 pt-4 dark:border-hairline-dark">
                        <View className="flex-row items-center gap-3">
                            <TextInput
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Ask a question..."
                                placeholderTextColor={mutedColor}
                                accessibilityLabel="Ask a question"
                                className="min-h-12 flex-1 rounded-control border border-hairline-light bg-surface-light px-4 text-[15px] text-text-light dark:border-hairline-dark dark:bg-surface-dark dark:text-text-dark"
                                onSubmitEditing={() => void handleSendMessage(inputText)}
                                editable={!isLoading}
                                returnKeyType="send"
                            />
                            <Pressable
                                onPress={() => void handleSendMessage(inputText)}
                                disabled={!canSend}
                                accessibilityRole="button"
                                accessibilityLabel="Send question"
                                accessibilityState={{ disabled: !canSend }}
                                className={`h-12 w-12 items-center justify-center rounded-full border ${
                                    canSend
                                        ? 'border-bone-light dark:border-bone-dark'
                                        : 'border-hairline-light dark:border-hairline-dark'
                                }`}
                            >
                                <MaterialIcons
                                    name="send"
                                    size={20}
                                    color={canSend ? iconColor : mutedColor}
                                />
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </SafeAreaView>
    );
}
