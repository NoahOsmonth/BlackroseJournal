import React from 'react';
import { render, screen } from '@testing-library/react-native';

import MemoryGraphRoute from '../../app/memory-graph';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({ back: mockBack }),
    useLocalSearchParams: () => ({ layer: 'semantic', tag: 'career' }),
}));

jest.mock('../../components/memory-graph', () => ({
    MemoryGraphScreen: (props: {
        initialLayer?: string;
        initialQuery?: string;
        onBack?: () => void;
    }) => {
        const { Text } = jest.requireActual('react-native');
        return (
            <>
                <Text>layer:{props.initialLayer}</Text>
                <Text>query:{props.initialQuery}</Text>
                <Text>{props.onBack ? 'has back' : 'no back'}</Text>
            </>
        );
    },
}));

describe('MemoryGraphRoute', () => {
    it('passes layer and tag params into the graph screen', () => {
        render(<MemoryGraphRoute />);

        expect(screen.getByText('layer:semantic')).toBeTruthy();
        expect(screen.getByText('query:career')).toBeTruthy();
        expect(screen.getByText('has back')).toBeTruthy();
    });
});
