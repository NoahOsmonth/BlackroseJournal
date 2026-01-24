import { sendPasswordResetEmail } from '@/services/auth/authService';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function FieldLabel({ text }: { text: string }) {
    return (
        <Text className="text-xs font-bold uppercase tracking-wider text-subtext-light dark:text-subtext-dark mb-2">
            {text}
        </Text>
    );
}

export default function ForgotPasswordScreen() {
    const router = useRouter();
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
            await sendPasswordResetEmail(trimmedEmail);
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
    }, [email, isSubmitting]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full px-6 pt-6">
                <Pressable onPress={() => router.back()} className="mb-4">
                    <Text className="text-sm text-primary font-semibold">Back</Text>
                </Pressable>

                <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                    Reset password
                </Text>
                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                    We will email you a secure link to reset your password.
                </Text>

                <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mt-6">
                    <FieldLabel text="Email" />
                    <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@email.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType="emailAddress"
                        className="rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark"
                    />

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
                        onPress={handleReset}
                        disabled={isSubmitting}
                        className={`mt-5 rounded-xl py-3 ${isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}
                    >
                        <Text className="text-white font-semibold text-center">
                            {isSubmitting ? 'Sending...' : 'Send reset email'}
                        </Text>
                    </Pressable>

                    <Pressable onPress={() => router.replace('/login')} className="mt-6">
                        <Text className="text-sm text-primary font-semibold text-center">
                            Back to sign in
                        </Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}
