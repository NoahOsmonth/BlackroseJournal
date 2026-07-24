import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntentionForm } from '@/components/intentions/IntentionForm';
import { IntentionFormSkeleton } from '@/components/intentions/IntentionFormSkeleton';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { useIntentionEditor } from '@/hooks/intentions/useIntentionEditor';

export default function IntentionEditScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string; advanced?: string }>();
    const intentionId = Array.isArray(params.id) ? params.id[0] : params.id;
    const advanced = Array.isArray(params.advanced) ? params.advanced[0] : params.advanced;
    const { intention, values, isLoading, error, setValues, save } = useIntentionEditor(intentionId);

    const areaLabel = useMemo(() => {
        if (!intention) return undefined;
        return getIntentionAreaConfig(intention.area)?.label;
    }, [intention]);

    const handleSave = async () => {
        await save();
        router.back();
    };

    if (intentionId && advanced !== '1') {
        return (
            <Redirect
                href={{
                    pathname: '/intentions/chat',
                    params: { intentionId, mode: 'refine' },
                }}
            />
        );
    }

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
                <IntentionFormSkeleton />
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
