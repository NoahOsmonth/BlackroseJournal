import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatMessage } from '@/components/ChatMessage';import { useJournalEntries } from '@/hooks/journal/useJournalEntries';

export default function EntryDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const entryId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { getById } = useJournalEntries();
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    const [isLoading, setIsLoading] = useState(true);
    const [entry, setEntry] = useState<any>(null);

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!entryId) return;
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
                        <View className="gap-y-4">
                            {entry.messages.map((message: any) => (
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
