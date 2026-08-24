/* eslint-disable import/first */

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useHindsightRecallContext } from '../../../hooks/memory/useHindsightRecallContext';

jest.mock('../../../services/memory/hindsight/hindsightRecall', () => ({
    buildHindsightRecallContext: jest.fn(),
}));
jest.mock('../../../services/memory/hindsight/hindsightClient', () => ({
    subscribeHindsightChanges: jest.fn(() => () => undefined),
}));
let mockActiveAccountId: string | null = 'account-a';
let mockAccountListener: ((accountId: string | null) => void) | undefined;
jest.mock('../../../services/account/accountRuntime', () => ({
    getActiveAccountId: jest.fn(() => mockActiveAccountId),
    subscribeActiveAccount: jest.fn((listener: (accountId: string | null) => void) => {
        mockAccountListener = listener;
        return () => { mockAccountListener = undefined; };
    }),
}));
import { buildHindsightRecallContext } from '../../../services/memory/hindsight/hindsightRecall';

const mockedBuild = buildHindsightRecallContext as jest.MockedFunction<typeof buildHindsightRecallContext>;

describe('useHindsightRecallContext', () => {
    beforeEach(() => {
        mockActiveAccountId = 'account-a';
        mockAccountListener = undefined;
        mockedBuild.mockReset();
    });

    it('recalls when a query is provided', async () => {
        mockedBuild.mockResolvedValue('## Relevant long-term context\n- sim=0.91 x');
        const { result } = renderHook(() => useHindsightRecallContext({ query: 'wedding' }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.context).toContain('sim=0.91');
        expect(mockedBuild).toHaveBeenCalledWith('wedding', { limit: undefined });
    });

    it('skips recall when disabled or query is blank', async () => {
        const { result } = renderHook(() => useHindsightRecallContext({ query: '', enabled: true }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(mockedBuild).not.toHaveBeenCalled();
        expect(result.current.context).toBeUndefined();
    });

    it('recallFor resolves a turn-specific query and refreshes context', async () => {
        mockedBuild.mockResolvedValue('## Relevant long-term context\n- sim=0.81 compass');
        const { result } = renderHook(() => useHindsightRecallContext({ query: 'hello' }));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let value: string | undefined;
        await act(async () => {
            value = await result.current.recallFor('brass compass dad');
        });

        expect(value).toBe('## Relevant long-term context\n- sim=0.81 compass');
        expect(mockedBuild).toHaveBeenLastCalledWith('brass compass dad', { limit: undefined });
        expect(result.current.context).toBe('## Relevant long-term context\n- sim=0.81 compass');
    });

    it('shares one in-flight request across concurrent recallFor calls for the same query', async () => {
        let resolveBuild: (value: string | undefined) => void = () => undefined;
        mockedBuild.mockImplementation(
            () =>
                new Promise<string | undefined>((resolve) => {
                    resolveBuild = resolve;
                })
        );
        const { result } = renderHook(() => useHindsightRecallContext({ query: 'brass compass' }));

        let first!: Promise<string | undefined>;
        let second!: Promise<string | undefined>;
        act(() => {
            first = result.current.recallFor('brass compass');
            second = result.current.recallFor('brass compass');
        });

        expect(mockedBuild).toHaveBeenCalledTimes(1);

        let a: string | undefined;
        let b: string | undefined;
        await act(async () => {
            resolveBuild('## Relevant long-term context\n- sim=0.61 compass');
            [a, b] = await Promise.all([first, second]);
        });
        expect(a).toBe('## Relevant long-term context\n- sim=0.61 compass');
        expect(b).toBe(a);
        expect(mockedBuild).toHaveBeenCalledTimes(1);
    });

    it('drops delayed account-a recall instead of caching or publishing it after switching to b', async () => {
        let resolveBuild: (value: string | undefined) => void = () => undefined;
        mockedBuild.mockImplementation(() => new Promise((resolve) => { resolveBuild = resolve; }));
        const { result } = renderHook(() => useHindsightRecallContext({ query: 'shared query' }));
        let accountARecall!: Promise<string | undefined>;
        act(() => {
            accountARecall = result.current.recallFor('shared query');
        });

        act(() => {
            mockActiveAccountId = 'account-b';
            mockAccountListener?.('account-b');
        });
        let accountAValue: string | undefined;
        await act(async () => {
            resolveBuild('## Relevant long-term context\n- account-a secret');
            accountAValue = await accountARecall;
        });
        expect(accountAValue).toBeUndefined();
        await waitFor(() => {
            expect(result.current.context).toBeUndefined();
            expect(result.current.isLoading).toBe(false);
        });

        mockedBuild.mockResolvedValue('## Relevant long-term context\n- account-b memory');
        let accountBValue: string | undefined;
        await act(async () => {
            accountBValue = await result.current.recallFor('shared query');
        });
        expect(accountBValue).toContain('account-b memory');
        expect(mockedBuild).toHaveBeenCalledTimes(2);
    });
});
