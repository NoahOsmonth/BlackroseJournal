/**
 * Entries Screen (Journal History)
 * Main history screen showing past journal entries grouped by week
 * Matches journal-history.html design exactly
 */

import { EntryActionModal } from '@/components/entries';
import {
    BottomNav,
    DraftCard,
    WeekSection,
} from '@/components/journal';
import { AppHeader } from '@/components/navigation';
import { groupEntriesByWeek } from '@/hooks/journal/useEntryGroups';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useHeaderActions } from '@/hooks/navigation/useHeaderActions';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { JournalEntry } from '@/services/journal/journalStorage.types';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EntriesScreen() {
    const router = useRouter();
    const { completed, drafts, isLoading } = useJournalEntries();
    const { openRewards, openSettings } = useHeaderActions();
    const { goToTab } = useTabNavigation();

    const weekGroups = useMemo(() => groupEntriesByWeek(completed), [completed]);

    // Modal state
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleEntryPress = (entry: JournalEntry) => {
        setSelectedEntry(entry);
        setModalVisible(true);
    };

    const handleContinueEntry = () => {
        if (selectedEntry) {
            router.push({
                pathname: '/chat',
                params: { entryId: selectedEntry.id, mode: 'continue' },
            });
        }
        setModalVisible(false);
    };

    const handleCreateNewEntry = () => {
        router.push('/chat');
        setModalVisible(false);
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'entries') {
            goToTab(tab);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <AppHeader
                    title="Journal"
                    variant="journal"
                    onLeftPress={openRewards}
                    onRightPress={openSettings}
                />

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

                <BottomNav
                    activeTab="entries"
                    onTabPress={handleTabPress}
                    onFabPress={handleNewEntry}
                />

                {/* Entry Action Modal */}
                <EntryActionModal
                    visible={modalVisible}
                    onClose={() => setModalVisible(false)}
                    onContinue={handleContinueEntry}
                    onNewEntry={handleCreateNewEntry}
                    entryTitle={selectedEntry?.title}
                />
            </View>
        </SafeAreaView>
    );
}
