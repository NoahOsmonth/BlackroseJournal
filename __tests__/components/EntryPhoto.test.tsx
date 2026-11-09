/**
 * The photo block on an entry (Kaneo #106, #108).
 */
/* eslint-disable import/first -- the safe-area mock must be declared before the
   component imports it, or the real provider is loaded first. */
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { fireEvent, render } from '@testing-library/react-native';

import { EntryPhoto } from '../../components/journal/EntryPhoto';

const PHOTO = { dataUrl: 'data:image/jpeg;base64,AAAA', width: 1200, height: 800, updatedAt: 1 };

describe('EntryPhoto', () => {
    it('renders nothing for an entry with no photo', () => {
        const { queryByTestId } = render(<EntryPhoto photo={null} isBusy={false} onRemove={() => {}} />);
        expect(queryByTestId('entry-photo')).toBeNull();
    });

    it('draws the photo at its own shape', () => {
        const { getByTestId } = render(<EntryPhoto photo={PHOTO} isBusy={false} onRemove={() => {}} />);
        const style = getByTestId('entry-photo-image').props.style;
        expect(style.aspectRatio).toBe(1.5);
    });

    it('falls back to a readable shape when the photo has no size', () => {
        const { getByTestId } = render(
            <EntryPhoto photo={{ ...PHOTO, width: 0, height: 0 }} isBusy={false} onRemove={() => {}} />,
        );
        expect(getByTestId('entry-photo-image').props.style.aspectRatio).toBeCloseTo(4 / 3);
    });

    it('opens the full-screen viewer when the photo is pressed', () => {
        const { getByTestId, queryByTestId } = render(
            <EntryPhoto photo={PHOTO} isBusy={false} onRemove={() => {}} />,
        );
        expect(queryByTestId('photo-viewer')).toBeNull();
        fireEvent.press(getByTestId('entry-photo-open'));
        expect(getByTestId('photo-viewer-image')).toBeTruthy();
    });

    it('removes the photo from its own button', () => {
        const onRemove = jest.fn();
        const { getByTestId } = render(<EntryPhoto photo={PHOTO} isBusy={false} onRemove={onRemove} />);
        fireEvent.press(getByTestId('entry-photo-remove'));
        expect(onRemove).toHaveBeenCalledTimes(1);
    });
});
