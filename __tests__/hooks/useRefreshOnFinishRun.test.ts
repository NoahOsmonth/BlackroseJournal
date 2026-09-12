import { renderHook } from '@testing-library/react-native';
import { act } from 'react-test-renderer';

import { useRefreshOnFinishRun } from '../../hooks/journal/useRefreshOnFinishRun';
import type { FinishBackgroundStatus } from '../../services/journal/finishBackgroundStore';
import { FINISH_BACKGROUND_STEPS } from '../../services/journal/finishBackgroundStore';

const mockStatus: { current: FinishBackgroundStatus | null } = { current: null };

jest.mock('../../hooks/journal/useFinishBackgroundStatus', () => ({
    useFinishBackgroundStatus: () => {
        const status = mockStatus.current;
        const settled = status ? Object.keys(status.done).length : 0;
        return {
            status,
            isRunning: status !== null && settled < 6,
            isDone: status !== null && settled >= 6,
        };
    },
}));

function settledRun(entryId: string, runId: string): FinishBackgroundStatus {
    const done = Object.fromEntries(
        FINISH_BACKGROUND_STEPS.map((step) => [step, true]),
    ) as FinishBackgroundStatus['done'];
    return { runId, entryId, startedAt: 1_000, done };
}

describe('useRefreshOnFinishRun', () => {
    beforeEach(() => {
        mockStatus.current = null;
    });

    it('refreshes once per settled run even when refresh changes identity', () => {
        mockStatus.current = settledRun('entry-1', 'run-1');
        const refresh = jest.fn();
        // A fresh arrow per render mirrors the instability that caused the loop.
        const { rerender } = renderHook(() => useRefreshOnFinishRun(() => refresh()));

        expect(refresh).toHaveBeenCalledTimes(1);

        rerender({});
        rerender({});

        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('refreshes again when a new run settles', () => {
        mockStatus.current = settledRun('entry-1', 'run-1');
        const refresh = jest.fn();
        const { rerender } = renderHook(() => useRefreshOnFinishRun(refresh));

        expect(refresh).toHaveBeenCalledTimes(1);

        mockStatus.current = settledRun('entry-1', 'run-2');
        act(() => {
            rerender({});
        });

        expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('ignores settled runs for another entry when an entryId is given', () => {
        mockStatus.current = settledRun('entry-other', 'run-1');
        const refresh = jest.fn();

        renderHook(() => useRefreshOnFinishRun(refresh, 'entry-1'));

        expect(refresh).not.toHaveBeenCalled();
    });

    it('does nothing while no run has settled', () => {
        const refresh = jest.fn();

        const { rerender } = renderHook(() => useRefreshOnFinishRun(refresh));
        rerender({});

        expect(refresh).not.toHaveBeenCalled();
    });
});
