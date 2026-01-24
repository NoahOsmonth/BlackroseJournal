import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PersonaForm, PersonaFormValues } from '../../components/personas/PersonaForm';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../constants/personas', () => ({
    getPersonaAvatarSource: () => null,
    PERSONA_AVATARS: [],
}));

describe('PersonaForm', () => {
    const baseValues: PersonaFormValues = {
        name: 'Rosebud',
        tagline: 'Balanced',
        voice: 'Onyx',
        prompt: '',
        model: 'agent-default',
        imagination: 25,
    };

    it('opens voice picker and updates selection', () => {
        render(
            <PersonaForm
                title="New persona"
                submitLabel="Create"
                initialValues={baseValues}
                onBack={jest.fn()}
                onSubmit={jest.fn()}
                onAdvanced={jest.fn()}
            />
        );

        expect(screen.getByText('Onyx')).toBeTruthy();

        fireEvent.press(screen.getByText('Voice'));
        fireEvent.press(screen.getByText('Nova'));

        expect(screen.getByText('Nova')).toBeTruthy();
    });
});
