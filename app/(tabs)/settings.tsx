import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
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
    SettingsAccordionSection,
    aboutSummary,
    accountSummary,
    appearanceSummary,
    colorThemeSummary,
    customAiSummary,
    dataManagementSummary,
    generationSummary,
    memorySummary,
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
import { useSeedDemoData } from '@/hooks/seed/useSeedDemoData';
import {
    clearDemoData,
    isDemoSeedEnabled,
    markDemoDataSeeded,
} from '@/services/seed/seedDemoData';

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
    const { seed: seedDemoData } = useSeedDemoData();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());

    const toggleSection = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const summaries = useMemo(() => ({
        appearance: appearanceSummary(theme, emojiStyle),
        color: colorThemeSummary(colorTheme),
        generation: generationSummary(generation.settings),
        customAi: customAiSummary(customAi.settings),
        data: dataManagementSummary(Boolean(latestBackup)),
        memory: memorySummary(memory.atoms.length),
        account: accountSummary(user?.email ?? null),
        about: aboutSummary(),
    }), [
        theme,
        emojiStyle,
        colorTheme,
        generation.settings,
        customAi.settings,
        latestBackup,
        memory.atoms.length,
        user?.email,
    ]);

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

    const runSeedDemoData = async () => {
        try {
            await seedDemoData();
            await markDemoDataSeeded();
            goToTab('history');
            Alert.alert('Demo data added', 'Sample content ready to explore.');
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to seed demo data.';
            Alert.alert('Error', message);
        }
    };

    const handleSeedDemoData = () => {
        if (!isDemoSeedEnabled()) return;
        // Web: window.confirm is reliable under Playwright; native keeps Alert.
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            const ok = window.confirm(
                'Dev only. Add sample journals/intentions/goals/memories? Replaces a prior seed only — real rows stay.',
            );
            if (ok) void runSeedDemoData();
            return;
        }
        Alert.alert(
            'Seed Demo Data',
            'Dev only. Adds sample journals/intentions/goals/memories. Replaces a prior seed only — real user rows are kept.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Seed', onPress: () => { void runSeedDemoData(); } },
            ]
        );
    };

    const runClearDemoData = async () => {
        try {
            await clearDemoData();
            goToTab('history');
            Alert.alert('Demo cleared', 'Seed rows removed; your real data is intact.');
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Failed to clear demo data.';
            Alert.alert('Error', message);
        }
    };

    const handleClearDemoData = () => {
        if (!isDemoSeedEnabled()) return;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            const ok = window.confirm(
                'Remove only tracked seed IDs? Real entries stay.',
            );
            if (ok) void runClearDemoData();
            return;
        }
        Alert.alert(
            'Clear demo data',
            'Remove only tracked seed IDs (journals, intentions, check-ins, goals, memory atoms, day digests)? Real entries stay.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear demo',
                    style: 'destructive',
                    onPress: () => { void runClearDemoData(); },
                },
            ]
        );
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
                showsVerticalScrollIndicator={false}
            >
                <View className="mb-6">
                    <Text className="text-3xl font-serif font-bold text-text-light dark:text-text-dark">
                        Settings
                    </Text>
                    <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                        Theme, AI, data & account
                    </Text>
                </View>

                <SettingsAccordionSection
                    id="appearance"
                    title="Appearance"
                    summary={summaries.appearance}
                    icon="brightness-6"
                    expanded={expandedIds.has('appearance')}
                    onToggle={toggleSection}
                >
                    <AppearanceSettingsSection
                        theme={theme}
                        emojiStyle={emojiStyle}
                        onThemeChange={setTheme}
                        onEmojiStyleChange={setEmojiStyle}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="color"
                    title="Color Studio"
                    summary={summaries.color}
                    icon="palette"
                    expanded={expandedIds.has('color')}
                    onToggle={toggleSection}
                >
                    <ColorThemeSettingsSection
                        colorTheme={colorTheme}
                        onPresetChange={setColorThemePreset}
                        onPickerConfirm={applyColorThemeEdit}
                        onReset={resetColorTheme}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="generation"
                    title="Generation"
                    summary={summaries.generation}
                    icon="tune"
                    expanded={expandedIds.has('generation')}
                    onToggle={toggleSection}
                >
                    <GenerationSettingsSection {...generation} embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="customAi"
                    title="AI Model"
                    summary={summaries.customAi}
                    icon="smart-toy"
                    expanded={expandedIds.has('customAi')}
                    onToggle={toggleSection}
                >
                    <CustomModelSettingsSection {...customAi} embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="data"
                    title="Data Management"
                    summary={summaries.data}
                    icon="folder"
                    expanded={expandedIds.has('data')}
                    onToggle={toggleSection}
                >
                    <DataManagementSection
                        latestBackup={latestBackup}
                        isBusy={isBusy}
                        isClearingHistory={isClearingJournalHistory}
                        onCreateBackup={handleCreateBackup}
                        onRestoreLatestBackup={handleRestoreLatestBackup}
                        onExportJournalJson={handleExportJournalJson}
                        showDemoSeedControls={isDemoSeedEnabled()}
                        onSeedDemoData={handleSeedDemoData}
                        onClearDemoData={handleClearDemoData}
                        onClearHistory={handleClearHistory}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="memory"
                    title="Memory"
                    summary={summaries.memory}
                    icon="auto-awesome"
                    expanded={expandedIds.has('memory')}
                    onToggle={toggleSection}
                >
                    <MemorySettingsSection
                        atoms={memory.atoms}
                        isBusy={memory.isLoading}
                        onOpenMemoryHub={() => goToTab('explore')}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="account"
                    title="Account"
                    summary={summaries.account}
                    icon="person"
                    expanded={expandedIds.has('account')}
                    onToggle={toggleSection}
                >
                    <AccountSettingsSection
                        email={user?.email ?? null}
                        isAuthLoading={isAuthLoading}
                        isSigningOut={isSigningOut}
                        onSignOut={handleSignOut}
                        onSignIn={() => router.push('/login')}
                        onCreateAccount={() => router.push('/signup')}
                        onForgotPassword={() => router.push('/forgot-password')}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="about"
                    title="About"
                    summary={summaries.about}
                    icon="info"
                    expanded={expandedIds.has('about')}
                    onToggle={toggleSection}
                >
                    <AboutSettingsSection
                        onAboutPress={() => Alert.alert('About', APP_ABOUT_COPY)}
                        onPrivacyPress={() => Alert.alert('Privacy Policy', APP_PRIVACY_COPY)}
                        embedded
                    />
                </SettingsAccordionSection>
            </ScrollView>

            <BottomNav
                activeTab="settings"
                onTabPress={handleTabPress}
                onFabPress={() => router.push('/chat')}
            />
        </ScreenContainer>
    );
}
