import React from 'react';
import { Modal, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { PersonaSheet } from '../components/personas/PersonaSheet';
import { NewPersonaCard } from '../components/personas/NewPersonaCard';
import type { Persona } from '../services/personas/personasStorage.types';

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

jest.mock('react-native-svg', () => {
    const MockSvgNode = () => null;

    return {
        __esModule: true,
        Circle: MockSvgNode,
        default: MockSvgNode,
        Defs: MockSvgNode,
        G: MockSvgNode,
        Path: MockSvgNode,
        Pattern: MockSvgNode,
        Rect: MockSvgNode,
        Svg: MockSvgNode,
    };
});

jest.mock('../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

const rosebudPersona: Persona = {
    id: 'rosebud',
    name: 'Rosebud',
    tagline: 'Balanced and thoughtful',
    voice: 'Warm',
    prompt: 'Respond thoughtfully.',
    model: 'test-model',
    imagination: 0.5,
    avatarKey: 'persona-default',
    isActive: true,
    createdAt: 0,
    updatedAt: 0,
};

function classNameFor(node: ReactTestInstance): string {
    const className = node.props.className;
    return typeof className === 'string' ? className : '';
}

describe('PersonaSheet', () => {
    const originalPlatform = Platform.OS;

    beforeEach(() => {
        Object.defineProperty(Platform, 'OS', {
            configurable: true,
            value: 'web',
        });
    });

    afterEach(() => {
        Object.defineProperty(Platform, 'OS', {
            configurable: true,
            value: originalPlatform,
        });
    });

    it('matches the reference sheet surface and active persona card structure', () => {
        const { getByText, getByTestId, UNSAFE_getByType } = render(
            <PersonaSheet
                visible
                personas={[rosebudPersona]}
                activePersona={rosebudPersona}
                activePersonaId={rosebudPersona.id}
                onClose={jest.fn()}
                onSelectPersona={jest.fn()}
                onCreatePersona={jest.fn()}
                onOpenSettings={jest.fn()}
            />
        );

        expect(UNSAFE_getByType(Modal).props.animationType).toBe('none');
        expect(getByText('Choose persona')).toBeTruthy();
        expect(getByText('Rosebud')).toBeTruthy();
        expect(getByText('Balanced and thoughtful')).toBeTruthy();
        expect(getByText('Active')).toBeTruthy();

        expect(classNameFor(getByTestId('persona-sheet-overlay'))).toContain('fixed inset-0');
        expect(classNameFor(getByTestId('persona-sheet-panel'))).toContain(
            'bg-surface-light dark:bg-surface-dark rounded-t-3xl'
        );
        expect(classNameFor(getByTestId('persona-sheet-panel'))).toContain('pb-5');
        expect(classNameFor(getByTestId('persona-sheet-handle'))).toContain(
            'w-10 h-1 bg-gray-300 dark:bg-gray-600'
        );
        expect(getByTestId('persona-sheet-cards').props.contentContainerStyle).toMatchObject({
            paddingTop: 16,
        });
        expect(classNameFor(getByTestId('persona-card'))).toContain(
            'w-[82vw] max-w-[340px] bg-surface-light dark:bg-card-dark'
        );
        expect(classNameFor(getByTestId('persona-avatar-shell'))).toContain('bg-persona-rose');
    });
});

describe('NewPersonaCard', () => {
    it('matches the swiped reference dimensions and light/dark text treatment', () => {
        const { getByText, getByTestId } = render(<NewPersonaCard onCreate={jest.fn()} />);

        expect(getByText('New persona')).toBeTruthy();
        expect(getByText('Build your dream team')).toBeTruthy();
        expect(getByText('Create')).toBeTruthy();

        expect(classNameFor(getByTestId('new-persona-card'))).toContain(
            'w-[80vw] max-w-sm'
        );
        expect(classNameFor(getByTestId('new-persona-card'))).toContain(
            'border-gray-300 dark:border-gray-700'
        );
        expect(classNameFor(getByTestId('new-persona-card'))).toContain('h-[380px]');
        expect(classNameFor(getByTestId('new-persona-avatar'))).toContain('bg-persona-teal');
        expect(classNameFor(getByTestId('new-persona-create'))).toContain(
            'bg-gray-900 dark:bg-white'
        );
    });
});
