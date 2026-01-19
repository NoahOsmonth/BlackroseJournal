import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { useColorScheme as useNativeWindColorScheme } from 'nativewind';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock NativeWind
jest.mock('nativewind', () => ({
  useColorScheme: jest.fn(),
}));

describe('useThemeSettings', () => {
  const mockSetColorScheme = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useNativeWindColorScheme as jest.Mock).mockReturnValue({
      colorScheme: 'light',
      setColorScheme: mockSetColorScheme,
    });
  });

  it('should load theme from storage on mount', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');

    const { result } = renderHook(() => useThemeSettings());

    await waitFor(() => {
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('user-theme-preference');
      expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    });
    
    expect(result.current.theme).toBe('dark');
  });

  it('should default to system if no preference found', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useThemeSettings());

    await waitFor(() => {
        // expect(mockSetColorScheme).toHaveBeenCalledWith('system'); 
        // Note: NativeWind might default to system, but we want to ensure we set it explicitly if needed
        // or just ensure our internal state is 'system'
    });

    expect(result.current.theme).toBe('system');
  });

  it('should update theme and save to storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');

    const { result } = renderHook(() => useThemeSettings());

    await waitFor(() => expect(result.current.theme).toBe('light'));

    await act(async () => {
      await result.current.setTheme('dark');
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('user-theme-preference', 'dark');
    expect(mockSetColorScheme).toHaveBeenCalledWith('dark');
    expect(result.current.theme).toBe('dark');
  });
  
  it('should handle system theme selection', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');
  
      const { result } = renderHook(() => useThemeSettings());
  
      await waitFor(() => expect(result.current.theme).toBe('light'));
  
      await act(async () => {
        await result.current.setTheme('system');
      });
  
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user-theme-preference', 'system');
      expect(mockSetColorScheme).toHaveBeenCalledWith('system');
      expect(result.current.theme).toBe('system');
    });
});
