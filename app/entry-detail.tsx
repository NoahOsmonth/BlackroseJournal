import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatMessage } from '@/components/ChatMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { EntryAnalysisPanel } from '@/components/entries/EntryAnalysisPanel';
import { EntryDetailSkeleton } from '@/components/entries/EntryDetailSkeleton';
import { EntryEditModal } from '@/components/entries/EntryEditModal';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useJournalEntryActions } from '@/hooks/journal/useJournalEntryActions';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getLocalDateKey, formatLocalTime } from '@/utils/date';
import { buildEntryText } from '@/utils/entryText';
import { generateEntryAnalysis } from '@/services/ai';
import type { JournalEntry } from '@/services/journal/journalStorage.types';

export default function EntryDetailScreen() {
    const goBack = useNavBack('/(tabs)/entries');
    const params = useLocalSearchParams<{ id?: string }>();
    const entryId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { getById, update } = useJournalEntries();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const {
        isSaving,
        isDeleting,
        error: actionError,
        saveText,
        remove,
    } = useJournalEntryActions();

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
            const entryText = buildEntryText(entry.messages);
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
    /** Clock-doctrine authored label: 'Written YYYY-MM-DD · HH:MM' under the title. */
    const authoredLabel = useMemo(() => {
        if (!entry?.createdAt) return null;
        const authored = new Date(entry.createdAt);
        if (Number.isNaN(authored.getTime())) return null;
        return `Written ${getLocalDateKey(authored)} · ${formatLocalTime(authored)}`;
    }, [entry?.createdAt]);

    const handleSaveText = useCallback(async (text: string) => {
        if (!entryId || !text.trim()) return;
        const updated = await saveText(entryId, text);
        if (updated) {
            setEntry(updated);
            setIsMenuOpen(false);
        }
    }, [entryId, saveText]);

    const handleDeleteEntry = useCallback(async () => {
        if (!entryId) return;
        const deleted = await remove(entryId);
        if (deleted) {
            setIsMenuOpen(false);
            goBack();
        }
    }, [entryId, remove, goBack]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable
                        onPress={goBack}
                        className="p-2 -ml-2"
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                        numberOfLines={1}
                    >
                        {title}
                    </Text>
                    <Pressable
                        onPress={() => setIsMenuOpen(true)}
                        className="p-2 -mr-2"
                        accessibilityRole="button"
                        accessibilityLabel="Entry actions"
                        disabled={!entry}
                    >
                        <MaterialIcons name="more-vert" size={24} color={iconColor} />
                    </Pressable>
                </View>

                {authoredLabel && (
                    <Text className="-mt-2 px-4 pb-1 text-[12px] text-ink-2-light dark:text-ink-2-dark">{authoredLabel}</Text>
                )}

                {isLoading && <EntryDetailSkeleton />}

                {!isLoading && !entry && (
                    <View className="flex-1 px-6 items-center justify-center">
                        <EmptyState
                            icon="search-off"
                            title="Entry not found"
                            message="This entry may have been deleted or is no longer available."
                            actionLabel="Go back"
                            onActionPress={goBack}
                        />
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

            <EntryEditModal
                visible={isMenuOpen}
                entryText={entry ? buildEntryText(entry.messages) : ''}
                entryTitle={entry?.title || 'Entry'}
                isSaving={isSaving}
                isDeleting={isDeleting}
                error={actionError}
                onClose={() => setIsMenuOpen(false)}
                onSave={handleSaveText}
                onDelete={handleDeleteEntry}
            />
        </SafeAreaView>
    );
}
