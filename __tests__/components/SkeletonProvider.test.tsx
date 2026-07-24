import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { mockReanimated } from '../mocks/reanimatedMock';

jest.mock('react-native-reanimated', () => mockReanimated());

import { SkeletonProvider, useSkeletonProgress } from '../../components/ui/SkeletonProvider';


function ProgressProbe() {
    const progress = useSkeletonProgress();
    return <Text>{progress ? 'shared progress' : 'no progress'}</Text>;
}

describe('SkeletonProvider', () => {
    it('provides a shared progress value to descendants', () => {
        render(
            <SkeletonProvider>
                <ProgressProbe />
            </SkeletonProvider>
        );

        expect(screen.getByText('shared progress')).toBeTruthy();
    });

    it('leaves consumers without a provider on the fallback path', () => {
        render(<ProgressProbe />);
        expect(screen.getByText('no progress')).toBeTruthy();
    });
});
