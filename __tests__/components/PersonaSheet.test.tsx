import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PersonaSheet } from '@/components/personas/PersonaSheet';
import { Persona } from '@/services/personas/personasStorage.types';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: 'MaterialIcons',
}));


const basePersona: Persona = {
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

describe('PersonaSheet', () => {
    it('opens settings from the header action using the active persona', () => {
        const onOpenSettings = jest.fn();

        render(
            <PersonaSheet
                visible
                personas={[basePersona]}
                activePersona={basePersona}
                activePersonaId={basePersona.id}
                onClose={jest.fn()}
                onSelectPersona={jest.fn()}
                onCreatePersona={jest.fn()}
                onOpenSettings={onOpenSettings}
            />
        );

        fireEvent.press(screen.getByLabelText('Manage personas'));
        expect(onOpenSettings).toHaveBeenCalledWith(basePersona);
    });

    it('opens settings from the persona card action', () => {
        const onOpenSettings = jest.fn();

        render(
            <PersonaSheet
                visible
                personas={[basePersona]}
                activePersona={basePersona}
                activePersonaId={basePersona.id}
                onClose={jest.fn()}
                onSelectPersona={jest.fn()}
                onCreatePersona={jest.fn()}
                onOpenSettings={onOpenSettings}
            />
        );

        fireEvent.press(screen.getByLabelText('Open persona settings'));
        expect(onOpenSettings).toHaveBeenCalledWith(basePersona);
    });
});
