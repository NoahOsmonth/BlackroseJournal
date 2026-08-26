import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useAuthActions } from '@/hooks/auth/useAuthActions';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="text-xs font-bold uppercase tracking-wider text-subtext-light dark:text-subtext-dark mb-2">
            {text}
        </Text>
    );
}

export default function LoginScreen() {
    const router = useRouter();
    const { user, isLoading } = useAuthSession();
    const { signIn } = useAuthActions();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isSignedIn = useMemo(() => Boolean(user?.email), [user?.email]);

    // signInWithEmail resolves before the auth coordinator applies its queued
    // transition, so navigating inline races the Stack.Protected guard (still
    // unauthenticated at that moment) and the redirect silently drops. Wait for
    // the authenticated snapshot to propagate, then navigate.
    useEffect(() => {
        if (!isSignedIn) return;
        router.replace('/(tabs)/settings');
    }, [isSignedIn, router]);

    const handleSignIn = useCallback(async () => {
        if (isSubmitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password) {
            setStatus({ type: 'error', message: 'Enter your email and password.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            await signIn(trimmedEmail, password);
            setStatus({ type: 'success', message: 'Signed in successfully.' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sign in failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [email, password, isSubmitting, router, signIn]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full px-6 pt-6">
                <Pressable onPress={() => router.back()} className="mb-4">
                    <Text className="text-sm text-primary font-semibold dark:text-primary">Back</Text>
                </Pressable>

                <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                    Welcome back
                </Text>
                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                    Sign in to sync your journal across devices. Sessions stay active until you sign out.
                </Text>

                {isLoading ? (
                    <AuthFormSkeleton fields={2} showForgotLink />
                ) : (
                <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mt-6">
                    {isSignedIn && !isLoading ? (
                        <View>
                            <Text className="text-text-light dark:text-text-dark font-semibold">
                                Signed in as {user?.email}
                            </Text>
                            <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                                You can close this screen and continue journaling.
                            </Text>
                            <Pressable
                                onPress={() => router.replace('/(tabs)/settings')}
                                className="mt-4 bg-primary rounded-xl py-3"
                            >
                                <Text className="text-white font-semibold text-center dark:text-white">Go to Settings</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View>
                            <FieldLabel text="Email" />
                            <TextInput
                                value={email}
                                onChangeText={setEmail}
                                placeholder="you@email.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="username"
                                accessibilityLabel="Email"
                                className="rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark"
                            />

                            <View className="mt-4">
                                <FieldLabel text="Password" />
                                <TextInput
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="••••••••"
                                    secureTextEntry
                                    autoCapitalize="none"
                                    textContentType="password"
                                    accessibilityLabel="Password"
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
                                onPress={handleSignIn}
                                disabled={isSubmitting}
                                accessibilityRole="button"
                                className={`mt-5 rounded-xl py-3 ${isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}
                            >
                                <Text className="text-white font-semibold text-center dark:text-white">
                                    {isSubmitting ? 'Signing in...' : 'Sign in'}
                                </Text>
                            </Pressable>

                            <Pressable
                                onPress={() => router.push('/forgot-password')}
                                className="mt-4"
                            >
                                <Text className="text-sm text-primary font-semibold text-center dark:text-primary">
                                    Forgot password?
                                </Text>
                            </Pressable>

                            <View className="mt-6 flex-row justify-center">
                                <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                                    New here?{' '}
                                </Text>
                                <Pressable onPress={() => router.push('/signup')}>
                                    <Text className="text-sm text-primary font-semibold dark:text-primary">Create account</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
                )}
            </View>
        </SafeAreaView>
    );
}
