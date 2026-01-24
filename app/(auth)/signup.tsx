import { signUpWithEmail } from '@/services/auth/authService';
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

export default function SignupScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSignup = useCallback(async () => {
        if (isSubmitting) return;

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !password || !confirmPassword) {
            setStatus({ type: 'error', message: 'Fill out all fields.' });
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
            await signUpWithEmail(trimmedEmail, password);
            setStatus({
                type: 'success',
                message: 'Account created. Check your email to verify, then sign in.',
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Sign up failed.';
            setStatus({ type: 'error', message });
        } finally {
            setIsSubmitting(false);
        }
    }, [email, password, confirmPassword, isSubmitting]);

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full px-6 pt-6">
                <Pressable onPress={() => router.back()} className="mb-4">
                    <Text className="text-sm text-primary font-semibold">Back</Text>
                </Pressable>

                <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                    Create account
                </Text>
                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                    Use an email and password to keep your journal synced and secure.
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

                    <View className="mt-4">
                        <FieldLabel text="Password" />
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="••••••••"
                            secureTextEntry
                            autoCapitalize="none"
                            textContentType="newPassword"
                            className="rounded-xl border border-divider-light dark:border-divider-dark bg-background-light dark:bg-background-dark px-4 py-3 text-text-light dark:text-text-dark"
                        />
                    </View>

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
                        onPress={handleSignup}
                        disabled={isSubmitting}
                        className={`mt-5 rounded-xl py-3 ${isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}
                    >
                        <Text className="text-white font-semibold text-center">
                            {isSubmitting ? 'Creating account...' : 'Create account'}
                        </Text>
                    </Pressable>

                    <View className="mt-6 flex-row justify-center">
                        <Text className="text-sm text-subtext-light dark:text-subtext-dark">
                            Already have an account?{' '}
                        </Text>
                        <Pressable onPress={() => router.replace('/login')}>
                            <Text className="text-sm text-primary font-semibold">Sign in</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
