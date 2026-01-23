import { render, fireEvent } from '@testing-library/react-native';
import { BottomNav } from '@/components/journal/BottomNav';
import { useColorScheme } from '@/hooks/use-color-scheme';

jest.mock('@/hooks/use-color-scheme', () => ({
    useColorScheme: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 34 }),
}));

describe('BottomNav', () => {
    beforeEach(() => {
        (useColorScheme as jest.Mock).mockReturnValue('light');
    });

    it('renders all tabs', () => {
        const { getByText } = render(
            <BottomNav activeTab="today" onTabPress={jest.fn()} />
        );
        
        expect(getByText('Today')).toBeTruthy();
        expect(getByText('Explore')).toBeTruthy();
        expect(getByText('History')).toBeTruthy();
        expect(getByText('Insights')).toBeTruthy();
    });

    it('handles tab press', () => {
        const onTabPress = jest.fn();
        const { getByText } = render(
            <BottomNav activeTab="today" onTabPress={onTabPress} />
        );
        
        fireEvent.press(getByText('Insights'));
        expect(onTabPress).toHaveBeenCalledWith('insights');
    });

    it('adjusts for dark mode', () => {
        (useColorScheme as jest.Mock).mockReturnValue('dark');
        const { getByText } = render(
            <BottomNav activeTab="today" onTabPress={jest.fn()} />
        );
        // This is a bit implicit, mostly checking it doesn't crash
        expect(getByText('Today')).toBeTruthy();
    });
});
