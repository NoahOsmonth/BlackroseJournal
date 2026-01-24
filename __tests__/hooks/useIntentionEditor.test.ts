import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useIntentionEditor } from '../../hooks/intentions/useIntentionEditor';
import { getIntention, updateIntention } from '../../services/intentions/intentionsStorage';

jest.mock('../../services/intentions/intentionsStorage', () => ({
    getIntention: jest.fn(),
    updateIntention: jest.fn(),
}));

describe('useIntentionEditor', () => {
    it('loads intention values and saves updates', async () => {
        (getIntention as jest.Mock).mockResolvedValue({
            id: 'intention-1',
            title: 'Original',
            description: 'Original description',
            area: 'wellbeing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
        (updateIntention as jest.Mock).mockResolvedValue({
            id: 'intention-1',
            title: 'Updated',
            description: 'Updated description',
            area: 'wellbeing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        const { result } = renderHook(() => useIntentionEditor('intention-1'));

        await waitFor(() => {
            expect(result.current.values.title).toBe('Original');
        });

        act(() => {
            result.current.setValues({
                title: 'Updated',
                description: 'Updated description',
            });
        });

        await act(async () => {
            await result.current.save();
        });

        expect(updateIntention).toHaveBeenCalledWith('intention-1', {
            title: 'Updated',
            description: 'Updated description',
        });
    });
});
