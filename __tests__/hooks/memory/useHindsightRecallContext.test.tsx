/* eslint-disable import/first */

import { renderHook, waitFor } from '@testing-library/react-native';
import { useHindsightRecallContext } from '../../../hooks/memory/useHindsightRecallContext';

jest.mock('../../../services/memory/hindsight/hindsightRecall', () => ({
    buildHindsightRecallContext: jest.fn(),
}));
jest.mock('../../../services/memory/hindsight/hindsightClient', () => ({
    subscribeHindsightChanges: jest.fn(() => () => undefined),
}));
import { buildHindsightRecallContext } from '../../../services/memory/hindsight/hindsightRecall';

const mockedBuild = buildHindsightRecallContext as jest.MockedFunction<typeof buildHindsightRecallContext>;

describe('useHindsightRecallContext', () => {
    beforeEach(() => mockedBuild.mockReset());

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

        const value = await result.current.recallFor('brass compass dad');

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

        const first = result.current.recallFor('brass compass');
        const second = result.current.recallFor('brass compass');

        expect(mockedBuild).toHaveBeenCalledTimes(1);

        resolveBuild('## Relevant long-term context\n- sim=0.61 compass');

        const [a, b] = await Promise.all([first, second]);
        expect(a).toBe('## Relevant long-term context\n- sim=0.61 compass');
        expect(b).toBe(a);
        expect(mockedBuild).toHaveBeenCalledTimes(1);
    });
});
