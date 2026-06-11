import { renderHook, act } from '@testing-library/react-native';
import { useThemeSettings } from '../hooks/theme/useThemeSettings';

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

describe('useThemeSettings', () => {
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
});
