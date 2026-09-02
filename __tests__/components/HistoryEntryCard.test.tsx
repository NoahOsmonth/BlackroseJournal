import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { HistoryEntryCard } from '../../components/history/HistoryEntryCard';
import type { HistoryItem } from '../../hooks/history/historyUtils';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(),
    ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => {
    const React = jest.requireActual('react');
    const { Text } = jest.requireActual('react-native');
    return {
        __esModule: true,
        default: ({ name }: { name: string }) => <Text>{name}</Text>,
    };
});

const journalItem: HistoryItem = {
    id: 'journal-1',
    type: 'journal',
    title: 'Grateful Code',
    summary: 'Feeling progress on personal projects.',
    createdAt: new Date(2026, 5, 1, 17, 12).getTime(),
    sourceId: '1',
};

const morningItem: HistoryItem = {
    id: 'checkin-1',
    type: 'checkin',
    title: 'Wellbeing Important',
    summary: 'Reflected on goals.',
    mood: 'Hopeful',
    createdAt: new Date(2026, 5, 1, 8, 4).getTime(),
    sourceId: 'c1',
    checkInType: 'morning',
};

describe('HistoryEntryCard', () => {
    it('renders journal meta without inventing mood', () => {
        render(<HistoryEntryCard item={journalItem} onPress={jest.fn()} isLast />);
        expect(screen.getByText('Journal')).toBeTruthy();
        expect(screen.getByText('Grateful Code')).toBeTruthy();
        expect(screen.getByText('Feeling progress on personal projects.')).toBeTruthy();
        expect(screen.queryByText('Reflective')).toBeNull();
        expect(screen.getByLabelText('Open Grateful Code')).toBeTruthy();
    });

    it('renders morning ritual meta and real mood only', () => {
        render(<HistoryEntryCard item={morningItem} onPress={jest.fn()} />);
        expect(screen.getByText('Morning')).toBeTruthy();
        expect(screen.getByText('Hopeful')).toBeTruthy();
        expect(screen.getByText('wb-sunny')).toBeTruthy();
    });

    it('invokes onPress when pressed', () => {
        const onPress = jest.fn();
        render(<HistoryEntryCard item={journalItem} onPress={onPress} isLast />);
        fireEvent.press(screen.getByLabelText('Open Grateful Code'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
