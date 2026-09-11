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
    it('renders a running tool row with label and a11y', () => {
        const { getByLabelText, getByText } = render(
            <AgentToolActivity toolActivity={[makeCall()]} />
        );

        expect(getByLabelText('Tool Reading a day: running')).toBeTruthy();
        expect(getByText('Reading a day')).toBeTruthy();
        expect(getByText('yesterday')).toBeTruthy();
    });

    it('renders ok and error statuses', () => {
        const { getByLabelText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({ toolCallId: 'a', status: 'ok', durationMs: 42 }),
                    makeCall({ toolCallId: 'b', label: 'Searching your history', status: 'error' }),
                ]}
            />
        );

        expect(getByLabelText('Tool Reading a day: ok')).toBeTruthy();
        expect(getByLabelText('Tool Searching your history: error')).toBeTruthy();
    });

    it('expands a finished row to show result preview', () => {
        const { getByLabelText, getByText, queryByText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({
                        status: 'ok',
                        resultPreview: 'summary: Sleep was rough',
                        durationMs: 12,
                    }),
                ]}
            />
        );

        expect(queryByText('summary: Sleep was rough')).toBeNull();
        fireEvent.press(getByLabelText('Expand Reading a day'));
        expect(getByText('summary: Sleep was rough')).toBeTruthy();
    });

    it('collapses to a compact chip when prose is streaming', () => {
        const { getByLabelText, queryByLabelText } = render(
            <AgentToolActivity
                toolActivity={[
                    makeCall({ toolCallId: 'a', status: 'ok' }),
                    makeCall({ toolCallId: 'b', status: 'ok', label: 'Checking the time' }),
                ]}
                compact
            />
        );

        const chip = getByLabelText('Used 2 tools. Show details.');
        expect(chip).toBeTruthy();
        expect(queryByLabelText('Tool Reading a day: ok')).toBeNull();

        fireEvent.press(chip);
        expect(getByLabelText('Tool Reading a day: ok')).toBeTruthy();
    });

    it('uses both light and dark hairline tokens on the tool row', () => {
        const { getByLabelText } = render(
            <AgentToolActivity toolActivity={[makeCall({ status: 'ok' })]} />
        );
        const row = getByLabelText('Tool Reading a day: ok');
        const className = String(row.props.className ?? '');
        expect(className).toContain('border-hairline-light');
        expect(className).toContain('dark:border-hairline-dark');
    });

    it('stays expanded (not a chip) when compact is false during live work', () => {
        const { getByLabelText, queryByLabelText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'running' })]}
                compact={false}
            />
        );
        expect(getByLabelText('Tool Reading a day: running')).toBeTruthy();
        expect(queryByLabelText(/Used \d+ tools/)).toBeNull();
    });

    it('renders nothing for empty activity', () => {
        const { toJSON } = render(<AgentToolActivity toolActivity={[]} />);
        expect(toJSON()).toBeNull();
    });

    it('shows the working status line above the tool rows while live', () => {
        const { getByLabelText, getByText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'running' })]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me go dig rather than guess.' }]}
            />
        );

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
            />
        );

        expect(getByText('Looking at that day.')).toBeTruthy();
        expect(queryByText('Digging.')).toBeNull();
    });

    it('renders status lines with no tools at all (promise-only turn)', () => {
        const { getByText, queryByLabelText } = render(
            <AgentToolActivity
                toolActivity={[]}
                statusLines={[{ id: 't1', round: 1, text: 'One sec — checking yesterday.' }]}
            />
        );

        expect(getByText('One sec — checking yesterday.')).toBeTruthy();
        expect(queryByLabelText(/Used \d+ tools/)).toBeNull();
    });

    it('never shows status lines on the committed compact chip', () => {
        const { getByLabelText, queryByText } = render(
            <AgentToolActivity
                toolActivity={[makeCall({ status: 'ok' })]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me dig.' }]}
                compact
            />
        );

        expect(getByLabelText('Used 1 tool. Show details.')).toBeTruthy();
        expect(queryByText('Let me dig.')).toBeNull();
    });

    it('renders nothing (not a chip) when compact and only a status line exists', () => {
        const { toJSON } = render(
            <AgentToolActivity
                toolActivity={[]}
                statusLines={[{ id: 't1', round: 1, text: 'Let me dig.' }]}
                compact
            />
        );
        expect(toJSON()).toBeNull();
    });
});
