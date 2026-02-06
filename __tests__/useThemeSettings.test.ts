import { renderHook, act } from '@testing-library/react-native';

// --- Mocks ---
const mockSetColorScheme = jest.fn();
jest.mock('nativewind', () => ({
    useColorScheme: () => ({ setColorScheme: mockSetColorScheme }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
    },
}));

jest.mock('@/services/settings/userSettingsRemote', () => ({
    loadRemoteUserSettings: jest.fn().mockResolvedValue(null),
    saveRemoteUserSettings: jest.fn().mockResolvedValue(undefined),
}));

import { useThemeSettings } from '../hooks/theme/useThemeSettings';

describe('useThemeSettings', () => {
    afterEach(() => {
        mockSetColorScheme.mockClear();
    });

    it('calls setColorScheme with system on initial load', async () => {
        renderHook(() => useThemeSettings());
        await act(async () => {});

        expect(mockSetColorScheme).toHaveBeenCalledWith('system');
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
});
