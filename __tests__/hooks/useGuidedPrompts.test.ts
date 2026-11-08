import { renderHook } from '@testing-library/react-native';
import { useGuidedPrompts } from '@/hooks/journal/useGuidedPrompts';

const mockUseThisWeek = jest.fn();
jest.mock('@/hooks/journal/useThisWeek', () => ({
    useThisWeek: () => mockUseThisWeek(),
}));

const DAY = '2026-11-08';

describe('useGuidedPrompts', () => {
    it('gives the generic shelf when nothing has been written', () => {
        mockUseThisWeek.mockReturnValue({ ledger: { daysWritten: 0, totalDays: 7, themes: [] }, isLoading: false });
        const { result } = renderHook(() => useGuidedPrompts(DAY, 20));
        expect(result.current.prompts).toHaveLength(3);
        expect(result.current.isPersonalised).toBe(false);
    });

    it('offers the top theme when the writer has one', () => {
        mockUseThisWeek.mockReturnValue({
            ledger: { daysWritten: 4, totalDays: 7, themes: [{ label: 'sleep', days: 3, mentions: 6 }] },
            isLoading: false,
        });
        const { result } = renderHook(() => useGuidedPrompts(DAY, 20));
        expect(result.current.prompts.some((p) => p.id === 'theme-sleep')).toBe(true);
        expect(result.current.isPersonalised).toBe(true);
    });

    it('still shows three prompts when personalised', () => {
        mockUseThisWeek.mockReturnValue({
            ledger: { daysWritten: 4, totalDays: 7, themes: [{ label: 'work', days: 2, mentions: 4 }] },
            isLoading: false,
        });
        const { result } = renderHook(() => useGuidedPrompts(DAY, 20));
        expect(result.current.prompts).toHaveLength(3);
    });

    it('uses the strongest theme, not an arbitrary one', () => {
        mockUseThisWeek.mockReturnValue({
            ledger: {
                daysWritten: 5,
                totalDays: 7,
                themes: [
                    { label: 'running', days: 4, mentions: 9 },
                    { label: 'work', days: 2, mentions: 3 },
                ],
            },
            isLoading: false,
        });
        const { result } = renderHook(() => useGuidedPrompts(DAY, 20));
        expect(result.current.prompts.some((p) => p.id === 'theme-running')).toBe(true);
        expect(result.current.prompts.some((p) => p.id === 'theme-work')).toBe(false);
    });
});
