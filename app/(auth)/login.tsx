import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useAuthActions } from '@/hooks/auth/useAuthActions';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import {
    AuthInput,
    FieldLabel,
    PrimaryButton,
    StatusBanner,
    TextLink,
    authHaptic,
} from '@/components/auth/AuthPrimitives';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const router = useRouter();
    const { user, isLoading } = useAuthSession();
    const { signIn } = useAuthActions();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const passwordInputRef = React.useRef<null | any>(null);

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
            authHaptic('error');
            setStatus({ type: 'error', message: 'Enter your email and password.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            await signIn(trimmedEmail, password);
            authHaptic('success');
            setStatus({ type: 'success', message: 'Signed in successfully.' });
        } catch (error) {
            authHaptic('error');
            const message = error instanceof Error ? error.message : 'Sign in failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [email, password, isSubmitting, router, signIn]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    contentContainerClassName="flex-grow justify-center"
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View className="max-w-md mx-auto w-full px-6 py-8">
                        <Pressable
                            onPress={() => router.back()}
                            accessibilityRole="button"
                            accessibilityLabel="Go back"
                            className="-ml-2 self-start"
                        >
                            {({ pressed }) => (
                                <Text className={`text-sm text-primary font-semibold dark:text-primary px-2 py-2 ${pressed ? 'underline' : ''}`}>
                                    ← Back
                                </Text>
                            )}
                        </Pressable>

                        <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark mt-2">
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
                                        accessibilityRole="button"
                                        className="mt-4 bg-primary rounded-xl py-3.5 min-h-[48px] items-center justify-center active:opacity-80"
                                    >
                                        <Text className="text-white font-semibold text-center dark:text-white">Go to Settings</Text>
                                    </Pressable>
                                </View>
                            ) : (
                                <View>
                                    <FieldLabel text="Email" />
                                    <AuthInput
                                        label="Email"
                                        value={email}
                                        onChangeText={setEmail}
                                        placeholder="you@email.com"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        textContentType="username"
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                                    />

                                    <View className="mt-4">
                                        <FieldLabel text="Password" />
                                        <AuthInput
                                            ref={passwordInputRef}
                                            label="Password"
                                            value={password}
                                            onChangeText={setPassword}
                                            placeholder="••••••••"
                                            secureTextEntry
                                            showVisibilityToggle
                                            autoCapitalize="none"
                                            textContentType="password"
                                            returnKeyType="go"
                                            onSubmitEditing={() => void handleSignIn()}
                                        />
                                    </View>

                                    {status && <StatusBanner type={status.type} message={status.message} />}

                                    <PrimaryButton
                                        label="Sign in"
                                        loadingLabel="Signing in..."
                                        isLoading={isSubmitting}
                                        onPress={() => void handleSignIn()}
                                    />

                                    <View className="mt-2 items-center">
                                        <TextLink
                                            label="Forgot password?"
                                            onPress={() => router.push('/forgot-password')}
                                        />
                                    </View>

                                    <View className="mt-4 flex-row justify-center items-center">
                                        <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                                            New here?{' '}
                                        </Text>
                                        <TextLink
                                            label="Create account"
                                            onPress={() => router.push('/signup')}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
