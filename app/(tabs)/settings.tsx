import React, { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
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
    ReminderSettingsSection,
    IdentitySettingsSection,
    MemorySettingsSection,
    SettingsAccordionSection,
    aboutSummary,
    accountSummary,
    appearanceSummary,
    colorThemeSummary,
    customAiSummary,
    dataManagementSummary,
    generationSummary,
    identitySettingsSummary,
    memorySummary,
} from '@/components/settings';
import { useIdentityProfile } from '@/hooks/memory/useIdentityProfile';
import { useReminders } from '@/hooks/settings/useReminders';
import { describeReminderSchedule } from '@/utils/reminders';
import { useLocalMemories } from '@/hooks/memory/useLocalMemories';
import { useCustomAiModels } from '@/hooks/settings/useCustomAiModels';
import { useGenerationSettings } from '@/hooks/settings/useGenerationSettings';
import { useTabNavigation } from '@/hooks/navigation/useTabNavigation';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useJournalExport } from '@/hooks/journal/useJournalExport';
import { useDataManagementActions } from '@/hooks/settings/useDataManagementActions';
import { notifyUser } from '@/components/ui/webConfirm';
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
    const {
        latestBackup,
        isBusy,
        isClearingHistory,
        handleCreateBackup,
        handleRestoreLatestBackup,
        handleClearHistory,
    } = useDataManagementActions();
    const memory = useLocalMemories();
    const identity = useIdentityProfile();
    const customAi = useCustomAiModels();
    const generation = useGenerationSettings();
    const { goToTab } = useTabNavigation();
    const { exportAsJson, shareJson } = useJournalExport();
    const {
        seed: seedDemoData,
        seedBulk: seedBulkProbe,
        isSeeding,
        seedProgress,
    } = useSeedDemoData();
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

    const reminders = useReminders();
    const reminderSummary = describeReminderSchedule(reminders.settings);

    const summaries = useMemo(() => ({
        appearance: appearanceSummary(theme, emojiStyle),
        color: colorThemeSummary(colorTheme),
        generation: generationSummary(generation.settings),
        reminders: reminderSummary,
        customAi: customAiSummary(customAi.settings),
        data: dataManagementSummary(Boolean(latestBackup)),
        identity: identitySettingsSummary(identity.profile),
        memory: memorySummary(memory.atoms.length),
        account: accountSummary(),
        about: aboutSummary(),
    }), [
        theme,
        emojiStyle,
        colorTheme,
        generation.settings,
        customAi.settings,
        latestBackup,
        identity.profile,
        memory.atoms.length,
    ]);

    const handleTabPress = (tab: 'today' | 'explore' | 'entries' | 'settings' | 'insights') => {
        if (tab !== 'settings') {
            goToTab(tab);
        }
    };

    const handleExportJournalJson = async () => {
        try {
            const data = await exportAsJson();
            const day = new Date().toISOString().slice(0, 10);
            await shareJson(data, `blackrose-journal-${day}.json`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to export data.';
            notifyUser('Couldn’t save a copy', message);
        }
    };

    /** Web: window.confirm (Playwright-friendly); native: Alert. */
    const confirmDevAction = (title: string, message: string, run: () => void) => {
        if (!isDemoSeedEnabled()) return;
        if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
            if (window.confirm(message)) run();
            return;
        }
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK', onPress: run },
        ]);
    };

    const handleSeedDemoData = () => {
        confirmDevAction(
            'Add sample data',
            'Dev only. Adds sample journal entries, check-ins, goals and memories. Replaces the previous sample.',
            () => {
                void (async () => {
                    try {
                        await seedDemoData();
                        await markDemoDataSeeded();
                        goToTab('entries');
                        // notifyUser, not Alert.alert: Alert is a no-op on web, and a
                        // silent finish is what made the seed look frozen (DEF-013).
                        notifyUser('Demo data added', 'Sample content ready to explore.');
                    } catch {
                        notifyUser('Adding sample data failed', 'Couldn’t add sample data.');
                    }
                })();
            },
        );
    };

    const handleSeedBulkProbe = () => {
        confirmDevAction(
            'Add 365 test entries',
            'Dev only. Adds about 365 journal entries and daily summaries (tracked, clearable). Replaces the previous sample.',
            () => {
                void (async () => {
                    try {
                        const n = await seedBulkProbe(365);
                        await markDemoDataSeeded();
                        goToTab('entries');
                        notifyUser('Test entries added', `${n} entries and daily summaries.`);
                    } catch {
                        notifyUser('Adding test entries failed', 'Couldn’t add test entries.');
                    }
                })();
            },
        );
    };

    const handleClearDemoData = () => {
        confirmDevAction(
            'Remove sample data',
            'Remove only the sample entries? Your real entries stay.',
            () => {
                void (async () => {
                    try {
                        await clearDemoData();
                        goToTab('entries');
                        notifyUser('Demo cleared', 'Sample entries removed; your real data is intact.');
                    } catch {
                        notifyUser('Clear failed', 'Couldn’t remove sample data.');
                    }
                })();
            },
        );
    };

    return (
        <ScreenContainer edges="top" className="relative">
            <ScrollView
                    className="flex-1"
                    contentContainerStyle={{
                        paddingBottom: navAwareBottomPadding(insets.bottom),
                    }}
                    showsVerticalScrollIndicator={false}
                >
                {/* Bands run edge to edge, so the gutter lives on the header and
                    on each section's own padding — not on the ScrollView. */}
                <View className="px-6 pt-6 pb-5">
                    <Text
                        className="text-[40px] leading-tight text-text-light dark:text-text-dark"
                        style={{ fontFamily: 'PlayfairDisplayRegular' }}
                    >
                        Settings
                    </Text>
                    <Text className="mt-1 text-[15px] text-text-secondary-light dark:text-text-secondary-dark">
                        Theme, AI, data & account
                    </Text>
                </View>

                <SettingsAccordionSection
                    id="appearance"
                    title="Appearance"
                    hint="Theme and emoji treatment"
                    summary={summaries.appearance}
                    icon="brightness-6"
                    index={0}
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
                    index={1}
                    title="Color Studio"
                    hint="Palette and custom colors"
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
                    index={2}
                    title="Writing style"
                    hint="How replies feel"
                    summary={summaries.generation}
                    icon="tune"
                    expanded={expandedIds.has('generation')}
                    onToggle={toggleSection}
                >
                    <GenerationSettingsSection {...generation} embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="customAi"
                    index={3}
                    title="AI"
                    hint="Connect your own AI"
                    summary={summaries.customAi}
                    icon="smart-toy"
                    expanded={expandedIds.has('customAi')}
                    onToggle={toggleSection}
                >
                    <CustomModelSettingsSection {...customAi} embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="reminders"
                    index={2}
                    title="Reminders"
                    hint="Gentle nudges to write"
                    summary={reminderSummary}
                    icon="notifications-none"
                    expanded={expandedIds.has('reminders')}
                    onToggle={toggleSection}
                >
                    <ReminderSettingsSection />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="data"
                    index={4}
                    title="Your data"
                    hint="Everything stays on device"
                    summary={summaries.data}
                    icon="folder"
                    expanded={expandedIds.has('data')}
                    onToggle={toggleSection}
                >
                    <DataManagementSection
                        latestBackup={latestBackup}
                        isBusy={isBusy}
                        isClearingHistory={isClearingHistory}
                        onCreateBackup={handleCreateBackup}
                        onRestoreLatestBackup={handleRestoreLatestBackup}
                        onExportJournalJson={handleExportJournalJson}
                        showDemoSeedControls={isDemoSeedEnabled()}
                        onSeedDemoData={handleSeedDemoData}
                        onSeedBulkProbe={handleSeedBulkProbe}
                        onClearDemoData={handleClearDemoData}
                        seedProgress={seedProgress}
                        isSeeding={isSeeding}
                        onClearHistory={handleClearHistory}
                        onLettersPress={() => router.push('/letters')}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="identity"
                    index={5}
                    title="Identity"
                    hint="What Blackrose always remembers"
                    summary={summaries.identity}
                    icon="badge"
                    expanded={expandedIds.has('identity')}
                    onToggle={toggleSection}
                >
                    <IdentitySettingsSection
                        scalarRows={identity.scalarRows}
                        pendingRows={identity.pendingRows}
                        collectionRows={identity.collectionRows}
                        isBusy={identity.isLoading || identity.isMutating}
                        onConfirmPending={identity.confirmPending}
                        onDismissPending={identity.dismissPending}
                        embedded
                    />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="memory"
                    index={6}
                    title="Memory"
                    hint="What Blackrose remembers"
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
                    index={7}
                    title="Account"
                    hint="Stored on this device"
                    summary={summaries.account}
                    icon="person"
                    expanded={expandedIds.has('account')}
                    onToggle={toggleSection}
                >
                    <AccountSettingsSection embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="about"
                    index={8}
                    title="About"
                    hint="Version and privacy"
                    summary={summaries.about}
                    icon="info"
                    expanded={expandedIds.has('about')}
                    onToggle={toggleSection}
                >
                    <AboutSettingsSection
                        onAboutPress={() => notifyUser('About', APP_ABOUT_COPY)}
                        onPrivacyPress={() => notifyUser('Privacy Policy', APP_PRIVACY_COPY)}
                        onCrashLogsPress={() => router.push('/crash-logs')}
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
