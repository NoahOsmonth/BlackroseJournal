import { renderHook } from '@testing-library/react-native';

import { useColorScheme } from '../hooks/theme/use-color-scheme';

// --- Mocks ---
const mockUseNativeWindColorScheme = jest.fn();

jest.mock('nativewind', () => ({
    useColorScheme: () => mockUseNativeWindColorScheme(),
}));

describe('hooks/theme/use-color-scheme', () => {
    beforeEach(() => {
        mockUseNativeWindColorScheme.mockReset();
    });

    it('returns the colorScheme reported by nativewind', () => {
        mockUseNativeWindColorScheme.mockReturnValue({ colorScheme: 'dark' });
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');
    });

    it('forwards null when nativewind reports null (system mode)', () => {
        mockUseNativeWindColorScheme.mockReturnValue({ colorScheme: null });
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBeNull();
    });

    it('falls back to dark when nativewind throws (Android cssInterop race)', () => {
        mockUseNativeWindColorScheme.mockImplementation(() => {
            throw new Error('Unable to manually set color scheme without using darkMode: class');
        });
        expect(() => renderHook(() => useColorScheme())).not.toThrow();
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');
    });

    it('falls back to dark when nativewind returns a malformed object', () => {
        mockUseNativeWindColorScheme.mockReturnValue({});
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');
    });

    it('falls back to dark when nativewind returns a non-string colorScheme', () => {
        mockUseNativeWindColorScheme.mockReturnValue({ colorScheme: 42 });
        const { result } = renderHook(() => useColorScheme());
        expect(result.current).toBe('dark');
    });
});
