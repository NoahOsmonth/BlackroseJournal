import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { getLocalDateKey } from '@/utils/date';
import { useIntentionDetail } from '@/hooks/intentions/useIntentionDetail';
import { useIntentions } from '@/hooks/intentions/useIntentions';
import { useNavBack } from '@/hooks/navigation/useNavBack';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingStatus } from '@/components/ui/LoadingStatus';
import { StaggerEntranceItem } from '@/components/ui/StaggerEntrance';
import { WreathMark } from '@/components/intentions/WreathMark';

const SERIF = { fontFamily: 'PlayfairDisplayRegular' };

export default function IntentionDetailScreen() {
    const router = useRouter();
    const goBack = useNavBack('/(tabs)/today');
    const params = useLocalSearchParams<{ id?: string }>();
    const intentionId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { intention, latestCheckIn, isLoading } = useIntentionDetail(intentionId);
    const { archive, remove } = useIntentions();
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const mutedColor = isDark ? BLACKROSE_PALETTE.dark.text2 : BLACKROSE_PALETTE.light.text2;
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
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
        return isToday ? `Today · ${formatted}` : formatted;
    }, [latestCheckIn]);

    const handleBack = () => {
        goBack();
    };

    const handleResume = () => {
        if (!intentionId) return;
        router.push({ pathname: '/intentions/chat', params: { intentionId } });
    };

    const handleArchive = async () => {
        if (!intentionId) return;
        await archive(intentionId);
        setMoreVisible(false);
        goBack();
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
                        goBack();
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
                <View className="flex-1 max-w-md mx-auto w-full items-center justify-center">
                    <LoadingStatus label="Loading your intention" detail="Bringing your latest check-in into view." />
                </View>
            </SafeAreaView>
        );
    }

    if (!intention) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
                <View className="flex-1 max-w-md mx-auto w-full items-center justify-center px-6">
                    <EmptyState
                        icon="event-busy"
                        title="Intention not found"
                        message="This intention may have been deleted or is no longer available."
                        actionLabel="Go back"
                        onActionPress={handleBack}
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full">
                <View className="min-h-[56px] flex-row items-center justify-between px-4 py-2">
                    <Pressable
                        onPress={handleBack}
                        className="h-11 w-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Back"
                    >
                        <MaterialIcons name="arrow-back" size={26} color={inkColor} />
                    </Pressable>
                    <Text
                        className="flex-1 text-center text-[28px] text-text-light dark:text-text-dark"
                        style={SERIF}
                    >
                        Intention
                    </Text>
                    <Pressable
                        className="h-11 w-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="More options"
                        onPress={() => setMoreVisible(true)}
                    >
                        <MaterialIcons name="more-vert" size={24} color={inkColor} />
                    </Pressable>
                </View>

                <ScrollView
                    className="flex-1 px-5"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    <View className="rounded-card border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark">
                        <WreathMark size={64} color={accentColor} />

                        <View className="mt-5 self-start rounded-full bg-surface-2-light px-3.5 py-1.5 dark:bg-surface-2-dark">
                            <Text className="text-[14px] text-text-light dark:text-text-dark">
                                {areaConfig?.label ?? 'Intention'}
                            </Text>
                        </View>

                        <Text
                            className="mt-4 text-[30px] leading-[38px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            {intention.title}
                        </Text>

                        <Text className="mt-4 text-[16px] leading-[26px] text-text-light dark:text-text-dark">
                            {intention.description}
                        </Text>

                        <Text className="mt-5 text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                            {intention.description.length} / 280
                        </Text>
                    </View>

                    {latestCheckIn && (
                        <View className="mt-8">
                            <Text
                                className="mb-3 text-[19px] text-text-secondary-light dark:text-text-secondary-dark"
                                style={SERIF}
                            >
                                {checkInDateLabel}
                            </Text>
                            <StaggerEntranceItem
                                index={0}
                                columns={1}
                                totalItems={1}
                                staggerType="diagonal"
                                baseDelayMs={30}
                                delayFactorMs={40}
                                className="w-full"
                            >
                                <View className="rounded-card border border-hairline-light bg-surface-light p-5 dark:border-hairline-dark dark:bg-surface-dark">
                                    <View className="flex-row items-center gap-4">
                                        <View className="h-16 w-16 items-center justify-center rounded-full border border-hairline-light dark:border-hairline-dark">
                                            <MaterialIcons name="menu-book" size={26} color={accentColor} />
                                        </View>
                                        <View className="min-w-0 flex-1">
                                            <Text className="text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                                                Intention setting
                                            </Text>
                                            <Text
                                                className="mt-1.5 text-[20px] leading-[27px] text-text-light dark:text-text-dark"
                                                style={SERIF}
                                            >
                                                {latestCheckIn.title}
                                            </Text>
                                        </View>
                                        <MaterialIcons name="chevron-right" size={22} color={mutedColor} />
                                    </View>

                                    <Text className="mt-4 text-[15px] leading-[24px] text-text-secondary-light dark:text-text-secondary-dark">
                                        {latestCheckIn.summary}
                                    </Text>
                                </View>
                            </StaggerEntranceItem>
                        </View>
                    )}
                </ScrollView>

                <View className="border-t border-hairline-light px-5 pb-8 pt-5 dark:border-hairline-dark">
                    <Pressable
                        onPress={handleResume}
                        accessibilityRole="button"
                        accessibilityLabel="Resume check-in"
                        className="h-14 w-full flex-row items-center justify-center rounded-control border border-bone-light active:opacity-80 dark:border-bone-dark"
                    >
                        <Text
                            className="text-[19px] text-text-light dark:text-text-dark"
                            style={SERIF}
                        >
                            Resume check-in
                        </Text>
                    </Pressable>
                </View>

                {moreVisible && (
                    <View className="absolute inset-0 justify-end bg-black/40">
                        <View className="mx-3 mb-3 overflow-hidden rounded-sheet border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark">
                            <Text className="mb-3 text-[11px] uppercase tracking-[1.5px] text-text-secondary-light dark:text-text-secondary-dark">
                                Intention options
                            </Text>
                            <Pressable
                                onPress={() => {
                                    setMoreVisible(false);
                                    if (intentionId) {
                                        router.push({
                                            pathname: '/intentions/chat',
                                            params: { intentionId, mode: 'refine' },
                                        });
                                    }
                                }}
                                className="min-h-12 justify-center border-t border-hairline-light dark:border-hairline-dark"
                            >
                                <Text className="text-[16px] text-text-light dark:text-text-dark">
                                    Refine with Blackrose
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => {
                                    setMoreVisible(false);
                                    if (intentionId) {
                                        router.push({
                                            pathname: '/intentions/edit',
                                            params: { id: intentionId, advanced: '1' },
                                        });
                                    }
                                }}
                                className="min-h-12 justify-center border-t border-hairline-light dark:border-hairline-dark"
                            >
                                <Text className="text-[16px] text-text-light dark:text-text-dark">
                                    Advanced direct edit
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={handleArchive}
                                className="min-h-12 justify-center border-t border-hairline-light dark:border-hairline-dark"
                            >
                                <Text className="text-[16px] text-text-light dark:text-text-dark">Archive</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleDelete}
                                className="min-h-12 justify-center border-t border-hairline-light dark:border-hairline-dark"
                            >
                                <Text className="text-[16px] text-danger-light dark:text-danger-dark">Delete</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setMoreVisible(false)}
                                className="min-h-12 justify-center border-t border-hairline-light dark:border-hairline-dark"
                            >
                                <Text className="text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
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
