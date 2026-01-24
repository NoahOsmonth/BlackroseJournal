import React, { useMemo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { IntentionForm } from '@/components/intentions/IntentionForm';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { useIntentionEditor } from '@/hooks/intentions/useIntentionEditor';

export default function IntentionEditScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string }>();
    const intentionId = Array.isArray(params.id) ? params.id[0] : params.id;
    const { intention, values, isLoading, error, setValues, save } = useIntentionEditor(intentionId);

    const areaLabel = useMemo(() => {
        if (!intention) return undefined;
        return getIntentionAreaConfig(intention.area)?.label;
    }, [intention]);

    const handleSave = async () => {
        await save();
        router.back();
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="small" color="#FF9F0A" />
                    <Text className="mt-3 text-sm text-text-secondary-light dark:text-text-secondary-dark">
                        Loading intention...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !intention) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-text-secondary-light dark:text-text-secondary-dark text-center">
                        Unable to load this intention.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <IntentionForm
                title="Edit intention"
                submitLabel="Save"
                initialValues={values}
                areaLabel={areaLabel}
                onChange={setValues}
                onCancel={() => router.back()}
                onSubmit={handleSave}
            />
        </SafeAreaView>
    );
}
