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
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
    const router = useRouter();
    const { isLoading } = useAuthSession();
    const { signUp } = useAuthActions();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const passwordInputRef = React.useRef<TextInput>(null);
    const confirmInputRef = React.useRef<TextInput>(null);

    const handleSignup = useCallback(async () => {
        if (isSubmitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password || !confirmPassword) {
            authHaptic('error');
            setStatus({ type: 'error', message: 'Fill out all fields.' });
            return;
        }

        if (password !== confirmPassword) {
            authHaptic('error');
            setStatus({ type: 'error', message: 'Passwords do not match.' });
            return;
        }

        if (password.length < 6) {
            authHaptic('error');
            setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            await signUp(trimmedEmail, password);
            authHaptic('success');
            setStatus({
                type: 'success',
                message: 'Account created. Check your email to verify, then sign in.',
            });
        } catch (error) {
            authHaptic('error');
            const message = error instanceof Error ? error.message : 'Sign up failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [email, password, confirmPassword, isSubmitting, signUp]);

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
                            title="Create account"
                            subtitle="Keep your journal synced and secure with an email and password."
                        />

                        {isLoading ? (
                            <AuthFormSkeleton fields={3} />
                        ) : (
                            <AuthCard>
                                <FieldLabel text="Email" />
                                <AuthInput
                                    label="Email"
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="you@email.com"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="emailAddress"
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
                                        placeholder="At least 6 characters"
                                        secureTextEntry
                                        showVisibilityToggle
                                        autoCapitalize="none"
                                        textContentType="newPassword"
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        onSubmitEditing={() => confirmInputRef.current?.focus()}
                                    />
                                </View>

                                <View className="mt-4">
                                    <FieldLabel text="Confirm password" />
                                    <AuthInput
                                        ref={confirmInputRef}
                                        label="Confirm password"
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        placeholder="••••••••"
                                        secureTextEntry
                                        showVisibilityToggle
                                        autoCapitalize="none"
                                        textContentType="newPassword"
                                        returnKeyType="go"
                                        onSubmitEditing={() => void handleSignup()}
                                    />
                                </View>

                                {status && <StatusBanner type={status.type} message={status.message} />}

                                <PrimaryButton
                                    label="Create account"
                                    loadingLabel="Creating account…"
                                    isLoading={isSubmitting}
                                    onPress={() => void handleSignup()}
                                />

                                <RoseRuleDivider />

                                <View className="mt-4 flex-row items-center justify-center">
                                    <Text className="text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                                        Already have an account?{' '}
                                    </Text>
                                    <TextLink
                                        label="Sign in"
                                        onPress={() => router.replace('/login')}
                                    />
                                </View>
                            </AuthCard>
                        )}

                        <AuthWordmark />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
