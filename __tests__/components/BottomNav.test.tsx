import { render, fireEvent } from '@testing-library/react-native';
import { BottomNav } from '@/components/journal/BottomNav';

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 34 }),
}));

describe('BottomNav', () => {
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
});
