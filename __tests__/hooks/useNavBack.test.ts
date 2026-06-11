import { act, renderHook } from '@testing-library/react-native';

import { useNavBack } from '../../hooks/navigation/useNavBack';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
    useRouter: () => ({
        back: mockBack,
        canGoBack: mockCanGoBack,
        replace: mockReplace,
    }),
}));

describe('useNavBack', () => {
    beforeEach(() => {
        mockBack.mockClear();
        mockCanGoBack.mockReset();
        mockReplace.mockClear();
    });

    it('uses router.back when the stack can go back', () => {
        mockCanGoBack.mockReturnValue(true);
        const { result } = renderHook(() => useNavBack('/(tabs)/entries'));

        act(() => result.current());

        expect(mockBack).toHaveBeenCalledTimes(1);
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('replaces with the fallback route when opened without a back stack', () => {
        mockCanGoBack.mockReturnValue(false);
        const { result } = renderHook(() => useNavBack('/(tabs)/entries'));

        act(() => result.current());

        expect(mockBack).not.toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/entries');
    });
});
