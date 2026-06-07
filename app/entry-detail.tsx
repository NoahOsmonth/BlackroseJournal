import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatMessage } from '@/components/ChatMessage';
import { EntryAnalysisPanel } from '@/components/entries/EntryAnalysisPanel';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { generateEntryAnalysis } from '@/services/ai';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

function buildEntryText(entry: JournalEntry): string {
    return entry.messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join('\n\n');
}

export default function EntryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const entryId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { getById, update } = useJournalEntries();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [entry, setEntry] = useState<JournalEntry | null>(null);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!entryId) {
                setIsLoading(false);
                return;
            }
            const loaded = await getById(entryId);
            if (!isActive) return;
            setEntry(loaded);
            setIsLoading(false);
        };
        load();
        return () => {
            isActive = false;
        };
    }, [entryId, getById]);

    useEffect(() => {
        let isActive = true;
        const backfillAnalysis = async () => {
            if (!entry || entry.analysis || entry.status !== 'completed') return;
            const entryText = buildEntryText(entry);
            if (!entryText) return;

            setIsAnalyzing(true);
            try {
                const generated = await generateEntryAnalysis({ entryText });
                const analysis = { ...generated, generatedAt: Date.now() };
                await update(entry.id, { analysis });
                if (isActive) {
                    setEntry((current) => current ? { ...current, analysis } : current);
                }
            } finally {
                if (isActive) {
                    setIsAnalyzing(false);
                }
            }
        };
        backfillAnalysis();
        return () => {
            isActive = false;
        };
    }, [entry, update]);

    const title = useMemo(() => entry?.title ?? 'Entry', [entry]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text className="text-lg font-semibold text-text-light dark:text-white" numberOfLines={1}>
                        {title}
                    </Text>
                    <View className="w-10" />
                </View>

                {isLoading && (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="small" color="#E91E63" />
                        <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            Loading entry...
                        </Text>
                    </View>
                )}

                {!isLoading && entry && (
                    <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                        <View className="gap-y-5">
                            <EntryAnalysisPanel
                                analysis={entry.analysis}
                                isLoading={isAnalyzing}
                            />
                            {entry.messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    text={message.content}
                                    isAi={message.role === 'assistant'}
                                    reasoning={message.reasoning}
                                    isReadOnly
                                />
                            ))}
                        </View>
                        <View className="h-12" />
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
