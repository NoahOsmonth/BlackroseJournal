import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { IntentionActionCard } from '../../../components/today/IntentionActionCard';

jest.mock('../../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
    MaterialIcons: () => null,
}));

describe('IntentionActionCard', () => {
    it('renders title, subtitle, and a minimum 140dp height', () => {
        render(
            <IntentionActionCard
                title={"Morning\nIntention"}
                subtitle="Start your day"
                icon={<></>}
                onPress={jest.fn()}
                isCompleted={false}
            />
        );

        expect(screen.getByText(/Morning/)).toBeTruthy();
        expect(screen.getByText(/Intention/)).toBeTruthy();
        expect(screen.getByText('Start your day')).toBeTruthy();
        expect(screen.getByLabelText('Morning Intention').props.className)
            .toContain('min-h-[140px]');
    });

    it('renders the completed checkmark instead of the subtitle', () => {
        render(
            <IntentionActionCard
                title={"Evening\nReflection"}
                subtitle="Reflect & unwind"
                icon={<></>}
                onPress={jest.fn()}
                isCompleted={true}
            />
        );

        expect(screen.getByText(/Evening/)).toBeTruthy();
        expect(screen.getByText(/Reflection/)).toBeTruthy();
        expect(screen.queryByText('Reflect & unwind')).toBeNull();
    });
});
