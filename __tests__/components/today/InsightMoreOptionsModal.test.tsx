import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { InsightMoreOptionsModal } from '../../../components/today/InsightMoreOptionsModal';

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ bottom: 0 }),
}));

describe('InsightMoreOptionsModal', () => {
    const defaultProps = {
        visible: true,
        onClose: jest.fn(),
        onShare: jest.fn(),
        onCopy: jest.fn(),
        onHide: jest.fn(),
        onShowSavedInsights: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the options sheet when visible', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        expect(screen.getByText('More options')).toBeTruthy();
        expect(screen.getByLabelText('Share')).toBeTruthy();
        expect(screen.getByLabelText('Copy')).toBeTruthy();
        expect(screen.getByLabelText('Hide for today')).toBeTruthy();
        expect(screen.getByLabelText('Saved insights')).toBeTruthy();
        expect(screen.getByLabelText('Cancel')).toBeTruthy();
        expect(screen.getByLabelText('Close more options')).toBeTruthy();
    });

    it('closes the modal when Cancel is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Cancel'));

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes the modal when the backdrop is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Close more options'));

        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onShare and closes the modal when Share is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Share'));

        expect(defaultProps.onShare).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onCopy and closes the modal when Copy is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Copy'));

        expect(defaultProps.onCopy).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onHide and closes the modal when Hide for today is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Hide for today'));

        expect(defaultProps.onHide).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onShowSavedInsights and closes the modal when Saved insights is pressed', () => {
        render(<InsightMoreOptionsModal {...defaultProps} />);

        fireEvent.press(screen.getByLabelText('Saved insights'));

        expect(defaultProps.onShowSavedInsights).toHaveBeenCalledTimes(1);
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
});
