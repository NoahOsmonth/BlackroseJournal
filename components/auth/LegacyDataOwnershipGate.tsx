import { useLegacyDataOwnership } from '@/hooks/auth/useLegacyDataOwnership';
import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingBar } from '@/components/ui/LoadingBar';

interface LegacyDataOwnershipGateProps extends PropsWithChildren {
    readonly accountId: string | null;
    readonly enabled?: boolean;
}

export function LegacyDataOwnershipGate({
    accountId,
    children,
    enabled = true,
}: LegacyDataOwnershipGateProps) {
    if (!enabled) return children;
    return (
        <ActiveLegacyDataOwnershipGate accountId={accountId}>
            {children}
        </ActiveLegacyDataOwnershipGate>
    );
}

function ActiveLegacyDataOwnershipGate({
    accountId,
    children,
}: Omit<LegacyDataOwnershipGateProps, 'enabled'>) {
    const migration = useLegacyDataOwnership(accountId);

    if (!accountId || (!migration.isChecking && !migration.needsConfirmation)) {
        return children;
    }

    if (migration.isChecking) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
                <LoadingBar accessibilityLabel="Checking local journal data" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark">
            <View className="flex-1 justify-center px-6">
                <View className="rounded-2xl bg-surface-light p-6 dark:bg-surface-dark">
                    <Text className="text-2xl font-serif font-bold text-text-light dark:text-text-dark">
                        Keep your journal with this account?
                    </Text>
                    <Text className="mt-3 text-sm leading-6 text-subtext-light dark:text-subtext-dark">
                        We found journal data from before account sign-in. Confirm it belongs to you before we place it in this account&apos;s private local storage.
                    </Text>
                    {migration.error ? (
                        <Text className="mt-3 text-sm text-text-light dark:text-text-dark">
                            {migration.error}
                        </Text>
                    ) : null}
                    <View className="mt-6 gap-3">
                        <Pressable
                            accessibilityRole="button"
                            disabled={migration.isMigrating}
                            onPress={() => { void migration.confirmOwnership(); }}
                            className="rounded-xl bg-primary py-3"
                        >
                            <Text className="text-center font-semibold text-white dark:text-white">
                                {migration.isMigrating ? 'Moving journal...' : 'Yes, this data is mine'}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            disabled={migration.isMigrating}
                            onPress={migration.continueWithoutLegacyData}
                            className="rounded-xl border border-divider-light py-3 dark:border-divider-dark"
                        >
                            <Text className="text-center font-semibold text-text-light dark:text-text-dark">
                                Continue with an empty account
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
