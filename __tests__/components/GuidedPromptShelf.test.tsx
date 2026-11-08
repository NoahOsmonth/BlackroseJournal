import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { GuidedPromptShelf } from '@/components/today/GuidedPromptShelf';
import { promptsForDay, moodForHour } from '@/utils/guidedPrompts';

const DAY = '2026-11-08';

describe('GuidedPromptShelf', () => {
    it('offers three ways to start', () => {
        const { getAllByRole } = render(
            <GuidedPromptShelf todayKey={DAY} hour={20} onPick={jest.fn()} />,
        );
        expect(getAllByRole('button')).toHaveLength(3);
    });

    it('shows the prompts picked for the day and hour', () => {
        const expected = promptsForDay(DAY, moodForHour(20), 3);
        const { getByTestId } = render(
            <GuidedPromptShelf todayKey={DAY} hour={20} onPick={jest.fn()} />,
        );
        for (const prompt of expected) {
            expect(getByTestId(`guided-prompt-${prompt.id}`)).toBeTruthy();
        }
    });

    it('hands back the opening line, not the label', () => {
        const onPick = jest.fn();
        const expected = promptsForDay(DAY, moodForHour(20), 3);
        const { getByTestId } = render(
            <GuidedPromptShelf todayKey={DAY} hour={20} onPick={onPick} />,
        );
        fireEvent.press(getByTestId(`guided-prompt-${expected[0].id}`));
        expect(onPick).toHaveBeenCalledWith(expected[0].opening);
    });

    it('reads out as a sentence to a screen reader', () => {
        const expected = promptsForDay(DAY, moodForHour(20), 3);
        const { getByLabelText } = render(
            <GuidedPromptShelf todayKey={DAY} hour={20} onPick={jest.fn()} />,
        );
        expect(getByLabelText(`Start with: ${expected[0].opening}`)).toBeTruthy();
    });
});
