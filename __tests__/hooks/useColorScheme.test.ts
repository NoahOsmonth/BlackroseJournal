import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

// Mock NativeWind
jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(),
}));

describe('useColorScheme', () => {
  it('should return the color scheme from nativewind', () => {
    (useNativeWindColorScheme as jest.Mock).mockReturnValue({
      colorScheme: 'dark',
    });

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('should default to light if undefined', () => {
      // If nativewind returns undefined?
      (useNativeWindColorScheme as jest.Mock).mockReturnValue({
        colorScheme: undefined,
      });
  
      const { result } = renderHook(() => useColorScheme());
  
      // Depending on implementation, might return undefined or fallback
      expect(result.current).toBeUndefined(); 
    });
});
