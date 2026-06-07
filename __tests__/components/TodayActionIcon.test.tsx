/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { render } from '@testing-library/react-native';

import {
    EveningReflectionIcon,
    MorningIntentionIcon,
} from '../../components/today/TodayActionIcon';

jest.mock('react-native-svg', () => {
    const ReactMock = require('react');
    const { View } = require('react-native');
    const MockSvg = ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
        ReactMock.createElement(View, { testID }, children)
    );
    const MockNode = () => null;
    return {
        __esModule: true,
        default: MockSvg,
        Circle: MockNode,
        Path: MockNode,
        Rect: MockNode,
        Svg: MockSvg,
    };
});

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

describe('TodayActionIcon', () => {
    it('renders generated svg icons for morning and evening actions', () => {
        const { getByTestId } = render(
            <>
                <MorningIntentionIcon />
                <EveningReflectionIcon />
            </>
        );

        expect(getByTestId('morning-intention-svg')).toBeTruthy();
        expect(getByTestId('evening-reflection-svg')).toBeTruthy();
    });
});
