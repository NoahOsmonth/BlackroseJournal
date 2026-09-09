import {
    clearFinishBackground,
    getFinishBackgroundStatus,
    settleFinishBackground,
    startFinishBackground,
    subscribeFinishBackground,
} from '../../../services/journal/finishBackgroundStore';

describe('finishBackgroundStore', () => {
    beforeEach(() => {
        clearFinishBackground();
    });

    afterEach(() => {
        clearFinishBackground();
    });

    it('starts a run with no settled steps and notifies subscribers', () => {
        const listener = jest.fn();
        subscribeFinishBackground(listener);

        const runId = startFinishBackground('entry-1');

        expect(runId).toMatch(/^finish-/);
        expect(getFinishBackgroundStatus()).toEqual({
            runId,
            entryId: 'entry-1',
            startedAt: expect.any(Number),
            done: {},
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('records settled steps and keeps the first error', () => {
        const runId = startFinishBackground('entry-1');
        settleFinishBackground(runId, 'analysis');
        settleFinishBackground(runId, 'memories', 'boom');

        const status = getFinishBackgroundStatus();
        expect(status?.done).toEqual({ analysis: true, memories: true });
        expect(status?.error).toBe('boom');
    });

    it('ignores settles for a stale runId', () => {
        const runId = startFinishBackground('entry-1');
        settleFinishBackground('stale-run', 'analysis');
        expect(getFinishBackgroundStatus()?.done).toEqual({});
        settleFinishBackground(runId, 'analysis');
        expect(getFinishBackgroundStatus()?.done).toEqual({ analysis: true });
    });

    it('clears the run and notifies listeners with null', () => {
        const listener = jest.fn();
        subscribeFinishBackground(listener);
        startFinishBackground('entry-1');
        listener.mockClear();

        clearFinishBackground();

        expect(getFinishBackgroundStatus()).toBeNull();
        expect(listener).toHaveBeenCalledWith(null);
    });

    it('unsubscribes listeners', () => {
        const listener = jest.fn();
        const unsubscribe = subscribeFinishBackground(listener);
        unsubscribe();

        startFinishBackground('entry-1');

        expect(listener).not.toHaveBeenCalled();
    });
});