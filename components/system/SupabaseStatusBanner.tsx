import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSupabaseSchemaStatus } from '@/hooks/supabase/useSupabaseSchemaStatus';

export function SupabaseStatusBanner() {
    const { warning } = useSupabaseSchemaStatus();
    const [dismissed, setDismissed] = useState(false);

    if (!warning || dismissed) {
        return null;
    }

    return (
        <View className="absolute top-0 left-0 right-0 z-50 px-4 pt-6">
            <View className="bg-surface-light dark:bg-surface-dark border border-divider-light dark:border-divider-dark rounded-xl p-3 border-l-4 border-primary">
                <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                        <Text className="text-xs font-semibold text-text-primary-light dark:text-text-primary-dark">
                            Supabase setup needed
                        </Text>
                        <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            {warning}
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => setDismissed(true)}
                        accessibilityLabel="Dismiss Supabase warning"
                        className="px-2 py-1"
                    >
                        <Text className="text-xs font-semibold text-primary">Dismiss</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
