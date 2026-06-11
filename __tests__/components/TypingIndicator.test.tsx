import React from 'react';
import { render } from '@testing-library/react-native';

import { TypingIndicator } from '../../components/ui/TypingIndicator';

describe('TypingIndicator', () => {
    it('renders an accessible indicator without raw text dots', () => {
        const { getByLabelText, queryByText } = render(<TypingIndicator />);

        expect(getByLabelText('AI typing indicator')).toBeTruthy();
        expect(queryByText('•')).toBeNull();
    });
});
