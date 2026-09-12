import { withTimeout } from '../../utils/async';

describe('withTimeout', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('resolves with the underlying value when it settles in time', async () => {
        const pending = withTimeout(Promise.resolve('done'), 1000, 'Entry title');
        await expect(pending).resolves.toBe('done');
    });

    it('rejects with a labelled error once the ceiling passes', async () => {
        const never = new Promise<string>(() => { /* never settles */ });
        const pending = withTimeout(never, 8000, 'Entry title');
        const assertion = expect(pending).rejects.toThrow('Entry title timed out after 8000ms');

        jest.advanceTimersByTime(8000);
        await assertion;
    });

    it('forwards the original rejection instead of the timeout error', async () => {
        const failing = Promise.reject(new Error('provider down'));

        await expect(withTimeout(failing, 8000, 'Entry title')).rejects.toThrow('provider down');
    });
});
