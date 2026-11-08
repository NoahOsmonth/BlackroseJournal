import { isEmptyReply, nextEmptyReplyStep, type EmptyReplyContext } from '@/utils/emptyReplyRetry';

function ctx(overrides: Partial<EmptyReplyContext> = {}): EmptyReplyContext {
    return {
        triedWithoutTools: false,
        triedFallback: false,
        fallbackModels: [],
        toolsWereOff: false,
        ...overrides,
    };
}

describe('isEmptyReply', () => {
    it('treats real words as an answer', () => {
        expect(isEmptyReply('It sounds like a heavy week.')).toBe(false);
    });

    it('treats blank and whitespace as no answer', () => {
        expect(isEmptyReply('')).toBe(true);
        expect(isEmptyReply('   \n\t  ')).toBe(true);
    });

    it('treats invisible characters as no answer', () => {
        expect(isEmptyReply('\u200B\uFEFF')).toBe(true);
    });

    it('treats punctuation alone as an answer someone wrote', () => {
        expect(isEmptyReply('...')).toBe(false);
    });
});

describe('nextEmptyReplyStep', () => {
    it('retries without tools first', () => {
        expect(nextEmptyReplyStep(ctx()).kind).toBe('retry-without-tools');
    });

    it('does not retry without tools when tools were already off', () => {
        expect(nextEmptyReplyStep(ctx({ toolsWereOff: true })).kind).toBe('give-up');
    });

    it('does not retry without tools twice', () => {
        expect(nextEmptyReplyStep(ctx({ triedWithoutTools: true })).kind).toBe('give-up');
    });

    it('uses the fallback AI option after the no-tools attempt', () => {
        const step = nextEmptyReplyStep(ctx({
            triedWithoutTools: true,
            fallbackModels: ['backup-model'],
        }));
        expect(step).toEqual({ kind: 'retry-with-fallback-model', model: 'backup-model' });
    });

    it('goes straight to the fallback when tools were already off', () => {
        const step = nextEmptyReplyStep(ctx({ toolsWereOff: true, fallbackModels: ['backup-model'] }));
        expect(step).toEqual({ kind: 'retry-with-fallback-model', model: 'backup-model' });
    });

    it('prefers the first configured backup', () => {
        const step = nextEmptyReplyStep(ctx({
            triedWithoutTools: true,
            fallbackModels: ['first', 'second'],
        }));
        expect(step).toEqual({ kind: 'retry-with-fallback-model', model: 'first' });
    });

    it('skips a blank entry in the backup list', () => {
        const step = nextEmptyReplyStep(ctx({
            triedWithoutTools: true,
            fallbackModels: ['  ', 'real-one'],
        }));
        expect(step).toEqual({ kind: 'retry-with-fallback-model', model: 'real-one' });
    });

    it('gives up when the fallback was already tried', () => {
        expect(nextEmptyReplyStep(ctx({
            triedWithoutTools: true,
            triedFallback: true,
            fallbackModels: ['backup-model'],
        })).kind).toBe('give-up');
    });

    it('gives up when nothing more can be tried', () => {
        expect(nextEmptyReplyStep(ctx({ triedWithoutTools: true })).kind).toBe('give-up');
    });

    it('never loops: every starting point reaches give-up', () => {
        const start = ctx();
        let state = start;
        for (let i = 0; i < 10; i += 1) {
            const step = nextEmptyReplyStep(state);
            if (step.kind === 'give-up') return;
            state = {
                ...state,
                triedWithoutTools: state.triedWithoutTools || step.kind === 'retry-without-tools',
                triedFallback: state.triedFallback || step.kind === 'retry-with-fallback-model',
            };
        }
        throw new Error('empty-reply retry never reached give-up');
    });
});
