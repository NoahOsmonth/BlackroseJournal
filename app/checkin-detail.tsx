/**
 * Single check-in — the quiet archive view. One hairline summary card, then
 * the latest exchange rendered through the shared chat rows. No red bars, no
 * tinted medallions, no iOS-2022 pill chrome.
 */

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatMessage } from '@/components/ChatMessage';
import { CheckInDetailSkeleton } from '@/components/intentions/CheckInDetailSkeleton';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useCheckInDetail } from '@/hooks/intentions/useCheckInDetail';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IntentionCheckIn } from '@/services/intentions/intentionsStorage.types';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };
const HAIRLINE = 'border-hairline-light dark:border-hairline-dark';

function resolveLabel(checkIn: IntentionCheckIn): string {
    if (checkIn.type === 'evening') return 'Evening Reflection';
    if (checkIn.type === 'morning') return 'Morning Intention';
    return 'Intention Setting';
}

export default function CheckInDetailScreen() {
    const goBack = useNavBack('/(tabs)/entries');
    const params = useLocalSearchParams<{ id?: string }>();
    const checkInId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { checkIn, isLoading } = useCheckInDetail(checkInId);
    const isDark = useColorScheme() === 'dark';
    const ink = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;

    const transcript = useMemo(() => {
        if (!checkIn?.messages?.length) return [];
        const messages = checkIn.messages;
        if (messages.length <= 2) return messages;
        return messages.slice(-2);
    }, [checkIn?.messages]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="mx-auto w-full max-w-md flex-1">
                <View className="flex-row items-center justify-between px-5 py-4">
                    <Pressable
                        onPress={goBack}
                        className="-ml-2 min-h-11 min-w-11 items-center justify-center"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={ink} />
                    </Pressable>
                    <Text
                        className="text-[26px] leading-[34px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Check-in
                    </Text>
                    <View className="min-h-11 min-w-11" />
                </View>

                {isLoading && <CheckInDetailSkeleton />}

                {!isLoading && !checkIn && (
                    <View className="flex-1 items-center justify-center px-6">
                        <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                            Check-in not found.
                        </Text>
                    </View>
                )}

                {!isLoading && checkIn && (
                    <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
                        <View className={`rounded-card border ${HAIRLINE} bg-surface-light p-5 dark:bg-surface-dark`}>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-[13px] uppercase tracking-[1.4px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {resolveLabel(checkIn)}
                                </Text>
                                <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {new Date(checkIn.createdAt).toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            </View>

                            <Text
                                className="mt-4 text-[24px] leading-[32px] text-text-light dark:text-text-dark"
                                style={SERIF}
                            >
                                {checkIn.title}
                            </Text>

                            {checkIn.summary ? (
                                <Text className="mt-3 text-[15px] leading-[24px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {checkIn.summary}
                                </Text>
                            ) : null}

                            <View className={`mt-5 border-t ${HAIRLINE} pt-4`}>
                                <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                    {checkIn.mood ?? 'Reflective'}
                                </Text>
                            </View>
                        </View>

                        {transcript.length > 0 && (
                            <View className="mt-8">
                                <Text className="mb-4 text-[13px] uppercase tracking-[1.4px] text-text-secondary-light dark:text-text-secondary-dark">
                                    Transcript
                                </Text>
                                <View className="gap-4">
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
                                <Text className="mt-4 text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
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
