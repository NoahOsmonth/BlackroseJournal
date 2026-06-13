import React, { useState } from 'react';
import { Alert, ScrollView, Share, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BottomNav } from '@/components/journal';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { APP_ABOUT_COPY, APP_PRIVACY_COPY } from '@/constants/appInfo';
import { navAwareBottomPadding } from '@/constants/spacing';
import {
    AboutSettingsSection,
    AccountSettingsSection,
    AppearanceSettingsSection,
    ColorThemeSettingsSection,
    CustomModelSettingsSection,
    DataManagementSection,
    GenerationSettingsSection,
    MemorySettingsSection,
} from '@/components/settings';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useLocalBackups } from '@/hooks/backup/useLocalBackups';
import { useLocalMemories } from '@/hooks/memory/useLocalMemories';
import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useGenerationSettings } from '@/hooks/settings/useGenerationSettings';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { signOut } from '@/services/auth/authService';
import { useClearJournalHistory } from '@/hooks/journal/useClearJournalHistory';
import { useJournalExport } from '@/hooks/journal/useJournalExport';

export default function SettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const {
        theme,
        setTheme,
        emojiStyle,
        setEmojiStyle,
        colorTheme,
        setColorThemePreset,
        applyColorThemeEdit,
        resetColorTheme,
    } = useThemeSettings();
    const { user, isLoading: isAuthLoading } = useAuthSession();
    const { latestBackup, isBusy, createBackup, restoreBackup } = useLocalBackups();
    const memory = useLocalMemories();
    const customAi = useCustomAiModels();
    const generation = useGenerationSettings();
    const { goToTab } = useTabNavigation();
    const { exportAsJson } = useJournalExport();
    const { clearAll: clearJournalHistory, isClearing: isClearingJournalHistory } = useClearJournalHistory();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'settings') {
            goToTab(tab);
        }
    };

    const handleExportJournalJson = async () => {
        try {
            const data = await exportAsJson();
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

    const handleClearHistory = () => {
        Alert.alert(
            'Clear History & Memories',
            'Delete all journal entries, intention check-ins, chat sessions, insights, and saved AI memories from this device? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await clearJournalHistory();
                            Alert.alert('Success', 'All history and related memories have been deleted.');
                        } catch (error) {
                            const message = error instanceof Error
                                ? error.message
                                : 'Failed to clear history and memories.';
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
        <ScreenContainer edges="top" className="relative">
                <ScrollView
                    className="flex-1 px-4 pt-6"
                    contentContainerStyle={{ paddingBottom: navAwareBottomPadding(insets.bottom) }}
                >
                    <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark mb-8">
                        Settings
                    </Text>

                    <AppearanceSettingsSection
                        theme={theme}
                        emojiStyle={emojiStyle}
                        onThemeChange={setTheme}
                        onEmojiStyleChange={setEmojiStyle}
                    />
                    <ColorThemeSettingsSection
                        colorTheme={colorTheme}
                        onPresetChange={setColorThemePreset}
                        onPickerConfirm={applyColorThemeEdit}
                        onReset={resetColorTheme}
                    />
                    <GenerationSettingsSection {...generation} />
                    <CustomModelSettingsSection {...customAi} />
                    <DataManagementSection
                        latestBackup={latestBackup}
                        isBusy={isBusy}
                        isClearingHistory={isClearingJournalHistory}
                        onCreateBackup={handleCreateBackup}
                        onRestoreLatestBackup={handleRestoreLatestBackup}
                        onExportJournalJson={handleExportJournalJson}
                        onClearHistory={handleClearHistory}
                    />
                    <MemorySettingsSection
                        atoms={memory.atoms}
                        isBusy={memory.isLoading}
                        onOpenMemoryHub={() => goToTab('explore')}
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
                            APP_ABOUT_COPY
                        )}
                        onPrivacyPress={() => Alert.alert(
                            'Privacy Policy',
                            APP_PRIVACY_COPY
                        )}
                    />
                </ScrollView>

                <BottomNav
                    activeTab="settings"
                    onTabPress={handleTabPress}
                    onFabPress={() => router.push('/chat')}
                />
        </ScreenContainer>
    );
}
