import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { INTENTION_AREAS } from '@/constants/intentions';
import { IntentionAreaButton } from '@/components/intentions/IntentionAreaButton';
import { IntentionSelectSkeleton } from '@/components/intentions/IntentionSelectSkeleton';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';

function CompassBadge() {
    return (
        <View className="relative w-24 h-24 items-center justify-center">
            <View className="absolute inset-0 bg-yellow-500/10 rounded-full" />
            <View className="w-20 h-20 bg-yellow-100 rounded-full items-center justify-center border-2 border-gray-900">
                <View className="w-[85%] h-[85%] bg-yellow-50 rounded-full border border-yellow-200 items-center justify-center relative">
                    <View className="absolute top-2 w-2 h-8 bg-red-400 rounded-t-full rotate-45" />
                    <View className="absolute bottom-2 w-2 h-8 bg-slate-300 rounded-b-full rotate-45" />
                    <View className="w-2 h-2 bg-white rounded-full border border-slate-200" />
                    <Text className="absolute top-1 text-[8px] font-bold text-text-secondary-light dark:text-text-secondary-dark">N</Text>
                </View>
            </View>
            <MaterialIcons name="auto-awesome" size={18} color="#FCD34D" style={{ position: 'absolute', top: 0, right: 6 }} />
            <MaterialIcons name="auto-awesome" size={14} color="#FDE68A" style={{ position: 'absolute', bottom: 8, left: 4 }} />
            <MaterialIcons name="auto-awesome" size={10} color="#FFFFFF" style={{ position: 'absolute', top: 10, left: 10 }} />
        </View>
    );
}

export default function IntentionSelectScreen() {
    const router = useRouter();
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
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
            <View className="flex-1 max-w-md mx-auto w-full p-5">
                <View className="h-2" />
                <View className="flex items-end mb-2">
                    <Pressable
                        onPress={handleClose}
                        className="p-2 rounded-full"
                        accessibilityLabel="Close"
                    >
                        <MaterialIcons name="close" size={24} color="#9CA3AF" />
                    </Pressable>
                </View>

                <View className="items-center mb-8 text-center px-4">
                    <CompassBadge />
                    <Text className="mt-6 text-[19px] leading-relaxed font-medium text-text-light dark:text-text-dark">
                        What&apos;s one area of life that&apos;s calling for your attention right now?
                    </Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {isHydrating ? (
                        <IntentionSelectSkeleton />
                    ) : (
                    <View className="gap-3 pb-6">
                        {INTENTION_AREAS.map((area) => (
                            <IntentionAreaButton
                                key={area.id}
                                area={area.id}
                                onPress={handleSelectArea}
                            />
                        ))}
                    </View>
                    )}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}
