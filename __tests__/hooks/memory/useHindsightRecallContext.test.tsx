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
});
