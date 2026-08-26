/* eslint-disable import/first */

jest.mock('@/services/supabase/supabaseClient', () => ({
    ensureSupabaseSession: jest.fn(),
}));
jest.mock('@/services/supabase/syncQueue', () => ({
    enqueueSyncTask: jest.fn(),
}));
jest.mock('@/services/supabase/supabaseErrors', () => ({
    logSupabaseError: jest.fn(),
}));

import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureSupabaseSession } from '@/services/supabase/supabaseClient';
import { enqueueSyncTask } from '@/services/supabase/syncQueue';
import {
    fetchRemoteIntentions,
    pushCheckIns,
    queueCheckInUpsert,
} from '../../../services/intentions/intentionsRemote';
import type { IntentionCheckIn } from '../../../services/intentions/intentionsStorage.types';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => { resolve = nextResolve; });
    return { promise, resolve };
}

function accountContext() {
    const controller = new AbortController();
    return {
        context: { accountId: 'account-a', signal: controller.signal },
        controller,
    };
}

const checkIn: IntentionCheckIn = {
    id: 'check-in-a',
    type: 'morning',
    title: 'A check-in',
    summary: 'A summary',
    status: 'completed',
    createdAt: 1,
    updatedAt: 1,
};

describe('intentions remote account context', () => {
    beforeEach(() => jest.clearAllMocks());

    it('rejects a fetch whose session setup completes after account abort', async () => {
        const session = deferred<unknown>();
        jest.mocked(ensureSupabaseSession).mockReturnValue(
            session.promise as ReturnType<typeof ensureSupabaseSession>,
        );
        const { context, controller } = accountContext();

        const pending = fetchRemoteIntentions(context);
        controller.abort();
        session.resolve(null);

        await expect(pending).rejects.toThrow('Account operation was aborted');
    });

    it('rejects a queue helper after its enqueue completes for an aborted account', async () => {
        const queued = deferred<unknown>();
        jest.mocked(enqueueSyncTask).mockReturnValue(
            queued.promise as ReturnType<typeof enqueueSyncTask>,
        );
        const { context, controller } = accountContext();

        const pending = queueCheckInUpsert(checkIn, context);
        controller.abort();
        queued.resolve({});

        await expect(pending).rejects.toThrow('Account operation was aborted');
    });

    it('rejects a push whose network mutation completes after account abort', async () => {
        const mutation = deferred<{ error: null }>();
        const upsert = jest.fn(() => mutation.promise);
        const client = {
            from: jest.fn(() => ({ upsert })),
        } as unknown as SupabaseClient;
        jest.mocked(ensureSupabaseSession).mockResolvedValue(client);
        const { context, controller } = accountContext();

        const pending = pushCheckIns([checkIn], context);
        while (upsert.mock.calls.length === 0) await Promise.resolve();
        controller.abort();
        mutation.resolve({ error: null });

        await expect(pending).rejects.toThrow('Account operation was aborted');
    });
});
