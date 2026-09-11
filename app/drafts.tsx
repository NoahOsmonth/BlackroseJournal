import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { DraftCard } from '@/components/drafts/DraftCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { Skeleton } from '@/components/ui/Skeleton';
import {
    loadSessions,
    removeSession,
    type ChatSession,
} from '@/services/ai/sessionStorage';

interface DraftItem {
    id: string;
    title: string;
    label: string;
    updatedAt: number;
    source: 'journal' | 'checkin';
}

/** "Today, 5:17 pm" — the concept's relative stamp, never a raw date. */
function formatDraftTime(timestamp: number, now = new Date()): string {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        .toLowerCase();
    const startOfDay = (value: Date) => new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
    ).getTime();
    const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

    if (dayDelta === 0) return `Today, ${time}`;
    if (dayDelta === 1) return `Yesterday, ${time}`;
    const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${day}, ${time}`;
}

function sessionTitle(session: ChatSession): string {
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    const text = (lastUser ?? session.messages[session.messages.length - 1])?.content.trim() ?? '';
    if (!text) return 'Untitled session';
    return text.length > 80 ? `${text.slice(0, 80).trim()}...` : text;
}

function isIntentionSession(session: ChatSession): boolean {
    return session.mode === 'morning'
        || session.mode === 'evening'
        || session.mode === 'intention';
}

export default function DraftsScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const { drafts, isLoading: entriesLoading, remove } = useJournalEntries();
    const { drafts: checkInDrafts, isLoading: checkInsLoading, remove: removeCheckIn } = useIntentionCheckIns();
    const [sortMode, setSortMode] = useState<'recent' | 'title'>('recent');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [sessionsLoaded, setSessionsLoaded] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [removedCount, setRemovedCount] = useState<Record<string, boolean>>({});

    const refreshSessions = useCallback(() => {
        let isActive = true;
        setSessionsLoaded(false);
        loadSessions().then((loaded) => {
            if (!isActive) return;
            const active = loaded
                .filter((session) => session.messages.length > 0)
                .sort((a, b) => b.updatedAt - a.updatedAt);
            setSessions(active);
            setSessionsLoaded(true);
        });
        return () => {
            isActive = false;
        };
    }, []);

    useFocusEffect(refreshSessions);

    const items = useMemo<DraftItem[]>(() => {
        const journalItems = drafts.map((entry) => ({
            id: entry.id,
            title: entry.title,
            label: 'Journal',
            updatedAt: entry.updatedAt,
            source: 'journal' as const,
        }));

        const checkInItems = checkInDrafts.map((checkIn) => ({
            id: checkIn.id,
            title: checkIn.summary,
            label: 'Intention check-in',
            updatedAt: checkIn.updatedAt,
            source: 'checkin' as const,
        }));

        const combined = [...journalItems, ...checkInItems];
        if (sortMode === 'title') {
            return combined.sort((a, b) => a.title.localeCompare(b.title));
        }
        return combined.sort((a, b) => b.updatedAt - a.updatedAt);
    }, [checkInDrafts, drafts, sortMode]);

    const handleRestore = (item: DraftItem) => {
        if (item.source === 'journal') {
            router.push({ pathname: '/chat', params: { entryId: item.id, mode: 'continue' } });
            return;
        }
        router.push({ pathname: '/intentions/chat', params: { draftId: item.id } });
    };

    const handleRemoveItem = useCallback((id: string) => {
        setRemovingId(id);
    }, []);

    const handleExited = useCallback((id: string, actualRemove: () => void) => {
        setRemovedCount((prev) => ({ ...prev, [id]: true }));
        setRemovingId(null);
        actualRemove();
    }, []);

    const handleDeleteSession = useCallback((session: ChatSession) => {
        handleExited(session.conversationId, () => {
            removeSession(session.conversationId);
            setSessions((prev) => prev.filter((s) => s.conversationId !== session.conversationId));
        });
    }, [handleExited]);

    const handleResumeSession = (session: ChatSession) => {
        if (isIntentionSession(session)) {
            router.push({
                pathname: '/intentions/chat',
                params: { resume: session.conversationId, ...session.routeParams },
            });
            return;
        }
        router.push({ pathname: '/chat', params: { resume: session.conversationId } });
    };

    const isLoading = entriesLoading || checkInsLoading || !sessionsLoaded;
    const activeSessions = sessions.filter((session) => !removedCount[session.conversationId]);
    const visibleItems = items.filter((item) => !removedCount[item.id]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md flex-1 self-center">
                <View className="flex-row items-center justify-between px-6 py-4">
                    <Pressable
                        onPress={() => router.back()}
                        className="h-10 w-10 items-center justify-center"
                        accessibilityLabel="Back"
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <MaterialIcons name="chevron-left" size={26} color={ink} />
                    </Pressable>
                    <Text
                        className="text-[22px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Drafts
                    </Text>
                    <Pressable
                        onPress={() => setSortMode((prev) => (prev === 'recent' ? 'title' : 'recent'))}
                        className="h-10 min-w-10 items-center justify-center"
                        accessibilityLabel="Sort drafts"
                        accessibilityRole="button"
                        hitSlop={8}
                    >
                        <Text className="text-[15px] text-text-light underline dark:text-text-dark">
                            {sortMode === 'recent' ? 'Recent' : 'Title'}
                        </Text>
                    </Pressable>
                </View>

                <View className="h-px w-full bg-hairline-light dark:bg-hairline-dark" />

                {isLoading ? (
                    <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
                        <LoadingStatus
                            label="Loading drafts"
                            detail="Gathering your works in progress."
                            compact
                        />
                        <View className="mt-6 gap-4">
                            {[1, 2, 3].map((index) => (
                                <View
                                    key={index}
                                    className="gap-3 rounded-card border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark"
                                >
                                    <Skeleton className="h-3 w-20" accessibilityLabel={`Loading draft label ${index}`} />
                                    <Skeleton className="h-5 w-5/6" accessibilityLabel={`Loading draft title ${index}`} />
                                    <Skeleton className="h-3 w-32" accessibilityLabel={`Loading draft time ${index}`} />
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                ) : activeSessions.length === 0 && visibleItems.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <EmptyState
                            icon="edit-note"
                            title="No drafts yet"
                            message="Drafts live here as placeholders for conversations you haven't finished yet."
                        />
                    </View>
                ) : (
                    <ScrollView className="flex-1 px-6 pt-6 pb-8" showsVerticalScrollIndicator={false}>
                        <View className="gap-4">
                            {activeSessions.map((session) => (
                                <DraftCard
                                    key={session.conversationId}
                                    label="Autosaved"
                                    title={sessionTitle(session)}
                                    timeLabel={formatDraftTime(session.updatedAt)}
                                    removing={removingId === session.conversationId}
                                    onPress={() => handleResumeSession(session)}
                                    onDelete={() => handleRemoveItem(session.conversationId)}
                                    onExited={() => handleDeleteSession(session)}
                                />
                            ))}

                            {visibleItems.map((item) => (
                                <DraftCard
                                    key={item.id}
                                    label={item.label}
                                    title={item.title}
                                    timeLabel={formatDraftTime(item.updatedAt)}
                                    removing={removingId === item.id}
                                    onDelete={() => handleRemoveItem(item.id)}
                                    onRestore={() => handleRestore(item)}
                                    onExited={() => handleExited(item.id, () => {
                                        if (item.source === 'journal') {
                                            remove(item.id);
                                        } else {
                                            removeCheckIn(item.id);
                                        }
                                    })}
                                />
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
