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
import {
    AuthBackLink,
    AuthCard,
    AuthHeading,
    AuthWordmark,
    RoseRuleDivider,
} from '@/components/auth/AuthScaffold';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
    const router = useRouter();
    const { user, isLoading } = useAuthSession();
    const { signIn } = useAuthActions();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const passwordInputRef = React.useRef<TextInput>(null);

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
    }, [email, password, isSubmitting, signIn]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView
                    contentContainerClassName="flex-grow"
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View className="w-full max-w-md mx-auto px-6 pt-2">
                        <AuthBackLink onPress={() => router.back()} />
                        <AuthHeading
                            title="Welcome back"
                            subtitle="Sign in to sync your journal across devices."
                        />

                        {isLoading ? (
                            <AuthFormSkeleton fields={2} showForgotLink />
                        ) : (
                            <AuthCard>
                                {isSignedIn ? (
                                    <View className="gap-3">
                                        <Text className="text-[16px] text-text-light dark:text-text-dark">
                                            Signed in as {user?.email}
                                        </Text>
                                        <Text className="text-[14px] text-text-secondary-light dark:text-text-secondary-dark">
                                            You can close this screen and continue journaling.
                                        </Text>
                                        <PrimaryButton
                                            label="Go to Settings"
                                            loadingLabel="Opening…"
                                            isLoading={false}
                                            onPress={() => router.replace('/(tabs)/settings')}
                                        />
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
                                            loadingLabel="Signing in…"
                                            isLoading={isSubmitting}
                                            onPress={() => void handleSignIn()}
                                        />

                                        <View className="mt-1 items-center">
                                            <TextLink
                                                label="Forgot password?"
                                                onPress={() => router.push('/forgot-password')}
                                            />
                                        </View>

                                        <RoseRuleDivider />

                                        <View className="mt-4 flex-row items-center justify-center">
                                            <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                                New here?{' '}
                                            </Text>
                                            <TextLink
                                                label="Create account"
                                                onPress={() => router.push('/signup')}
                                            />
                                        </View>
                                    </View>
                                )}
                            </AuthCard>
                        )}

                        <AuthWordmark />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
