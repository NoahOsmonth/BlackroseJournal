import { renderHook, act } from '@testing-library/react-native';
import { DEFAULT_COLOR_THEME } from '../constants/theme';
import { useThemeSettings } from '../hooks/theme/useThemeSettings';

// --- Mocks ---
const mockSetColorScheme = jest.fn();
const mockStore = new Map<string, string>();

jest.mock('nativewind', () => ({
    useColorScheme: () => ({ setColorScheme: mockSetColorScheme }),
}));

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

jest.mock('@/services/settings/userSettingsRemote', () => ({
    loadRemoteUserSettings: jest.fn().mockResolvedValue(null),
    saveRemoteUserSettings: jest.fn().mockResolvedValue(undefined),
}));

describe('useThemeSettings', () => {
    beforeEach(() => {
        mockStore.clear();
    });

    afterEach(() => {
        mockSetColorScheme.mockClear();
    });

    it('defaults to dark mode when no theme preference has been saved', async () => {
        renderHook(() => useThemeSettings());
        await act(async () => {});

        expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    });

    it('calls setColorScheme when setTheme is invoked', async () => {
        const { result } = renderHook(() => useThemeSettings());
        await act(async () => {});

        mockSetColorScheme.mockClear();
        await act(async () => {
            await result.current.setTheme('dark');
        });

        expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    });

    it('loads a stored custom color theme', async () => {
        mockStore.set('@blackrose_color_theme', JSON.stringify({
            schemaVersion: 1,
            updatedAt: 0,
            theme: {
                presetId: 'custom',
                colors: {
                    ...DEFAULT_COLOR_THEME.colors,
                    chatAiTextLight: '#112233',
                },
            },
        }));

        const { result } = renderHook(() => useThemeSettings());
        await act(async () => {});

        expect(result.current.colorTheme.colors.chatAiTextLight).toBe('#112233');
    });

    it('broadcasts custom color changes across hook instances', async () => {
        const first = renderHook(() => useThemeSettings());
        const second = renderHook(() => useThemeSettings());
        await act(async () => {});

        await act(async () => {
            await first.result.current.setColorThemeColor('chatUserTextLight', '#445566');
        });

        expect(second.result.current.colorTheme.presetId).toBe('custom');
        expect(second.result.current.colorTheme.colors.chatUserTextLight).toBe('#445566');
    });

    it('applyColorThemeEdit writes the source and synced partner together', async () => {
        const first = renderHook(() => useThemeSettings());
        const second = renderHook(() => useThemeSettings());
        await act(async () => {});

        await act(async () => {
            await first.result.current.applyColorThemeEdit({
                slot: 'accentLight',
                value: '#0EA5E9',
                partnerSlot: 'accentDark',
                partnerValue: '#67E8F9',
                syncPartner: true,
            });
        });

        expect(second.result.current.colorTheme.presetId).toBe('custom');
        expect(second.result.current.colorTheme.colors.accentLight).toBe('#0EA5E9');
        expect(second.result.current.colorTheme.colors.accentDark).toBe('#67E8F9');
    });

    it('applyColorThemeEdit leaves the partner untouched when sync is off', async () => {
        const first = renderHook(() => useThemeSettings());
        await act(async () => {});

        await act(async () => {
            await first.result.current.applyColorThemeEdit({
                slot: 'accentLight',
                value: '#0EA5E9',
                partnerSlot: 'accentDark',
                partnerValue: '#67E8F9',
                syncPartner: false,
            });
        });

        // Source updates, but the partner (default) stays as-is.
        expect(first.result.current.colorTheme.colors.accentLight).toBe('#0EA5E9');
        expect(first.result.current.colorTheme.colors.accentDark).toBe(
            DEFAULT_COLOR_THEME.colors.accentDark
        );
    });

    it('applyColorThemeEdit rejects unparseable hex and returns false', async () => {
        const { result } = renderHook(() => useThemeSettings());
        await act(async () => {});

        let returned = true;
        await act(async () => {
            returned = await result.current.applyColorThemeEdit({
                slot: 'accentLight',
                value: 'not-a-color',
                partnerSlot: 'accentDark',
                partnerValue: '#67E8F9',
                syncPartner: true,
            });
        });

        expect(returned).toBe(false);
        // State was not changed.
        expect(result.current.colorTheme.colors.accentLight).toBe(
            DEFAULT_COLOR_THEME.colors.accentLight
        );
    });

    // Guard: the hook must survive nativewind's useColorScheme returning a
    // broken object (missing setColorScheme) on Android boot. The theme load
    // effect would otherwise throw and the AppColorThemeProvider would never
    // mount, surfacing Expo Go's "Something went wrong" redbox.
    it('does not throw when nativewind useColorScheme returns a malformed API', async () => {
        const originalUseColorScheme = jest.requireMock('nativewind').useColorScheme;
        try {
            jest.requireMock('nativewind').useColorScheme = () => ({});
            expect(() => renderHook(() => useThemeSettings())).not.toThrow();
        } finally {
            jest.requireMock('nativewind').useColorScheme = originalUseColorScheme;
        }
    });

    it('does not throw when nativewind useColorScheme itself throws', async () => {
        const originalUseColorScheme = jest.requireMock('nativewind').useColorScheme;
        try {
            jest.requireMock('nativewind').useColorScheme = () => {
                throw new Error('cssInterop darkMode flag missing');
            };
            expect(() => renderHook(() => useThemeSettings())).not.toThrow();
        } finally {
            jest.requireMock('nativewind').useColorScheme = originalUseColorScheme;
        }
    });
});
