import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../../app/(tabs)/settings';
import { APP_ABOUT_COPY, APP_PRIVACY_COPY } from '../../constants/appInfo';

/**
 * DEF-009 guard: `Alert.alert` is a silent no-op under react-native-web, so the
 * About and Privacy rows on Settings did nothing on web. Both must route through
 * the web-safe `notifyUser` (window.alert on web, Alert on native).
 */
const mockNotifyUser = jest.fn();
jest.mock('@/components/ui/webConfirm', () => ({
    notifyUser: (title: string, message?: string) => mockNotifyUser(title, message),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => {
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/journal', () => ({
    BottomNav: () => null,
}));

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@/hooks/useThemeSettings', () => ({
    useThemeSettings: () => ({
        theme: 'system',
        setTheme: jest.fn(),
        emojiStyle: 'native',
        setEmojiStyle: jest.fn(),
        colorTheme: { presetId: 'default', colors: {} },
        setColorThemePreset: jest.fn(),
        applyColorThemeEdit: jest.fn(),
        resetColorTheme: jest.fn(),
    }),
}));

jest.mock('@/hooks/settings/useDataManagementActions', () => ({
    useDataManagementActions: () => ({
        latestBackup: null,
        isBusy: false,
        isClearingHistory: false,
        handleCreateBackup: jest.fn(),
        handleRestoreLatestBackup: jest.fn(),
        handleClearHistory: jest.fn(),
    }),
}));

jest.mock('@/hooks/memory/useLocalMemories', () => ({
    useLocalMemories: () => ({ atoms: [], isLoading: false }),
}));

jest.mock('@/hooks/memory/useIdentityProfile', () => ({
    useIdentityProfile: () => ({
        profile: null,
        isLoading: false,
        isMutating: false,
        scalarRows: [],
        pendingRows: [],
        collectionRows: [],
        confirmPending: jest.fn(),
        dismissPending: jest.fn(),
    }),
}));

jest.mock('@/hooks/settings/useCustomAiModels', () => ({
    useCustomAiModels: () => ({
        settings: { enabled: false, activeProfileId: null, profiles: [] },
    }),
}));

jest.mock('@/hooks/settings/useGenerationSettings', () => ({
    useGenerationSettings: () => ({ settings: { temperature: 0.7, topP: 0.9 } }),
}));

jest.mock('@/hooks/navigation/useTabNavigation', () => ({
    useTabNavigation: () => ({ goToTab: jest.fn() }),
}));

jest.mock('@/hooks/journal/useJournalExport', () => ({
    useJournalExport: () => ({ exportAsJson: jest.fn(), shareJson: jest.fn() }),
}));

jest.mock('@/hooks/seed/useSeedDemoData', () => ({
    useSeedDemoData: () => ({
        seed: jest.fn(),
        seedBulk: jest.fn(),
        isSeeding: false,
        seedProgress: null,
    }),
}));

jest.mock('@/services/seed/seedDemoData', () => ({
    isDemoSeedEnabled: () => false,
    clearDemoData: jest.fn(),
    markDemoDataSeeded: jest.fn(),
}));

describe('SettingsScreen About/Privacy notifier', () => {
    beforeEach(() => {
        mockNotifyUser.mockClear();
    });

    it('routes About and Privacy through the web-safe notifier', () => {
        render(<SettingsScreen />);

        // About is collapsed by default; expand it first.
        fireEvent.press(screen.getByLabelText(/^About,/));
        fireEvent.press(screen.getByLabelText('About Blackrose'));
        expect(mockNotifyUser).toHaveBeenCalledWith('About', APP_ABOUT_COPY);

        fireEvent.press(screen.getByLabelText('Privacy Policy'));
        expect(mockNotifyUser).toHaveBeenCalledWith('Privacy Policy', APP_PRIVACY_COPY);
    });
});
