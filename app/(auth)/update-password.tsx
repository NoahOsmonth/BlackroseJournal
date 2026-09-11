import { useAuthActions } from '@/hooks/auth/useAuthActions';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import {
    AuthInput,
    FieldLabel,
    PrimaryButton,
    StatusBanner,
} from '@/components/auth/AuthPrimitives';
import {
    AuthBackLink,
    AuthCard,
    AuthHeading,
    AuthWordmark,
} from '@/components/auth/AuthScaffold';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '@/hooks/auth/useAuthSession';

export default function UpdatePasswordScreen() {
    const router = useRouter();
    const { user, isLoading } = useAuthSession();
    const {
        applyPasswordRecoveryUrl,
        updatePassword,
    } = useAuthActions();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingLink, setIsProcessingLink] = useState(true);
    const [hasRecoverySession, setHasRecoverySession] = useState(false);

    const canReset = useMemo(() => Boolean(user?.email) || hasRecoverySession, [user?.email, hasRecoverySession]);

    const applyRecoveryTokens = useCallback(async (url?: string | null) => {
        if (!url) {
            setIsProcessingLink(false);
            return;
        }

        try {
            setHasRecoverySession(await applyPasswordRecoveryUrl(url));
        } catch (error) {
            setStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Invalid recovery link.',
            });
        }

        setIsProcessingLink(false);
    }, [applyPasswordRecoveryUrl]);

    useEffect(() => {
        let isMounted = true;

        const handleUrl = async (url: string | null) => {
            if (!isMounted) return;
            await applyRecoveryTokens(url);
        };

        Linking.getInitialURL().then(handleUrl);
        const subscription = Linking.addEventListener('url', (event) => {
            void handleUrl(event.url);
        });

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, [applyRecoveryTokens]);

    const handleUpdatePassword = useCallback(async () => {
        if (isSubmitting) return;

        if (!canReset) {
            setStatus({ type: 'error', message: 'Open the reset link from your email to continue.' });
            return;
        }

        if (!password || !confirmPassword) {
            setStatus({ type: 'error', message: 'Fill out both password fields.' });
            return;
        }

        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: 'Passwords do not match.' });
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            await updatePassword(password);

            setStatus({ type: 'success', message: 'Password updated. You can sign in now.' });
            setTimeout(() => {
                router.replace('/login');
            }, 800);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Password update failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [canReset, password, confirmPassword, isSubmitting, router, updatePassword]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="w-full max-w-md mx-auto flex-1 px-6 pt-2">
                <AuthBackLink onPress={() => router.back()} />
                <AuthHeading
                    title="Update password"
                    subtitle="Set a new password to regain access to your account."
                />

                <AuthCard>
                    {isLoading || (isProcessingLink && !canReset) ? (
                        <AuthFormSkeleton fields={2} />
                    ) : (
                        <View>
                            {!canReset && (
                                <View className="mb-4 rounded-card border border-hairline-light p-4 dark:border-hairline-dark">
                                    <Text className="text-[14px] text-text-light dark:text-text-dark">
                                        Open the password reset link from your email to continue.
                                    </Text>
                                </View>
                            )}

                            <FieldLabel text="New password" />
                            <AuthInput
                                label="New password"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                secureTextEntry
                                showVisibilityToggle
                                autoCapitalize="none"
                                textContentType="newPassword"
                            />

                            <View className="mt-4">
                                <FieldLabel text="Confirm password" />
                                <AuthInput
                                    label="Confirm password"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="••••••••"
                                    secureTextEntry
                                    showVisibilityToggle
                                    autoCapitalize="none"
                                    textContentType="newPassword"
                                    returnKeyType="go"
                                    onSubmitEditing={() => void handleUpdatePassword()}
                                />
                            </View>

                            {status && <StatusBanner type={status.type} message={status.message} />}

                            <PrimaryButton
                                label="Update password"
                                loadingLabel="Updating…"
                                isLoading={isSubmitting}
                                onPress={() => void handleUpdatePassword()}
                            />
                        </View>
                    )}
                </AuthCard>

                <AuthWordmark />
            </View>
        </SafeAreaView>
    );
}
