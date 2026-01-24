import { extractAuthLinkTokens } from '@/services/auth/authLinking';
import { getSupabaseClient } from '@/services/supabase/supabaseClient';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '@/hooks/auth/useAuthSession';

function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="text-xs font-bold uppercase tracking-wider text-subtext-light dark:text-subtext-dark mb-2">
            {text}
        </Text>
    );
}

export default function UpdatePasswordScreen() {
    const router = useRouter();
    const { user } = useAuthSession();
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

        const tokens = extractAuthLinkTokens(url);
        if (tokens.errorDescription) {
            setStatus({ type: 'error', message: tokens.errorDescription });
            setIsProcessingLink(false);
            return;
        }

        if (tokens.type && tokens.type !== 'recovery') {
            setStatus({ type: 'error', message: 'This link is not valid for password recovery.' });
            setIsProcessingLink(false);
            return;
        }

        if (!tokens.accessToken || !tokens.refreshToken) {
            setIsProcessingLink(false);
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            setStatus({ type: 'error', message: 'Supabase is not configured yet.' });
            setIsProcessingLink(false);
            return;
        }

        const { error } = await client.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        });

        if (error) {
            setStatus({ type: 'error', message: error.message });
        } else {
            setHasRecoverySession(true);
        }

        setIsProcessingLink(false);
    }, []);

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

        const client = getSupabaseClient();
        if (!client) {
            setStatus({ type: 'error', message: 'Supabase is not configured yet.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            const { error } = await client.auth.updateUser({ password });
            if (error) {
                throw new Error(error.message);
            }

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
    }, [canReset, password, confirmPassword, isSubmitting, router]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full px-6 pt-6">
                <Pressable onPress={() => router.back()} className="mb-4">
                    <Text className="text-sm text-primary font-semibold">Back</Text>
                </Pressable>

                <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                    Update password
                </Text>
                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                    Set a new password to regain access to your account.
                </Text>

                <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mt-6">
                    {isProcessingLink && !canReset ? (
                        <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                            Checking your recovery link...
                        </Text>
                    ) : (
                        <View>
                            {!canReset && (
                                <View className="mb-4 rounded-xl p-3 bg-yellow-300/20 dark:bg-yellow-300/10">
                                    <Text className="text-sm text-text-light dark:text-text-dark">
                                        Open the password reset link from your email to continue.
                                    </Text>
                                </View>
                            )}

                            <FieldLabel text="New password" />
                            <TextInput
                                value={password}
                                onChangeText={setPassword}
                                placeholder="••••••••"
                                secureTextEntry
                                autoCapitalize="none"
                                textContentType="newPassword"
                                className="rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark"
                            />

                            <View className="mt-4">
                                <FieldLabel text="Confirm password" />
                                <TextInput
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="••••••••"
                                    secureTextEntry
                                    autoCapitalize="none"
                                    textContentType="newPassword"
                                    className="rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark"
                                />
                            </View>

                            {status && (
                                <View
                                    className={`mt-4 rounded-xl p-3 ${status.type === 'error'
                                        ? 'bg-yellow-300/20 dark:bg-yellow-300/10'
                                        : 'bg-green-300/20 dark:bg-green-300/10'
                                        }`}
                                >
                                    <Text className="text-sm text-text-light dark:text-text-dark">
                                        {status.message}
                                    </Text>
                                </View>
                            )}

                            <Pressable
                                onPress={handleUpdatePassword}
                                disabled={isSubmitting}
                                className={`mt-5 rounded-xl py-3 ${isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}
                            >
                                <Text className="text-white font-semibold text-center">
                                    {isSubmitting ? 'Updating...' : 'Update password'}
                                </Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}
