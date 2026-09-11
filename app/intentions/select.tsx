import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { INTENTION_AREAS } from '@/constants/intentions';
import { IntentionAreaButton } from '@/components/intentions/IntentionAreaButton';
import { IntentionSelectSkeleton } from '@/components/intentions/IntentionSelectSkeleton';
import { RoseMark } from '@/components/ui/RoseMark';
import { BLACKROSE_PALETTE } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';

/**
 * Intention picker. Concept `black-rose-intention-picker.png`: one sheet —
 * rose mark, serif question, then hairline rows of life areas.
 */
export default function IntentionSelectScreen() {
    const router = useRouter();
    const isDark = useColorScheme() === 'dark';
    const inkColor = isDark ? BLACKROSE_PALETTE.dark.text : BLACKROSE_PALETTE.light.text;
    const accentColor = isDark ? BLACKROSE_PALETTE.dark.accent : BLACKROSE_PALETTE.light.accent;
    // Areas are static constants today; keep a hydration gate so a skeleton shows
    // instantly if the list ever loads remotely.
    const [isHydrating, setIsHydrating] = React.useState(true);
    React.useEffect(() => {
        setIsHydrating(false);
    }, []);

    const handleClose = () => {
        router.back();
    };

    const handleSelectArea = (area: IntentionArea) => {
        router.push({ pathname: '/intentions/chat', params: { area } });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md mx-auto flex-1 px-5 pt-3">
                <View className="mb-3 flex-row justify-end">
                    <Pressable
                        onPress={handleClose}
                        className="h-11 w-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <MaterialIcons name="close" size={26} color={inkColor} />
                    </Pressable>
                </View>

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    <View className="overflow-hidden rounded-sheet border border-hairline-light bg-surface-light dark:border-hairline-dark dark:bg-surface-dark">
                        <View className="items-center px-6 pb-6 pt-8">
                            <RoseMark size={48} color={accentColor} strokeWidth={1.1} variant="sprig" />
                            <Text
                                className="mt-5 text-center text-[22px] leading-[31px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                What&apos;s one area of life that&apos;s calling for your attention right now?
                            </Text>
                        </View>

                        {isHydrating ? (
                            <View className="p-5">
                                <IntentionSelectSkeleton />
                            </View>
                        ) : (
                            <View>
                                {INTENTION_AREAS.map((area) => (
                                    <IntentionAreaButton
                                        key={area.id}
                                        area={area.id}
                                        onPress={handleSelectArea}
                                    />
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
