import React, { useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BottomNav } from '@/components/journal';
import {
    AboutSettingsSection,
    AccountSettingsSection,
    AppearanceSettingsSection,
    DataManagementSection,
} from '@/components/settings';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useLocalBackups } from '@/hooks/backup/useLocalBackups';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { signOut } from '@/services/auth/authService';
import { clearAllEntries, getAllEntriesForExport } from '@/services/journalStorage';

export default function SettingsScreen() {
    const router = useRouter();
    const { theme, setTheme, emojiStyle, setEmojiStyle } = useThemeSettings();
    const { user, isLoading: isAuthLoading } = useAuthSession();
    const { latestBackup, isBusy, createBackup, restoreBackup } = useLocalBackups();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'settings') {
            router.push(`/(tabs)/${tab}`);
        }
    };

    const handleExportJournalJson = async () => {
        try {
            const data = await getAllEntriesForExport();
            await Share.share({ message: data, title: 'Journal Export' });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export data.';
            Alert.alert('Error', message);
        }
    };

    const handleCreateBackup = async () => {
        try {
            const backup = await createBackup();
            Alert.alert('Backup created', `${backup.itemCount} local data groups saved on this device.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create backup.';
            Alert.alert('Error', message);
        }
    };

    const restoreLatestBackup = async () => {
        if (!latestBackup) {
            return;
        }

        try {
            const result = await restoreBackup(latestBackup.id);
            if (result.status === 'missing') {
                Alert.alert('Backup missing', 'The selected local backup could not be found.');
                return;
            }
            Alert.alert('Backup restored', `${result.restoredKeys} local data groups restored.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to restore backup.';
            Alert.alert('Error', message);
        }
    };

    const handleRestoreLatestBackup = () => {
        if (!latestBackup) {
            Alert.alert('No backup', 'Create a local backup before restoring.');
            return;
        }

        Alert.alert(
            'Restore local backup',
            `Restore "${latestBackup.name}"? Current local app data will be replaced.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restore', style: 'destructive', onPress: restoreLatestBackup },
            ]
        );
    };

    const handleClearJournalEntries = () => {
        Alert.alert(
            'Clear Journal Entries',
            'Delete all journal entries from this device? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearAllEntries();
                            Alert.alert('Success', 'All journal entries have been deleted.');
                        } catch (error) {
                            const message = error instanceof Error
                                ? error.message
                                : 'Failed to clear journal entries.';
                            Alert.alert('Error', message);
                        }
                    },
                },
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

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full relative">
                <ScrollView className="flex-1 px-4 pt-6 pb-24">
                    <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark mb-8">
                        Settings
                    </Text>

                    <AppearanceSettingsSection
                        theme={theme}
                        emojiStyle={emojiStyle}
                        onThemeChange={setTheme}
                        onEmojiStyleChange={setEmojiStyle}
                    />
                    <DataManagementSection
                        latestBackup={latestBackup}
                        isBusy={isBusy}
                        onCreateBackup={handleCreateBackup}
                        onRestoreLatestBackup={handleRestoreLatestBackup}
                        onExportJournalJson={handleExportJournalJson}
                        onClearJournalEntries={handleClearJournalEntries}
                    />
                    <AccountSettingsSection
                        email={user?.email ?? null}
                        isAuthLoading={isAuthLoading}
                        isSigningOut={isSigningOut}
                        onSignOut={handleSignOut}
                        onSignIn={() => router.push('/login')}
                        onCreateAccount={() => router.push('/signup')}
                        onForgotPassword={() => router.push('/forgot-password')}
                    />
                    <AboutSettingsSection
                        onAboutPress={() => Alert.alert(
                            'About',
                            'Journal App v1.0.0\n\nYour personal AI-powered journaling companion.'
                        )}
                        onPrivacyPress={() => Alert.alert(
                            'Privacy Policy',
                            'Core journal data is stored locally on your device by default.'
                        )}
                    />
                </ScrollView>

                <BottomNav
                    activeTab="settings"
                    onTabPress={handleTabPress}
                    onFabPress={() => router.push('/chat')}
                />
            </View>
        </SafeAreaView>
    );
}
