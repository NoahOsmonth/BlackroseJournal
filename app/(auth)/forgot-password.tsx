import { useAuthActions } from '@/hooks/auth/useAuthActions';
import { AuthFormSkeleton } from '@/components/auth/AuthFormSkeleton';
import {
    AuthInput,
    FieldLabel,
    PrimaryButton,
    StatusBanner,
    TextLink,
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
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { isLoading } = useAuthSession();
    const { sendPasswordReset } = useAuthActions();
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleReset = useCallback(async () => {
        if (isSubmitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setStatus({ type: 'error', message: 'Enter the email tied to your account.' });
            return;
        }

        setIsSubmitting(true);
        setStatus(null);

        try {
            await sendPasswordReset(trimmedEmail);
            setStatus({
                type: 'success',
                message: 'Password reset email sent. Check your inbox to continue.',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Reset failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [email, isSubmitting, sendPasswordReset]);

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
                            title="Reset password"
                            subtitle="We will email you a secure link to reset your password."
                        />

                        {isLoading ? (
                            <AuthFormSkeleton fields={1} />
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
                                    returnKeyType="go"
                                    onSubmitEditing={() => void handleReset()}
                                />

                                {status && <StatusBanner type={status.type} message={status.message} />}

                                <PrimaryButton
                                    label="Send reset email"
                                    loadingLabel="Sending…"
                                    isLoading={isSubmitting}
                                    onPress={() => void handleReset()}
                                />

                                <RoseRuleDivider />

                                <View className="mt-1 items-center">
                                    <TextLink
                                        label="Back to sign in"
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
