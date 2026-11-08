import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GuidedPromptShelf } from '@/components/today/GuidedPromptShelf';
import { promptsForDay, moodForHour } from '@/utils/guidedPrompts';

const DAY = '2026-11-08';
const SHELF = promptsForDay(DAY, moodForHour(20), 3);

describe('GuidedPromptShelf', () => {
    it('offers three ways to start', () => {
        const { getAllByRole } = render(<GuidedPromptShelf prompts={SHELF} onPick={jest.fn()} />);
        expect(getAllByRole('button')).toHaveLength(3);
    });

    it('shows exactly the prompts it is given', () => {
        const { getByTestId } = render(<GuidedPromptShelf prompts={SHELF} onPick={jest.fn()} />);
        for (const prompt of SHELF) {
            expect(getByTestId(`guided-prompt-${prompt.id}`)).toBeTruthy();
        }
    });

    it('hands back the opening line, not the label', () => {
        const onPick = jest.fn();
        const { getByTestId } = render(<GuidedPromptShelf prompts={SHELF} onPick={onPick} />);
        fireEvent.press(getByTestId(`guided-prompt-${SHELF[0].id}`));
        expect(onPick).toHaveBeenCalledWith(SHELF[0].opening);
    });

    it('reads out as a sentence to a screen reader', () => {
        const { getByLabelText } = render(<GuidedPromptShelf prompts={SHELF} onPick={jest.fn()} />);
        expect(getByLabelText(`Start with: ${SHELF[0].opening}`)).toBeTruthy();
    });

    it('renders nothing when there is nothing to offer', () => {
        const { toJSON } = render(<GuidedPromptShelf prompts={[]} onPick={jest.fn()} />);
        expect(toJSON()).toBeNull();
    });
});
