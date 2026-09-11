import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSupabaseSchemaStatus } from '@/hooks/supabase/useSupabaseSchemaStatus';

/** Hairline notice — a bone left rule, not a colored banner fill. */
export function SupabaseStatusBanner() {
    const { warning } = useSupabaseSchemaStatus();
    const [dismissed, setDismissed] = useState(false);

    if (!warning || dismissed) {
        return null;
    }

    return (
        <View className="absolute left-0 right-0 top-0 z-50 px-4 pt-6">
            <View className="rounded-card border border-hairline-light bg-surface-light p-4 dark:border-hairline-dark dark:bg-surface-dark">
                <View className="flex-row items-start gap-3">
                    <View className="h-full w-[3px] self-stretch bg-bone-light dark:bg-bone-dark" />
                    <View className="min-w-0 flex-1">
                        <Text className="text-[15px] text-text-light dark:text-text-dark">
                            Supabase setup needed
                        </Text>
                        <Text className="mt-1 text-[14px] leading-[21px] text-text-secondary-light dark:text-text-secondary-dark">
                            {warning}
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => setDismissed(true)}
                        accessibilityLabel="Dismiss Supabase warning"
                        accessibilityRole="button"
                        className="min-h-11 items-center justify-center px-1"
                    >
                        <Text className="text-[15px] text-text-secondary-light underline dark:text-text-secondary-dark">
                            Dismiss
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}
