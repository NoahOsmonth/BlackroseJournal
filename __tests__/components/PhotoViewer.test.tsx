/**
 * The full-screen photo (Kaneo #108).
 *
 * A closed RN-Web Modal stays in the DOM, so "not visible" is asserted by asking
 * what the writer can reach, not by asking whether a node exists.
 */
/* eslint-disable import/first -- the safe-area mock must be declared before the
   component imports it, or the real provider is loaded first. */
jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { fireEvent, render } from '@testing-library/react-native';

import { PhotoViewer } from '../../components/journal/PhotoViewer';

const PHOTO = 'data:image/jpeg;base64,AAAA';

describe('PhotoViewer', () => {
    it('shows the photo when open', () => {
        const { getByTestId } = render(<PhotoViewer visible dataUrl={PHOTO} onClose={() => {}} />);
        const image = getByTestId('photo-viewer-image');
        expect(image.props.source).toEqual({ uri: PHOTO });
    });

    it('renders nothing at all when the entry has no photo', () => {
        const { queryByTestId } = render(<PhotoViewer visible dataUrl={null} onClose={() => {}} />);
        expect(queryByTestId('photo-viewer')).toBeNull();
    });

    it('closes when the scrim is pressed', () => {
        const onClose = jest.fn();
        const { getByTestId } = render(<PhotoViewer visible dataUrl={PHOTO} onClose={onClose} />);
        fireEvent.press(getByTestId('photo-viewer-scrim'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes from the button, which is a real target with a plain label', () => {
        const onClose = jest.fn();
        const { getByTestId, getByLabelText } = render(
            <PhotoViewer visible dataUrl={PHOTO} onClose={onClose} />,
        );
        fireEvent.press(getByTestId('photo-viewer-close'));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(getByLabelText('Close the photo')).toBeTruthy();
    });

    it('labels the photo for a screen reader instead of leaving it silent', () => {
        const { getByLabelText } = render(<PhotoViewer visible dataUrl={PHOTO} onClose={() => {}} />);
        expect(getByLabelText('Photo on this entry, full screen')).toBeTruthy();
    });
});
