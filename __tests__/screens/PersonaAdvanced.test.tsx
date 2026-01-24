import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import PersonaAdvancedScreen from '../../app/persona/advanced';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
    }),
    useLocalSearchParams: () => ({}),
}));

jest.mock('@/services/personas/personaDraftSettings', () => ({
    loadPersonaDraftSettings: jest.fn(async () => ({
        model: 'zai-org/glm-4.7-original:thinking',
        imagination: 25,
    })),
    savePersonaDraftSettings: jest.fn(async () => undefined),
}));

jest.mock('@/services/personas/personasStorage', () => ({
    getPersona: jest.fn(),
    updatePersona: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('PersonaAdvancedScreen', () => {
    it('renders GLM model options', async () => {
        render(<PersonaAdvancedScreen />);

        expect(screen.getByText('AI Model')).toBeTruthy();
        expect(screen.getByText('GLM 4.7 Thinking')).toBeTruthy();

        fireEvent.press(screen.getByText('AI Model'));

        expect(await screen.findByText('Choose model')).toBeTruthy();
        expect(screen.getByText('GLM 4.7 Flash')).toBeTruthy();
        expect(screen.queryByText('Claude 3.5 Sonnet')).toBeNull();
        expect(screen.queryByText('GPT-4o')).toBeNull();
    });
});
