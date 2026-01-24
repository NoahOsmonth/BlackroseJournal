/**
 * Ask Rosebud Screen
 * AI-powered insights from journal entries with time range selection
 */

import { TypingIndicator } from '@/components/ui/TypingIndicator';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAskRosebud } from '@/hooks/useAskRosebud';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { useThemeColor } from '@/hooks/use-theme-color';
import { TimeRange } from '@/services/ask-rosebud/askRosebud';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
    'all-time': 'All-time',
    'this-year': 'This year',
    'this-month': 'This month',
    'this-week': 'This week',
};

const SUGGESTED_QUESTIONS = [
    'What patterns do you see in my mood?',
    'What makes me happiest?',
    'What are my main stressors?',
    'How has my mindset changed over time?',
];

export default function AskRosebudScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const primaryColor = useThemeColor({}, 'primary');
    const mutedColor = useThemeColor({}, 'icon');
    const { completed } = useJournalEntries();
    const { messages, isLoading, errorMessage, sendQuestion } = useAskRosebud();

    const [timeRange, setTimeRange] = useState<TimeRange>('all-time');
    const [inputText, setInputText] = useState('');

    // Filter entries by time range
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
                default:
                    return true;
            }
        });
    }, [completed, timeRange]);

    const handleSendMessage = useCallback(async (question: string) => {
        if (!question.trim() || isLoading) return;

        setInputText('');
        await sendQuestion(question, timeRange);
    }, [isLoading, sendQuestion, timeRange]);

    const cycleTimeRange = () => {
        const ranges: TimeRange[] = ['all-time', 'this-year', 'this-month', 'this-week'];
        const currentIndex = ranges.indexOf(timeRange);
        setTimeRange(ranges[(currentIndex + 1) % ranges.length]);
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                {/* Header */}
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                        <MaterialIcons
                            name="arrow-back"
                            size={24}
                            color={isDark ? '#E5E5E7' : '#1C1C1E'}
                        />
                    </Pressable>
                    <Text className="text-xl font-bold text-text-main-light dark:text-text-main-dark">
                        Ask Rosebud
                    </Text>
                    <Pressable onPress={cycleTimeRange} className="p-2 -mr-2">
                        <Text className="text-sm font-bold text-primary">
                            {TIME_RANGE_LABELS[timeRange]}
                        </Text>
                    </Pressable>
                </View>

                {/* Entry count indicator */}
                <View className="px-4 mb-4">
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
                        Analyzing {filteredEntries.length} entries
                    </Text>
                </View>

                <ScrollView
                    className="flex-1 px-4"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Suggested questions (show when no messages) */}
                    {messages.length === 0 && (
                        <View className="mb-6">
                            <Text className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-3">
                                Suggested Questions
                            </Text>
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <Pressable
                                    key={i}
                                    onPress={() => handleSendMessage(q)}
                                    disabled={isLoading}
                                    className={`p-4 mb-2 rounded-xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'
                                        } ${isLoading ? 'opacity-50' : ''}`}
                                >
                                    <Text className="text-text-main-light dark:text-text-main-dark">
                                        {q}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {errorMessage && (
                        <View className="mb-4 rounded-xl border border-divider-light dark:border-divider-dark bg-yellow-300/20 dark:bg-yellow-300/10 p-3">
                            <Text className="text-sm text-text-main-light dark:text-text-main-dark">
                                {errorMessage}
                            </Text>
                        </View>
                    )}

                    {/* Messages */}
                    {messages.map((msg) => (
                        <View
                            key={msg.id}
                            className={`mb-4 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                        >
                            <View
                                className={`max-w-[85%] p-4 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-primary'
                                    : isDark ? 'bg-surface-dark' : 'bg-surface-light'
                                    }`}
                            >
                                <Text
                                    className={
                                        msg.role === 'user'
                                            ? 'text-white'
                                            : 'text-text-main-light dark:text-text-main-dark'
                                    }
                                >
                                    {msg.content}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                        <View className="items-start mb-4">
                            <View className={`p-4 rounded-2xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                                <TypingIndicator colorClassName="text-primary" />
                            </View>
                        </View>
                    )}

                    <View className="h-20" />
                </ScrollView>

                {/* Input */}
                <View className={`px-4 py-3 border-t ${isDark ? 'border-border-dark' : 'border-border-light'}`}>
                    <View className={`flex-row items-center p-3 rounded-2xl ${isDark ? 'bg-surface-dark' : 'bg-surface-light'}`}>
                        <TextInput
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Ask about your journal..."
                            placeholderTextColor={isDark ? '#666' : '#999'}
                            className={`flex-1 text-base ${isDark ? 'text-white' : 'text-black'}`}
                            onSubmitEditing={() => handleSendMessage(inputText)}
                            editable={!isLoading}
                        />
                        <Pressable
                            onPress={() => handleSendMessage(inputText)}
                            disabled={!inputText.trim() || isLoading}
                            className="p-2"
                        >
                            <MaterialIcons
                                name="send"
                                size={24}
                                color={inputText.trim() && !isLoading ? primaryColor : mutedColor}
                            />
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
