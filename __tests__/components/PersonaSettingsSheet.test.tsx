import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PersonaSettingsSheet } from '@/components/personas/PersonaSettingsSheet';
import { Persona } from '@/services/personas/personasStorage.types';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));


const persona: Persona = {
    id: 'persona-1',
    name: 'Rosebud',
    tagline: 'Balanced and thoughtful',
    voice: 'Onyx',
    prompt: '',
    model: 'zai-org/glm-4.7-original:thinking',
    imagination: 25,
    isActive: true,
    createdAt: 1,
    updatedAt: 1,
};

describe('PersonaSettingsSheet', () => {
    it('fires actions for edit, advanced, and delete', () => {
        const onEdit = jest.fn();
        const onAdvanced = jest.fn();
        const onDelete = jest.fn();

        render(
            <PersonaSettingsSheet
                visible
                persona={persona}
                onClose={jest.fn()}
                onEdit={onEdit}
                onAdvanced={onAdvanced}
                onDelete={onDelete}
            />
        );

        fireEvent.press(screen.getByLabelText('Edit persona'));
        expect(onEdit).toHaveBeenCalledWith(persona);

        fireEvent.press(screen.getByLabelText('Advanced settings'));
        expect(onAdvanced).toHaveBeenCalledWith(persona);

        fireEvent.press(screen.getByLabelText('Delete persona'));
        expect(onDelete).toHaveBeenCalledWith(persona);
    });
});
