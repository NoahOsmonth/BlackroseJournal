import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AgentToolActivity } from '../../components/ai/AgentToolActivity';
import type { AgentToolCallSnapshot } from '../../services/ai/agentEvents';

function makeCall(overrides: Partial<AgentToolCallSnapshot> = {}): AgentToolCallSnapshot {
    return {
        toolCallId: 'call_1',
        name: 'get_day',
        label: 'Reading a day',
        argsPreview: 'yesterday',
        status: 'running',
        round: 1,
        ...overrides,
    };
}

describe('AgentToolActivity', () => {
    it('renders nothing when the turn has no work to show', () => {
        const { toJSON } = render(<AgentToolActivity toolActivity={[]} />);
        expect(toJSON()).toBeNull();
    });

    it('renders nothing for a status line alone once the turn is no longer live', () => {
        const { toJSON } = render(
            <AgentToolActivity
                toolActivity={[]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me dig.' }]}
            />
        );
        expect(toJSON()).toBeNull();
    });

    it('opens itself while a tool is running', () => {
        const { getByLabelText, getByText } = render(
            <AgentToolActivity toolActivity={[makeCall()]} />
        );

        expect(getByLabelText('Tool Reading a day: running')).toBeTruthy();
        expect(getByText('Reading a day')).toBeTruthy();
        expect(getByText('yesterday')).toBeTruthy();
    });

    it('collapses a finished turn behind one summary line', () => {
        const { getByText, queryByLabelText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({ toolCallId: 'a', status: 'ok', durationMs: 42 }),
                    makeCall({ toolCallId: 'b', status: 'ok', label: 'Checking the time' }),
                ]}
            />
        );

        expect(getByText('Used 2 tools · 42ms')).toBeTruthy();
        expect(queryByLabelText('Tool Reading a day: ok')).toBeNull();
    });

    it('expands the summary line to reveal the tools that ran', () => {
        const { getByLabelText } = render(
            <AgentToolActivity toolActivity={[makeCall({ status: 'ok' })]} />
        );

        fireEvent.press(getByLabelText('Show thinking and tools'));
        expect(getByLabelText('Tool Reading a day: ok')).toBeTruthy();
    });

    it('counts reasoning in the summary line', () => {
        const { getByText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'ok' })]}
                reasoning="She sounded tired."
            />
        );

        expect(getByText('Thought it through · Used 1 tool')).toBeTruthy();
    });

    it('shows the reasoning itself only once expanded', () => {
        const { getByLabelText, queryByLabelText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'ok' })]}
                reasoning="She sounded tired."
            />
        );

        expect(queryByLabelText('Companion reasoning')).toBeNull();
        fireEvent.press(getByLabelText('Show thinking and tools'));
        expect(getByLabelText('Companion reasoning')).toBeTruthy();
    });

    it('renders a tool row per status with its own a11y label', () => {
        const { getByLabelText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({ toolCallId: 'a', status: 'ok', durationMs: 42 }),
                    makeCall({ toolCallId: 'b', label: 'Searching your history', status: 'error' }),
                ]}
                isStreaming
            />
        );

        expect(getByLabelText('Tool Reading a day: ok')).toBeTruthy();
        expect(getByLabelText('Tool Searching your history: error')).toBeTruthy();
    });

    it('expands a finished tool row to show its result preview', () => {
        const { getByLabelText, getByText, queryByText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({
                        status: 'ok',
                        resultPreview: 'summary: Sleep was rough',
                        durationMs: 12,
                    }),
                ]}
                isStreaming
            />
        );

        expect(queryByText('summary: Sleep was rough')).toBeNull();
        fireEvent.press(getByLabelText('Expand Reading a day'));
        expect(getByText('summary: Sleep was rough')).toBeTruthy();
    });

    it('hangs the detail off the companion rail instead of drawing a second one', () => {
        const { getByLabelText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'ok' })]}
                reasoning="thought about it"
                isStreaming
            />
        );
        // Walk up from the tool row to the detail block that holds it. The
        // companion column already draws the bone rail, so a second rule 12px
        // inside it reads as noise — indent only.
        let block = getByLabelText('Tool Reading a day: ok').parent;
        while (block && !String(block.props.className ?? '').includes('pl-3')) {
            block = block.parent;
        }
        const className = String(block?.props.className ?? '');
        expect(className).toContain('pl-3');
        expect(className).not.toContain('border-l');
    });

    it('paints the reasoning with both scheme tokens', () => {
        const { getByLabelText } = render(
            <AgentToolActivity toolActivity={[]} reasoning="thought about it" isStreaming />
        );
        const className = String(getByLabelText('Companion reasoning').props.className ?? '');
        expect(className).toContain('text-bone-light');
        expect(className).toContain('dark:text-bone-dark');
    });

    it('says Working… and shows the status line while the turn is live', () => {
        const { getByLabelText, getByText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'running' })]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me go dig rather than guess.' }]}
                isStreaming
            />
        );

        expect(getByText('Working…')).toBeTruthy();
        expect(getByText('Let me go dig rather than guess.')).toBeTruthy();
        expect(getByLabelText('Working: Let me go dig rather than guess.')).toBeTruthy();
        expect(getByLabelText('Tool Reading a day: running')).toBeTruthy();
    });

    it('renders the newest status line only', () => {
        const { queryByText, getByText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'ok' })]}
                statusLines={[
                    { id: 't1', round: 1, text: 'Digging.' },
                    { id: 't2', round: 2, text: 'Looking at that day.' },
                ]}
                isStreaming
            />
        );

        expect(getByText('Looking at that day.')).toBeTruthy();
        expect(queryByText('Digging.')).toBeNull();
    });

    it('renders a status line with no tools at all (promise-only turn)', () => {
        const { getByText } = render(
            <AgentToolActivity
                toolActivity={[]}
                statusLines={[{ id: 't1', round: 1, text: 'One sec — checking yesterday.' }]}
                isStreaming
            />
        );

        expect(getByText('One sec — checking yesterday.')).toBeTruthy();
    });
});
