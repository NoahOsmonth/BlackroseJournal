import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useJournalEntries } from '@/hooks/journal/useJournalEntries';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { Skeleton } from '@/components/ui/Skeleton';
import { SkeletonText } from '@/components/ui/SkeletonText';
import { AnimatedRemove } from '@/components/ui/AnimatedRemove';
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

function formatDraftTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${
        date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }`;
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
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';
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
            label: 'Rosebud',
            updatedAt: entry.updatedAt,
            source: 'journal' as const,
        }));

        const checkInItems = checkInDrafts.map((checkIn) => ({
            id: checkIn.id,
            title: checkIn.summary,
            label: 'Rosebud / Intention Check-in',
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

    const handleDelete = async (item: DraftItem) => {
        if (item.source === 'journal') {
            handleExited(item.id, () => remove(item.id));
            return;
        }
        handleExited(item.id, () => removeCheckIn(item.id));
    };

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

    const handleDeleteSession = async (session: ChatSession) => {
        handleExited(session.conversationId, () => {
            removeSession(session.conversationId);
            setSessions((prev) => prev.filter((s) => s.conversationId !== session.conversationId));
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-3">
                    <View className="flex-row items-center">
                        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                            <MaterialIcons name="arrow-back" size={28} color={iconColor} />
                        </Pressable>
                        <Text className="text-2xl font-bold ml-2 text-text-light dark:text-text-dark">Drafts</Text>
                    </View>
                    <Pressable
                        className="p-2 -mr-2"
                        accessibilityLabel="Sort drafts"
                        onPress={() => setSortMode((prev) => (prev === 'recent' ? 'title' : 'recent'))}
                    >
                        <MaterialIcons name="sort" size={24} color="#6B7280" />
                    </Pressable>
                </View>

                {entriesLoading || checkInsLoading || !sessionsLoaded ? (
                                <ScrollView className="flex-1 px-4 pt-2 pb-6" showsVerticalScrollIndicator={false}>
                                    <LoadingStatus label="Loading drafts" detail="Gathering your works in progress." compact />
                                    {/* Active sessions skeleton */}
                                    <View className="mb-6">
                                        <Skeleton className="h-3 w-20 mb-3" accessibilityLabel="Loading active header" />
                                        <View className="gap-3">
                                            {[1, 2, 3].map((index) => (
                                                <View key={index} className="bg-surface-light dark:bg-card-dark rounded-xl shadow-soft border border-gray-100 dark:border-divider-dark overflow-hidden">
                                                    <View className="p-4 pb-3">
                                                        <Skeleton className="h-3 w-16 mb-2" accessibilityLabel={`Loading autosaved label ${index}`} />
                                                        <Skeleton className="h-4 w-3/4" accessibilityLabel={`Loading session title ${index}`} />
                                                    </View>
                                                    <View className="h-px bg-divider-light dark:bg-divider-dark mx-4" />
                                                    <View className="px-4 py-3 flex-row items-center justify-between">
                                                        <Skeleton className="h-3 w-32" accessibilityLabel={`Loading session time ${index}`} />
                                                        <Skeleton className="h-5 w-5 rounded" accessibilityLabel={`Loading delete button ${index}`} />
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                    {/* Saved drafts skeleton */}
                                    <View className="gap-4">
                                        <Skeleton className="h-3 w-28 mb-3" accessibilityLabel="Loading saved drafts header" />
                                        {[1, 2, 3].map((index) => (
                                            <View key={index} className="bg-surface-light dark:bg-card-dark rounded-xl shadow-soft border border-gray-100 dark:border-divider-dark overflow-hidden">
                                                <View className="p-4 pb-5">
                                                    <Skeleton className="h-3 w-20 mb-2" accessibilityLabel={`Loading draft label ${index}`} />
                                                    <Skeleton className="h-5 w-5/6" accessibilityLabel={`Loading draft title ${index}`} />
                                                </View>
                                                <View className="h-px bg-divider-light dark:bg-divider-dark mx-4" />
                                                <View className="px-4 py-3 flex-row items-center justify-between">
                                                    <Skeleton className="h-3 w-32" accessibilityLabel={`Loading draft time ${index}`} />
                                                    <View className="flex-row items-center gap-6">
                                                        <Skeleton className="h-5 w-5 rounded" accessibilityLabel={`Loading delete ${index}`} />
                                                        <Skeleton className="h-5 w-16 rounded" accessibilityLabel={`Loading restore ${index}`} />
                                                    </View>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            ) : sessions.length === 0 && items.length === 0 ? (
                    <View className="flex-1 px-6 items-center justify-center">
                        <EmptyState
                            icon="edit-note"
                            title="No drafts yet"
                            message="Drafts live here as placeholders for conversations you haven't finished yet."
                        />
                    </View>
                ) : (
                <ScrollView className="flex-1 px-4 pt-2 pb-6" showsVerticalScrollIndicator={false}>
                    {sessions.length > 0 && (
                        <View className="mb-6">
                            <Text className="text-[12px] font-semibold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase mb-3">
                                Active
                            </Text>
                            <View className="gap-3">
                                {sessions
                                    .filter((session) => !removedCount[session.conversationId])
                                    .map((session) => (
                                        <AnimatedRemove
                                            key={session.conversationId}
                                            removing={removingId === session.conversationId}
                                            onExited={() =>
                                                handleExited(session.conversationId, () => {
                                                    removeSession(session.conversationId);
                                                    setSessions((prev) =>
                                                        prev.filter((s) => s.conversationId !== session.conversationId)
                                                    );
                                                })
                                            }
                                        >
                                            <Pressable
                                                onPress={() => handleResumeSession(session)}
                                                accessibilityLabel="Resume session"
                                                className="bg-surface-light dark:bg-card-dark rounded-xl shadow-soft border border-gray-100 dark:border-divider-dark overflow-hidden active:opacity-80"
                                            >
                                                <View className="p-4 pb-3">
                                                    <Text className="text-[11px] font-semibold tracking-wider text-primary uppercase mb-2">
                                                        Autosaved
                                                    </Text>
                                                    <Text
                                                        className="text-[16px] leading-snug font-medium text-text-light dark:text-text-dark"
                                                        numberOfLines={2}
                                                    >
                                                        {sessionTitle(session)}
                                                    </Text>
                                                </View>
                                                <View className="h-px bg-divider-light dark:bg-divider-dark mx-4" />
                                                <View className="px-4 py-3 flex-row items-center justify-between">
                                                    <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark font-medium">
                                                        {formatDraftTime(session.updatedAt)}
                                                    </Text>
                                                    <Pressable
                                                        onPress={() => handleRemoveItem(session.conversationId)}
                                                        accessibilityLabel="Delete session"
                                                        hitSlop={8}
                                                    >
                                                        <MaterialIcons name="delete" size={20} color="#9CA3AF" />
                                                    </Pressable>
                                                </View>
                                            </Pressable>
                                        </AnimatedRemove>
                                    ))}
                            </View>
                        </View>
                    )}

                    {sessions.length > 0 && items.length > 0 && (
                        <Text className="text-[12px] font-semibold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase mb-3">
                            Saved drafts
                        </Text>
                    )}

                    <View className="gap-4">
                        {items
                            .filter((item) => !removedCount[item.id])
                            .map((item) => (
                                <AnimatedRemove
                                    key={item.id}
                                    removing={removingId === item.id}
                                    onExited={() =>
                                        handleExited(item.id, () => {
                                            if (item.source === 'journal') {
                                                remove(item.id);
                                            } else {
                                                removeCheckIn(item.id);
                                            }
                                        })
                                    }
                                >
                                    <View
                                        className="bg-surface-light dark:bg-card-dark rounded-xl shadow-soft border border-gray-100 dark:border-divider-dark overflow-hidden"
                                    >
                                        <View className="p-4 pb-5">
                                            <Text className="text-[11px] font-semibold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase mb-2">
                                                {item.label}
                                            </Text>
                                            <Text
                                                className="text-[17px] leading-snug font-medium text-text-light dark:text-text-dark"
                                                numberOfLines={2}
                                            >
                                                {item.title}
                                            </Text>
                                        </View>
                                        <View className="h-px bg-divider-light dark:bg-divider-dark mx-4" />
                                        <View className="px-4 py-3 flex-row items-center justify-between">
                                            <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark font-medium">
                                                {formatDraftTime(item.updatedAt)}
                                            </Text>
                                            <View className="flex-row items-center gap-6">
                                                <Pressable onPress={() => handleRemoveItem(item.id)} accessibilityLabel="Delete draft">
                                                    <MaterialIcons name="delete" size={20} color="#9CA3AF" />
                                                </Pressable>
                                                <Pressable onPress={() => handleRestore(item)} accessibilityLabel="Restore draft">
                                                    <Text className="text-[15px] font-bold text-text-light dark:text-text-dark">
                                                        Restore
                                                    </Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    </View>
                                </AnimatedRemove>
                            ))}
                    </View>
                </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
