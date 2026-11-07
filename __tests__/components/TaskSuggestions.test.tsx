import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { TaskSuggestions } from '@/components/entries/TaskSuggestions';
import type { EntryTaskSuggestions } from '@/hooks/tasks/useEntryTaskSuggestions';

function makeState(overrides: Partial<EntryTaskSuggestions> = {}): EntryTaskSuggestions {
    return {
        suggestions: ['Call the roofer', 'Book a haircut'],
        isLoading: false,
        kept: [],
        keep: jest.fn(),
        dismiss: jest.fn(),
        error: null,
        ...overrides,
    };
}

describe('TaskSuggestions', () => {
    it('asks a plain question and lists what it found', () => {
        const screen = render(<TaskSuggestions state={makeState()} />);

        expect(screen.getByText('Anything to do from this?')).toBeTruthy();
        expect(screen.getByText('Call the roofer')).toBeTruthy();
        expect(screen.getByText('Book a haircut')).toBeTruthy();
    });

    it('adds a task only when the writer taps it', () => {
        const state = makeState();
        const screen = render(<TaskSuggestions state={state} />);

        expect(state.keep).not.toHaveBeenCalled();
        fireEvent.press(screen.getByLabelText('Add task: Call the roofer'));

        expect(state.keep).toHaveBeenCalledWith('Call the roofer');
    });

    it('shows nothing at all when there is nothing to offer', () => {
        const screen = render(<TaskSuggestions state={makeState({ suggestions: [] })} />);

        expect(screen.toJSON()).toBeNull();
    });

    it('says what was added, in the writer\u2019s words', () => {
        const screen = render(<TaskSuggestions state={makeState({
            suggestions: ['Book a haircut'],
            kept: ['Call the roofer'],
        })} />);

        expect(screen.getByText('Added \u201cCall the roofer\u201d to your goals.')).toBeTruthy();
    });

    it('counts more than one added task', () => {
        const screen = render(<TaskSuggestions state={makeState({
            suggestions: [],
            kept: ['Call the roofer', 'Book a haircut'],
        })} />);

        expect(screen.getByText('Added 2 tasks to your goals.')).toBeTruthy();
    });

    it('lets the writer put the suggestion away', () => {
        const state = makeState();
        const screen = render(<TaskSuggestions state={state} />);

        fireEvent.press(screen.getByLabelText('Hide task suggestions'));

        expect(state.dismiss).toHaveBeenCalledTimes(1);
    });

    it('shows a plain sentence while it looks', () => {
        const screen = render(<TaskSuggestions state={makeState({
            suggestions: [], isLoading: true,
        })} />);

        expect(screen.getByText('Looking for tasks in what you wrote\u2026')).toBeTruthy();
    });
});
