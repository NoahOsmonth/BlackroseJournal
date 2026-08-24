import React from 'react';
import { View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { LoadingStatus } from '@/components/ui/LoadingStatus';

interface AuthFormSkeletonProps {
    /** Number of label + input rows to mirror (email, password, confirm…). */
    fields?: number;
    /** Mirror the "forgot password" link row on the sign-in form. */
    showForgotLink?: boolean;
}

/** Mirrors the auth form card (field labels + inputs, submit button, secondary action) found in the (auth) screens. */
export function AuthFormSkeleton({ fields = 2, showForgotLink = false }: AuthFormSkeletonProps) {
    return (
        <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 mt-6" accessibilityLabel="Loading authentication form">
            <LoadingStatus label="Restoring your session" compact />

            {Array.from({ length: fields }, (_, index) => (
                <View key={index} className={index > 0 ? 'mt-4' : undefined}>
                    <Skeleton className="h-3 w-14 mb-2" accessibilityLabel={`Loading field ${index + 1} label`} />
                    <Skeleton className="h-12 w-full rounded-xl" accessibilityLabel={`Loading field ${index + 1} input`} />
                </View>
            ))}

            <View className="mt-5">
                <Skeleton className="h-12 w-full rounded-xl" accessibilityLabel="Loading primary button" />
            </View>

            {showForgotLink ? (
                <View className="mt-4 items-center">
                    <Skeleton className="h-4 w-32" accessibilityLabel="Loading forgot password link" />
                </View>
            ) : null}

            <View className="mt-6 flex-row justify-center">
                <Skeleton className="h-4 w-44" accessibilityLabel="Loading secondary action" />
            </View>
        </View>
    );
}