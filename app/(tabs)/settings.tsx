import { BottomNav } from '@/components/journal';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { EmojiStylePreference, ThemePreference, useThemeSettings } from '@/hooks/useThemeSettings';
import { signOut } from '@/services/auth/authService';
import { clearAllEntries, getAllEntriesForExport } from '@/services/journalStorage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
    const router = useRouter();
    const { theme, setTheme, emojiStyle, setEmojiStyle } = useThemeSettings();
    const { user, isLoading: isAuthLoading } = useAuthSession();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const isEmailUser = useMemo(() => Boolean(user?.email), [user?.email]);

    const handleNewEntry = () => {
        router.push('/chat');
    };

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'settings') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    const handleExportData = async () => {
        try {
            const data = await getAllEntriesForExport();
            await Share.share({
                message: data,
                title: 'Journal Export'
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to export data');
            console.error(error);
        }
    };

    const handleClearData = () => {
        Alert.alert(
            "Clear All Data",
            "Are you sure you want to delete all journal entries? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await clearAllEntries();
                            Alert.alert("Success", "All journal entries have been deleted.");
                        } catch (error) {
                            Alert.alert("Error", "Failed to clear data.");
                            console.error(error);
                        }
                    }
                }
            ]
        );
    };

    const handleSignOut = async () => {
        if (isSigningOut) {
            return;
        }

        setIsSigningOut(true);
        try {
            await signOut();
            Alert.alert('Signed out', 'You have been signed out successfully.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to sign out.';
            Alert.alert('Error', message);
        } finally {
            setIsSigningOut(false);
        }
    };

    const ThemeOption = ({ label, value }: { label: string, value: ThemePreference }) => {
        const isActive = theme === value;
        return (
            <TouchableOpacity
                onPress={() => setTheme(value)}
                className={`flex-1 items-center justify-center py-3 rounded-xl border ${isActive
                    ? 'bg-primary border-transparent'
                    : 'bg-transparent border-divider-light dark:border-divider-dark'
                    }`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Select ${label} theme`}
            >
                <Text className={`font-semibold ${isActive
                    ? 'text-white'
                    : 'text-text-light dark:text-text-dark'
                    }`}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    const EmojiOption = ({ label, value }: { label: string, value: EmojiStylePreference }) => {
        const isActive = emojiStyle === value;
        return (
            <TouchableOpacity
                onPress={() => setEmojiStyle(value)}
                className={`flex-1 items-center justify-center py-3 rounded-xl border ${isActive
                    ? 'bg-primary border-transparent'
                    : 'bg-transparent border-divider-light dark:border-divider-dark'
                    }`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Select ${label} emoji style`}
            >
                <Text className={`font-semibold ${isActive
                    ? 'text-white'
                    : 'text-text-light dark:text-text-dark'
                    }`}>
                    {label}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full relative">
                <ScrollView className="flex-1 px-4 pt-6 pb-24">
                    <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark mb-8">
                        Settings
                    </Text>

                    {/* Appearance Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            Appearance
                        </Text>
                        <Text className="text-sm text-text-light dark:text-text-dark mb-2 font-medium">Theme</Text>
                        <View className="flex-row gap-3 mb-6">
                            <ThemeOption label="Light" value="light" />
                            <ThemeOption label="Dark" value="dark" />
                            <ThemeOption label="System" value="system" />
                        </View>

                        <Text className="text-sm text-text-light dark:text-text-dark mb-2 font-medium">Emoji Style</Text>
                        <View className="flex-row gap-3">
                            <EmojiOption label="Native" value="native" />
                            <EmojiOption label="Flat" value="flat" />
                            <EmojiOption label="3D" value="3d" />
                        </View>
                    </View>

                    {/* Data Management Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            Data Management
                        </Text>

                        <TouchableOpacity
                            onPress={handleExportData}
                            className="flex-row items-center justify-between py-3 border-b border-divider-light dark:border-divider-dark mb-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                                    <Ionicons name="share-outline" size={20} className="text-blue-600 dark:text-blue-400" color="#2563EB" />
                                </View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    Export Data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} className="text-subtext-light dark:text-subtext-dark" color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleClearData}
                            className="flex-row items-center justify-between py-3 mt-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">
                                    <Ionicons name="trash-outline" size={20} className="text-red-600 dark:text-red-400" color="#DC2626" />
                                </View>
                                <Text className="text-red-600 dark:text-red-400 font-medium text-base">
                                    Clear Data
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} className="text-subtext-light dark:text-subtext-dark" color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>

                    {/* Account Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            Account
                        </Text>

                        {isEmailUser ? (
                            <View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    Signed in as {user?.email}
                                </Text>
                                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                                    Sessions stay active until you sign out.
                                </Text>
                                <TouchableOpacity
                                    onPress={handleSignOut}
                                    disabled={isSigningOut}
                                    className={`mt-4 rounded-xl py-3 ${isSigningOut ? 'bg-primary/70' : 'bg-primary'}`}
                                >
                                    <Text className="text-white font-semibold text-center">
                                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    Sign in to sync your journal
                                </Text>
                                <Text className="text-sm text-subtext-light dark:text-subtext-dark mt-2">
                                    {isAuthLoading
                                        ? 'Checking session...'
                                        : 'Create an account to keep your journal safe across devices.'}
                                </Text>

                                <TouchableOpacity
                                    onPress={() => router.push('/login')}
                                    className="mt-4 rounded-xl py-3 bg-primary"
                                >
                                    <Text className="text-white font-semibold text-center">Sign in</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => router.push('/signup')}
                                    className="mt-3 rounded-xl py-3 border border-divider-light dark:border-divider-dark"
                                >
                                    <Text className="text-text-light dark:text-text-dark font-semibold text-center">
                                        Create account
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={() => router.push('/forgot-password')} className="mt-3">
                                    <Text className="text-sm text-primary font-semibold text-center">
                                        Forgot password?
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* About Section */}
                    <View className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-sm mb-6">
                        <Text className="text-sm font-bold text-subtext-light dark:text-subtext-dark uppercase tracking-wider mb-4">
                            About
                        </Text>

                        <TouchableOpacity
                            onPress={() => Alert.alert('About', 'Journal App v1.0.0\n\nYour personal AI-powered journaling companion for self-reflection and growth.')}
                            className="flex-row items-center justify-between py-3 border-b border-divider-light dark:border-divider-dark mb-2"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                                    <Ionicons name="information-circle-outline" size={20} color="#9333EA" />
                                </View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    About
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => Alert.alert('Privacy Policy', 'Your journal entries are stored locally on your device. We do not collect or share your personal data.')}
                            className="flex-row items-center justify-between py-3"
                        >
                            <View className="flex-row items-center gap-3">
                                <View className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                                    <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
                                </View>
                                <Text className="text-text-light dark:text-text-dark font-medium text-base">
                                    Privacy Policy
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                <BottomNav
                    activeTab="settings"
                    onTabPress={handleTabPress}
                    onFabPress={handleNewEntry}
                />
            </View>
        </SafeAreaView>
    );
}
