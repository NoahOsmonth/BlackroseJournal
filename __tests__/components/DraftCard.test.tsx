import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DraftCard } from '../../components/drafts/DraftCard';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'dark',
}));

jest.mock('../../components/ui/AnimatedRemove', () => ({
    AnimatedRemove: ({ children }: { children: React.ReactNode }) => {
        const React = jest.requireActual('react');
        const { View } = jest.requireActual('react-native');
        return <View>{children}</View>;
    },
}));

describe('DraftCard', () => {
    it('shows sentence-case provenance, serif title, and relative stamp', () => {
        render(
            <DraftCard
                label="Intention check-in"
                title="Wellbeing and personal goals"
                timeLabel="Today, 5:17 pm"
                removing={false}
                onDelete={jest.fn()}
                onRestore={jest.fn()}
                onExited={jest.fn()}
            />
        );

        expect(screen.getByText('Intention check-in')).toBeTruthy();
        expect(screen.getByText('Wellbeing and personal goals')).toBeTruthy();
        expect(screen.getByText('Today, 5:17 pm')).toBeTruthy();
        // Text verbs only — no icon buttons in the concept's footer row.
        expect(screen.getByText('Delete')).toBeTruthy();
        expect(screen.getByText('Restore')).toBeTruthy();
    });

    it('fires delete and restore from the footer actions', () => {
        const onDelete = jest.fn();
        const onRestore = jest.fn();

        render(
            <DraftCard
                label="Journal"
                title="Untitled draft"
                timeLabel="Yesterday, 9:02 pm"
                removing={false}
                onDelete={onDelete}
                onRestore={onRestore}
                onExited={jest.fn()}
            />
        );

        fireEvent.press(screen.getByLabelText('Delete'));
        fireEvent.press(screen.getByLabelText('Restore'));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it('omits the restore verb for autosaved sessions', () => {
        render(
            <DraftCard
                label="Autosaved"
                title="A conversation still open"
                timeLabel="Today, 8:41 am"
                removing={false}
                onDelete={jest.fn()}
                onExited={jest.fn()}
            />
        );

        expect(screen.getByText('Delete')).toBeTruthy();
        expect(screen.queryByText('Restore')).toBeNull();
    });
});
