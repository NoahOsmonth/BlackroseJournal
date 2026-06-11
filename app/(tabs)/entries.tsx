import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/navigation';
import { BottomNav, ResumeSessionBanner } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { navAwareBottomPadding, TIMELINE_INDENT } from '@/constants/spacing';
import { HistorySection } from '@/components/history/HistorySection';
import { HistoryWeekSummary } from '@/components/history/HistoryWeekSummary';
import { useHistoryFeed } from '@/hooks/history/useHistoryFeed';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { HistoryItem } from '@/hooks/history/historyUtils';
import { StaggerEntrance } from '@/components/ui/StaggerEntrance';
import {
    getMostRecentActiveSession,
    type ChatSession,
} from '@/services/ai/sessionStorage';

function getWeekRangeLabel(date: Date): string {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${format(start)} - ${format(end)}`;
}

function sessionTitle(session: ChatSession): string {
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser ?? session.messages[session.messages.length - 1])?.content.trim() ?? '';
    if (!text) return 'Tap to continue';
    return text.length > 80 ? `${text.slice(0, 80).trim()}...` : text;
}

function isIntentionSession(session: ChatSession): boolean {
    return session.mode === 'morning'
        || session.mode === 'evening'
        || session.mode === 'intention';
}

export default function EntriesScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { sections, weeklySummary } = useHistoryFeed();
    const { drafts } = useJournalEntries();
    const { drafts: checkInDrafts } = useIntentionCheckIns();
    const { goToTab } = useTabNavigation();

    const draftCount = drafts.length + checkInDrafts.length;

    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [dismissedId, setDismissedId] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            getMostRecentActiveSession().then((session) => {
                if (isActive) setActiveSession(session);
            });
            return () => {
                isActive = false;
            };
        }, [])
    );

    const showBanner = activeSession !== null
        && activeSession.conversationId !== dismissedId;

    const handleResumeSession = () => {
        if (!activeSession) return;
        if (isIntentionSession(activeSession)) {
            router.push({
                pathname: '/intentions/chat',
                params: { resume: activeSession.conversationId, ...activeSession.routeParams },
            });
            return;
        }
        router.push({ pathname: '/chat', params: { resume: activeSession.conversationId } });
    };

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
        <ScreenContainer edges="top">
                <AppHeader
                    variant="history"
                    weekRange={getWeekRangeLabel(new Date())}
                    draftCount={draftCount}
                    onDraftsPress={() => router.push('/drafts')}
                />

                <ScrollView
                    className="flex-1"
                    style={{ paddingHorizontal: TIMELINE_INDENT }}
                    contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                >
                    {showBanner && activeSession && (
                        <View className="mt-2">
                            <ResumeSessionBanner
                                title={sessionTitle(activeSession)}
                                onResume={handleResumeSession}
                                onDismiss={() => setDismissedId(activeSession.conversationId)}
                            />
                        </View>
                    )}

                    <HistoryWeekSummary summary={weeklySummary} />

                    <View className="relative mt-4">
                        {/* Continuous timeline spine line */}
                        <View
                            className="absolute top-[14px] bottom-0 w-[1.5px] bg-divider-light dark:bg-divider-dark z-0"
                            style={{ left: TIMELINE_INDENT }}
                        />

                        <StaggerEntrance staggerType="linear" baseDelayMs={60} delayFactorMs={40}>
                            {sections.map((section) => (
                                <HistorySection
                                    key={section.dateKey}
                                    label={section.label}
                                    items={section.items}
                                    onPressItem={handlePressItem}
                                />
                            ))}
                        </StaggerEntrance>
                    </View>
                </ScrollView>

                <BottomNav activeTab="entries" onTabPress={handleTabPress} onFabPress={() => router.push('/chat')} />
        </ScreenContainer>
    );
}
