/**
 * History Screen
 * Matches updated history design.
 */

import React from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/navigation';
import { BottomNav } from '@/components/journal';
import { HistorySection } from '@/components/history/HistorySection';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { HistoryItem } from '@/hooks/history/historyUtils';

function getWeekRangeLabel(date: Date): string {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${format(start)} - ${format(end)}`;
}

export default function EntriesScreen() {
    const router = useRouter();
    const { sections } = useHistoryFeed();
    const { drafts } = useJournalEntries();
    const { drafts: checkInDrafts } = useIntentionCheckIns();
    const { goToTab } = useTabNavigation();

    const draftCount = drafts.length + checkInDrafts.length;

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'entries') {
            goToTab(tab);
        }
    };

    const handlePressItem = (item: HistoryItem) => {
        if (item.type === 'journal') {
            router.push({ pathname: '/entry-detail', params: { id: item.sourceId } });
            return;
        }
        if (item.intentionId) {
            router.push({ pathname: '/intentions/detail', params: { id: item.intentionId } });
            return;
        }
        router.push({ pathname: '/checkin-detail', params: { id: item.sourceId } });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <AppHeader
                    variant="history"
                    weekRange={getWeekRangeLabel(new Date())}
                    draftCount={draftCount}
                    onDraftsPress={() => router.push('/drafts')}
                />

                <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 140 }}>
                    {sections.map((section) => (
                        <HistorySection
                            key={section.dateKey}
                            label={section.label}
                            items={section.items}
                            onPressItem={handlePressItem}
                        />
                    ))}
                </ScrollView>

                <BottomNav activeTab="entries" onTabPress={handleTabPress} onFabPress={() => router.push('/chat')} />
            </View>
        </SafeAreaView>
    );
}
