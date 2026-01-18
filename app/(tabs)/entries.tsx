/**
 * Entries Screen (Journal History)
 * Main history screen showing past journal entries grouped by week
 * Matches journal-history.html design exactly
 */

import {
    BottomNav,
    DraftCard,
    FAB,
    JournalHeader,
    WeekSection,
} from '@/components/journal';
import { groupEntriesByWeek } from '@/hooks/useEntryGroups';
import { useJournalEntries } from '@/hooks/useJournalEntries';
import { JournalEntry } from '@/services/journalStorage.types';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EntriesScreen() {
    const router = useRouter();
    const { completed, drafts, isLoading } = useJournalEntries();

    const weekGroups = useMemo(() => groupEntriesByWeek(completed), [completed]);

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleEntryPress = (entry: JournalEntry) => {
        // Navigate to chat with entry ID for viewing/resuming
        router.push({ pathname: '/chat', params: { entryId: entry.id } });
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings') => {
        if (tab !== 'entries') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <JournalHeader />

                <ScrollView
                    className="flex-1 px-4 pt-4"
                    contentContainerStyle={{ paddingBottom: 140 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Drafts at top */}
                    {drafts.map((draft) => (
                        <DraftCard
                            key={draft.id}
                            entry={draft}
                            onPress={() => handleEntryPress(draft)}
                        />
                    ))}

                    {/* Completed entries grouped by week */}
                    {weekGroups.map((group) => (
                        <WeekSection
                            key={group.startDate.getTime()}
                            dateRange={group.dateRange}
                            entries={group.entries}
                            onEntryPress={handleEntryPress}
                        />
                    ))}

                    {/* Empty state */}
                    {!isLoading && completed.length === 0 && drafts.length === 0 && (
                        <View className="items-center justify-center py-20">
                            <Text className="text-lg text-subtext-light dark:text-subtext-dark mb-2">
                                No journal entries yet
                            </Text>
                            <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                                Tap the edit button to start writing
                            </Text>
                        </View>
                    )}
                </ScrollView>

                <FAB onPress={handleNewEntry} />
                <BottomNav activeTab="entries" onTabPress={handleTabPress} />
            </View>
        </SafeAreaView>
    );
}
