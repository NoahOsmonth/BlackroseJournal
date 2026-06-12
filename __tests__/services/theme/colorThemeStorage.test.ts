/* eslint-disable import/first */

const mockStore = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
        setItem: jest.fn((key: string, value: string) => {
            mockStore.set(key, value);
            return Promise.resolve();
        }),
    },
}));

import {
    DEFAULT_COLOR_THEME,
    updateColorThemeSlot,
} from '../../../constants/theme';
import {
    COLOR_THEME_STORAGE_KEY,
    loadStoredColorTheme,
    saveStoredColorTheme,
} from '../../../services/theme/colorThemeStorage';

describe('colorThemeStorage', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-06-12T10:00:00Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('loads the default color theme when nothing is stored', async () => {
        await expect(loadStoredColorTheme()).resolves.toEqual(DEFAULT_COLOR_THEME);
    });

    it('saves a schema-versioned custom color theme', async () => {
        const custom = updateColorThemeSlot(DEFAULT_COLOR_THEME, 'chatAiTextLight', '#123abc');
        expect(custom).not.toBeNull();

        await saveStoredColorTheme(custom ?? DEFAULT_COLOR_THEME);

        const stored = JSON.parse(mockStore.get(COLOR_THEME_STORAGE_KEY) ?? '{}');
        expect(stored.schemaVersion).toBe(1);
        expect(stored.updatedAt).toBe(new Date('2026-06-12T10:00:00Z').getTime());
        expect(stored.theme.presetId).toBe('custom');
        expect(stored.theme.colors.chatAiTextLight).toBe('#123ABC');
    });

    it('falls back to defaults when the stored payload is corrupt', async () => {
        mockStore.set(COLOR_THEME_STORAGE_KEY, 'not-json');

        await expect(loadStoredColorTheme()).resolves.toEqual(DEFAULT_COLOR_THEME);
    });

    it('sanitizes a legacy bare theme payload', async () => {
        mockStore.set(COLOR_THEME_STORAGE_KEY, JSON.stringify({
            presetId: 'custom',
            colors: {
                chatUserTextLight: '#abcdef',
                chatUserTextDark: 'bad-value',
            },
        }));

        const theme = await loadStoredColorTheme();

        expect(theme.presetId).toBe('custom');
        expect(theme.colors.chatUserTextLight).toBe('#ABCDEF');
        expect(theme.colors.chatUserTextDark).toBe(DEFAULT_COLOR_THEME.colors.chatUserTextDark);
        expect(theme.colors.appTextLight).toBe(DEFAULT_COLOR_THEME.colors.appTextLight);
    });
});
