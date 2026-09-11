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
        expect(getByText('Choose voice')).toBeTruthy();
        expect(getByText('Rosebud')).toBeTruthy();
        expect(getByText('Balanced and thoughtful')).toBeTruthy();
        expect(getByText('✓ Active')).toBeTruthy();

        expect(classNameFor(getByTestId('persona-sheet-overlay'))).toContain('fixed inset-0');
        // Concept sheet: hairline plate, 28px sheet radius, hairline drag handle.
        expect(classNameFor(getByTestId('persona-sheet-panel'))).toContain(
            'rounded-t-sheet border-t border-hairline-light'
        );
        expect(classNameFor(getByTestId('persona-sheet-panel'))).toContain('pb-5');
        expect(classNameFor(getByTestId('persona-sheet-handle'))).toContain(
            'h-1 w-10 rounded-full bg-hairline-light dark:bg-hairline-dark'
        );
        expect(getByTestId('persona-sheet-cards').props.contentContainerStyle).toMatchObject({
            paddingTop: 16,
        });
        expect(classNameFor(getByTestId('persona-card'))).toContain(
            'w-[82vw] max-w-[340px]'
        );
        expect(classNameFor(getByTestId('persona-card'))).toContain('border-hairline-light');
        expect(classNameFor(getByTestId('persona-card'))).toContain('dark:border-hairline-dark');
        // The default avatar is the line rose in a hairline medallion, not a pink disc.
        expect(classNameFor(getByTestId('persona-avatar-shell'))).toContain('border-hairline-light');
        expect(classNameFor(getByTestId('persona-avatar-shell'))).toContain(
            'dark:border-hairline-dark'
        );
    });
});

describe('NewPersonaCard', () => {
    it('matches the swiped reference dimensions and light/dark text treatment', () => {
        const { getByText, getByTestId } = render(<NewPersonaCard onCreate={jest.fn()} />);

        expect(getByText('New voice')).toBeTruthy();
        expect(getByText('Build your dream team')).toBeTruthy();
        expect(getByText('Create')).toBeTruthy();

        expect(classNameFor(getByTestId('new-persona-card'))).toContain(
            'w-[80vw] max-w-sm'
        );
        expect(classNameFor(getByTestId('new-persona-card'))).toContain('border-hairline-light');
        expect(classNameFor(getByTestId('new-persona-card'))).toContain('dark:border-hairline-dark');
        expect(classNameFor(getByTestId('new-persona-card'))).toContain('h-[380px]');
        expect(classNameFor(getByTestId('new-persona-avatar'))).toContain('bg-surface-2-light');
        expect(classNameFor(getByTestId('new-persona-avatar'))).toContain('dark:bg-surface-2-dark');
        // Concept sheet: both actions are outlined; only the active voice is emphasised.
        expect(classNameFor(getByTestId('new-persona-create'))).toContain('border-bone-light');
        expect(classNameFor(getByTestId('new-persona-create'))).toContain('dark:border-bone-dark');
        expect(classNameFor(getByTestId('new-persona-create'))).not.toContain('bg-bone-light');
    });
});
