import React, { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

import { getIntentionAreaConfig } from '@/constants/intentions';
import { getLocalDateKey } from '@/utils/date';
import { useIntentionDetail } from '@/hooks/intentions/useIntentionDetail';
import { useIntentions } from '@/hooks/intentions/useIntentions';

const heroImage = require('@/assets/intentions/intention-hero.png');

export default function IntentionDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const intentionId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { intention, latestCheckIn, isLoading } = useIntentionDetail(intentionId);
    const { archive, remove } = useIntentions();
    const [moreVisible, setMoreVisible] = useState(false);

    const areaConfig = useMemo(
        () => (intention ? getIntentionAreaConfig(intention.area) : undefined),
        [intention]
    );

    const checkInDateLabel = useMemo(() => {
        if (!latestCheckIn) return null;
        const date = new Date(latestCheckIn.createdAt);
        const isToday = getLocalDateKey(date) === getLocalDateKey(new Date());
        const formatted = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        return isToday ? `Today ${formatted}` : formatted;
    }, [latestCheckIn]);

    const handleBack = () => {
        router.back();
    };

    const handleResume = () => {
        if (!intentionId) return;
        router.push({ pathname: '/intentions/chat', params: { intentionId } });
    };

    const handleArchive = async () => {
        if (!intentionId) return;
        await archive(intentionId);
        setMoreVisible(false);
        router.back();
    };

    const handleDelete = () => {
        if (!intentionId) return;
        Alert.alert(
            'Delete intention',
            'This will remove the intention and its check-ins from this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        await remove(intentionId);
                        setMoreVisible(false);
                        router.back();
                    },
                },
            ]
        );
    };

    if (isLoading || !intention) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
                <View className="flex-1 max-w-md mx-auto w-full items-center justify-center">
                    <Text className="text-text-secondary-light dark:text-text-secondary-dark">
                        Loading intention...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="flex-row items-center justify-between px-4 pt-6 pb-4">
                    <Pressable onPress={handleBack} className="p-2" accessibilityLabel="Back">
                        <MaterialIcons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-lg font-bold text-text-light dark:text-white">Intention</Text>
                    <Pressable
                        className="p-2"
                        accessibilityLabel="More options"
                        onPress={() => setMoreVisible(true)}
                    >
                        <MaterialIcons name="more-horiz" size={24} color="#111827" />
                    </Pressable>
                </View>

                <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                    <View className="bg-surface-light dark:bg-surface-dark rounded-3xl overflow-hidden shadow-soft border border-gray-100 dark:border-divider-dark">
                        <View className="h-56 bg-gray-200 dark:bg-secondary-dark relative items-center justify-center">
                            <Image source={heroImage} style={{ width: 96, height: 96 }} />
                            <View className="absolute bottom-4 right-4 bg-black/70 px-4 py-1.5 rounded-full">
                                <Text className="text-xs font-medium text-white">
                                    {areaConfig?.label ?? 'Intention'}
                                </Text>
                            </View>
                        </View>
                        <View className="p-6">
                            <Text className="text-xl font-bold mb-3 text-text-light dark:text-white">
                                {intention.title}
                            </Text>
                            <Text className="text-sm text-text-secondary-light dark:text-gray-300 leading-relaxed mb-4">
                                {intention.description}
                            </Text>
                            <View className="flex-row justify-end">
                                <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                    {intention.description.length} / 280
                                </Text>
                            </View>
                        </View>
                    </View>

                    {latestCheckIn && (
                        <View className="mt-8">
                            <View className="items-center mb-3">
                                <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark">
                                    {checkInDateLabel}
                                </Text>
                            </View>
                            <View className="bg-surface-light dark:bg-surface-dark rounded-3xl p-5 border border-gray-100 dark:border-divider-dark">
                                <View className="flex-row items-center justify-between text-xs text-text-secondary-light dark:text-text-secondary-dark mb-3">
                                    <View className="flex-row items-center gap-2">
                                        <MaterialIcons name="edit" size={16} color="#9CA3AF" />
                                        <Text>Intention Setting</Text>
                                    </View>
                                    <Text>
                                        {new Date(latestCheckIn.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </Text>
                                </View>
                                <View className="flex-row items-start gap-3 mb-2">
                                    <MaterialIcons name="adjust" size={20} color="#EF4444" />
                                    <Text className="font-semibold text-text-light dark:text-white text-sm leading-tight">
                                        {latestCheckIn.title}
                                    </Text>
                                </View>
                                <Text className="text-sm text-text-secondary-light dark:text-gray-300 leading-snug mb-4">
                                    {latestCheckIn.summary}
                                </Text>
                                <View className="flex-row items-center gap-1.5 text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
                                    <MaterialIcons name="search" size={16} color="#9CA3AF" />
                                    <Text>{latestCheckIn.mood ?? 'Reflective'}</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                <View className="px-4 pb-8 pt-8">
                    <Pressable
                        onPress={handleResume}
                        className="w-full h-14 bg-text-light dark:bg-gray-200 rounded-2xl flex-row items-center justify-center gap-2"
                        accessibilityLabel="Resume check-in"
                    >
                        <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                        <Text className="font-bold text-white dark:text-black">Resume check-in</Text>
                    </Pressable>
                </View>

                {moreVisible && (
                    <View className="absolute inset-0 bg-black/40 justify-end">
                        <View className="bg-surface-light dark:bg-surface-dark rounded-t-3xl p-6">
                            <Text className="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide mb-4">
                                Intention options
                            </Text>
                            <Pressable
                                onPress={() => {
                                    setMoreVisible(false);
                                    if (intentionId) {
                                        router.push({ pathname: '/intentions/edit', params: { id: intentionId } });
                                    }
                                }}
                                className="py-3"
                            >
                                <Text className="text-base text-text-light dark:text-white">Edit</Text>
                            </Pressable>
                            <Pressable onPress={handleArchive} className="py-3">
                                <Text className="text-base text-text-light dark:text-white">Archive</Text>
                            </Pressable>
                            <Pressable onPress={handleDelete} className="py-3">
                                <Text className="text-base text-red-500">Delete</Text>
                            </Pressable>
                            <Pressable onPress={() => setMoreVisible(false)} className="py-3">
                                <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark">
                                    Cancel
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
