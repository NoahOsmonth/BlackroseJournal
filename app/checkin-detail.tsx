import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';
import { ChatMessage } from '@/components/ChatMessage';
import { useCheckInDetail } from '@/hooks/intentions/useCheckInDetail';

function resolveLabel(checkIn: IntentionCheckIn): string {
    if (checkIn.type === 'evening') return 'Evening Reflection';
    if (checkIn.type === 'morning') return 'Morning Intention';
    return 'Intention Setting';
}

export default function CheckInDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const checkInId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { checkIn, isLoading } = useCheckInDetail(checkInId);
    const colorScheme = useColorScheme();
    const iconColor = colorScheme === 'dark' ? '#F9FAFB' : '#111827';

    const transcript = useMemo(() => {
        if (!checkIn?.messages?.length) return [];
        const messages = checkIn.messages;
        if (messages.length <= 2) return messages;
        return messages.slice(-2);
    }, [checkIn?.messages]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 py-4">
                    <Pressable onPress={() => router.back()} className="p-2 -ml-2">
                        <MaterialIcons name="arrow-back" size={24} color={iconColor} />
                    </Pressable>
                    <Text className="text-lg font-semibold text-text-light dark:text-white">
                        Check-in
                    </Text>
                    <View className="w-10" />
                </View>

                {isLoading && (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="small" color="#FF9F0A" />
                        <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                            Loading check-in...
                        </Text>
                    </View>
                )}

                {!isLoading && !checkIn && (
                    <View className="flex-1 items-center justify-center">
                        <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                            Check-in not found.
                        </Text>
                    </View>
                )}

                {!isLoading && checkIn && (
                    <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
                        <View className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 border border-gray-100 dark:border-divider-dark">
                            <View className="flex-row items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark mb-3">
                                <View className="flex-row items-center gap-2">
                                    <MaterialIcons name="edit" size={16} color="#9CA3AF" />
                                    <Text className="text-text-secondary-light dark:text-text-secondary-dark">{resolveLabel(checkIn)}</Text>
                                </View>
                                <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                                    {new Date(checkIn.createdAt).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            </View>
                            <View className="flex-row items-start gap-3 mb-2">
                                <MaterialIcons name="adjust" size={20} color="#EF4444" />
                                <Text className="font-semibold text-text-light dark:text-white text-sm leading-tight">
                                    {checkIn.title}
                                </Text>
                            </View>
                            <Text className="text-sm text-text-secondary-light dark:text-gray-300 leading-snug mb-4">
                                {checkIn.summary}
                            </Text>
                            <View className="flex-row items-center gap-1.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                <MaterialIcons name="search" size={16} color="#9CA3AF" />
                                <Text className="text-text-secondary-light dark:text-text-secondary-dark">{checkIn.mood ?? 'Reflective'}</Text>
                            </View>
                        </View>

                        {transcript.length > 0 && (
                            <View className="mt-8">
                                <Text className="text-[13px] font-semibold text-text-secondary-light dark:text-text-secondary-dark mb-3">
                                    Transcript
                                </Text>
                                <View className="gap-y-4">
                                    {transcript.map((message) => (
                                        <ChatMessage
                                            key={message.id}
                                            text={message.content}
                                            isAi={message.role === 'assistant'}
                                            reasoning={message.reasoning}
                                            isReadOnly
                                        />
                                    ))}
                                </View>
                                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-4">
                                    Showing the latest exchange from this check-in.
                                </Text>
                            </View>
                        )}
                        <View className="h-12" />
                    </ScrollView>
                )}
            </View>
        </SafeAreaView>
    );
}
