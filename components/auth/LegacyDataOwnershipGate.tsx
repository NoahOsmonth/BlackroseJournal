import { useLegacyDataOwnership } from '@/hooks/auth/useLegacyDataOwnership';
import type { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingBar } from '@/components/ui/LoadingBar';
import { useHindsightRebuild } from '@/hooks/memory/useHindsightRebuild';

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
    useHindsightRebuild(
        accountId,
        Boolean(accountId && !migration.isChecking && !migration.needsConfirmation)
    );

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
                <View className="rounded-card border border-hairline-light bg-surface-light p-6 dark:border-hairline-dark dark:bg-surface-dark">
                    <Text
                        className="text-[30px] leading-[38px] text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Keep your journal with this account?
                    </Text>
                    <Text className="mt-3 text-[15px] leading-[24px] text-text-secondary-light dark:text-text-secondary-dark">
                        We found journal data from before account sign-in. Confirm it belongs to you before we place it in this account&apos;s private local storage.
                    </Text>
                    {migration.error ? (
                        <Text className="mt-3 text-[15px] leading-[23px] text-text-light dark:text-text-dark">
                            {migration.error}
                        </Text>
                    ) : null}
                    <View className="mt-6 gap-3">
                        <Pressable
                            accessibilityRole="button"
                            disabled={migration.isMigrating}
                            onPress={() => { void migration.confirmOwnership(); }}
                            className="min-h-[52px] items-center justify-center rounded-control border border-bone-light dark:border-bone-dark"
                        >
                            <Text
                                className="text-center text-[17px] text-text-light dark:text-text-dark"
                                style={{ fontFamily: 'PlayfairDisplayRegular' }}
                            >
                                {migration.isMigrating ? 'Moving journal…' : 'Yes, this data is mine'}
                            </Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            disabled={migration.isMigrating}
                            onPress={migration.continueWithoutLegacyData}
                            className="min-h-12 items-center justify-center rounded-control border border-hairline-light dark:border-hairline-dark"
                        >
                            <Text className="text-center text-[16px] text-text-secondary-light dark:text-text-secondary-dark">
                                Continue with an empty account
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
