import { renderHook, waitFor } from '@testing-library/react-native';
import { useIntentionDetail } from '../../hooks/intentions/useIntentionDetail';
import { getIntention, listCheckInsByIntention } from '../../services/intentions/intentionsStorage';

jest.mock('../../services/intentions/intentionsStorage', () => ({
    getIntention: jest.fn(),
    listCheckInsByIntention: jest.fn(),
}));

describe('useIntentionDetail', () => {
    it('selects the latest completed check-in', async () => {
        (getIntention as jest.Mock).mockResolvedValue({
            id: 'intention-1',
            title: 'Test',
            description: 'Desc',
            area: 'wellbeing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        (listCheckInsByIntention as jest.Mock).mockResolvedValue([
            {
                id: 'checkin-draft',
                status: 'draft',
                updatedAt: Date.now() + 1000,
                createdAt: Date.now() + 1000,
            },
            {
                id: 'checkin-completed',
                status: 'completed',
                updatedAt: Date.now(),
                createdAt: Date.now(),
            },
        ]);

        const { result } = renderHook(() => useIntentionDetail('intention-1'));

        await waitFor(() => {
            expect(result.current.latestCheckIn?.id).toBe('checkin-completed');
        });
    });
});
