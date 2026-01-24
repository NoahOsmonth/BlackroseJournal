import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '@/app/(tabs)/settings';
import { useAuthSession } from '@/hooks/auth/useAuthSession';
import { useThemeSettings } from '@/hooks/useThemeSettings';
import { Alert, Share } from 'react-native';
import { clearAllEntries, getAllEntriesForExport } from '@/services/journalStorage';
import { signOut } from '@/services/auth/authService';

jest.mock('@/hooks/useThemeSettings', () => ({
  useThemeSettings: jest.fn(),
}));

jest.mock('@/hooks/auth/useAuthSession', () => ({
  useAuthSession: jest.fn(),
}));

jest.mock('@/services/auth/authService', () => ({
  signOut: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/journal', () => ({
  BottomNav: () => null,
  FAB: () => null,
}));

jest.mock('@/services/journalStorage', () => ({
    clearAllEntries: jest.fn(),
    getAllEntriesForExport: jest.fn(),
}));

// Mock Share
jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock Safe Area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

describe('SettingsScreen', () => {
  const mockSetTheme = jest.fn();
  const mockSetEmojiStyle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useThemeSettings as jest.Mock).mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
      emojiStyle: 'native',
      setEmojiStyle: mockSetEmojiStyle,
      isLoaded: true,
    });
    (useAuthSession as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      isAnonymous: true,
    });
    (signOut as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders theme options', () => {
    const { getByText } = render(<SettingsScreen />);
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
  });

  it('calls setTheme when option selected', () => {
    const { getByText } = render(<SettingsScreen />);
    fireEvent.press(getByText('Dark'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('renders data management options', () => {
      const { getByText } = render(<SettingsScreen />);
      expect(getByText('Clear Data')).toBeTruthy();
      expect(getByText('Export Data')).toBeTruthy();
  });

  it('handles export data', async () => {
      (getAllEntriesForExport as jest.Mock).mockResolvedValue('{"test": "data"}');
      const { getByText } = render(<SettingsScreen />);
      
      fireEvent.press(getByText('Export Data'));
      
      await waitFor(() => {
          expect(getAllEntriesForExport).toHaveBeenCalled();
          expect(Share.share).toHaveBeenCalledWith({
              message: '{"test": "data"}',
              title: 'Journal Export'
          });
      });
  });

  it('handles clear data cancellation', () => {
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Clear Data'));
      
      expect(Alert.alert).toHaveBeenCalledWith(
          "Clear All Data",
          "Are you sure you want to delete all journal entries? This action cannot be undone.",
          expect.any(Array)
      );
      
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const cancelButton = buttons.find((b: any) => b.style === 'cancel');
      
      // If onPress is undefined, it means default behavior (close), so just verify it exists
      // and we don't call clearAllEntries
      if (cancelButton.onPress) {
         cancelButton.onPress();
      }
      
      expect(clearAllEntries).not.toHaveBeenCalled();
  });

  it('handles clear data confirmation', async () => {
      const { getByText } = render(<SettingsScreen />);
      fireEvent.press(getByText('Clear Data'));
      
      const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
      const deleteButton = buttons.find((b: any) => b.style === 'destructive');
      
      await deleteButton.onPress();
      
      expect(clearAllEntries).toHaveBeenCalled();
  });
});
