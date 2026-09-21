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

    const summaries = useMemo(() => ({
        appearance: appearanceSummary(theme, emojiStyle),
        color: colorThemeSummary(colorTheme),
        generation: generationSummary(generation.settings),
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
            notifyUser('Export failed', message);
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
            'Seed Demo Data',
            'Dev only. Sample journals/intentions/goals/memories. Replaces prior seed only.',
            () => {
                void (async () => {
                    try {
                        await seedDemoData();
                        await markDemoDataSeeded();
                        goToTab('entries');
                        // notifyUser, not Alert.alert: Alert is a no-op on web, and a
                        // silent finish is what made the seed look frozen (DEF-013).
                        notifyUser('Demo data added', 'Sample content ready to explore.');
                    } catch (error) {
                        notifyUser('Seed failed', error instanceof Error ? error.message : 'Seed failed.');
                    }
                })();
            },
        );
    };

    const handleSeedBulkProbe = () => {
        confirmDevAction(
            'Seed 365 probe entries',
            'Dev only. ~365 journals + digests (tracked, clearable). Replaces prior seed only.',
            () => {
                void (async () => {
                    try {
                        const n = await seedBulkProbe(365);
                        await markDemoDataSeeded();
                        goToTab('entries');
                        notifyUser('Bulk probe seeded', `${n} entries + digests.`);
                    } catch (error) {
                        notifyUser('Bulk seed failed', error instanceof Error ? error.message : 'Bulk seed failed.');
                    }
                })();
            },
        );
    };

    const handleClearDemoData = () => {
        confirmDevAction(
            'Clear demo data',
            'Remove only tracked seed IDs? Real entries stay.',
            () => {
                void (async () => {
                    try {
                        await clearDemoData();
                        goToTab('entries');
                        notifyUser('Demo cleared', 'Seed rows removed; your real data is intact.');
                    } catch (error) {
                        notifyUser('Clear failed', error instanceof Error ? error.message : 'Clear failed.');
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
                    hint="Palette and per-slot colors"
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
                    title="Generation"
                    hint="Reply length and warmth"
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
                    title="AI Model"
                    hint="Bring your own provider"
                    summary={summaries.customAi}
                    icon="smart-toy"
                    expanded={expandedIds.has('customAi')}
                    onToggle={toggleSection}
                >
                    <CustomModelSettingsSection {...customAi} embedded />
                </SettingsAccordionSection>

                <SettingsAccordionSection
                    id="data"
                    index={4}
                    title="Data Management"
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
                    hint="Atoms, files and Dream"
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
                    hint="No sign-in, no server"
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
