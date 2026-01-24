import { act, renderHook } from '@testing-library/react-native';
import { useIntentions } from '../../hooks/intentions/useIntentions';
import {
    createIntention,
    deleteIntention,
    listIntentions,
} from '../../services/intentions/intentionsStorage';

jest.mock('../../services/intentions/intentionsStorage', () => ({
    listIntentions: jest.fn(() => Promise.resolve([])),
    createIntention: jest.fn(),
    updateIntention: jest.fn(),
    archiveIntention: jest.fn(),
    deleteIntention: jest.fn(() => Promise.resolve(true)),
}));

describe('useIntentions', () => {
    it('removes an intention and refreshes list', async () => {
        const { result } = renderHook(() => useIntentions());

        await act(async () => {
            await result.current.remove('intention-1');
        });

        expect(deleteIntention).toHaveBeenCalledWith('intention-1');
        expect(listIntentions).toHaveBeenCalled();
    });

    it('creates an intention and refreshes list', async () => {
        (createIntention as jest.Mock).mockResolvedValue({
            id: 'intention-2',
            title: 'Test',
            description: 'Desc',
            area: 'wellbeing',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        const { result } = renderHook(() => useIntentions());

        await act(async () => {
            await result.current.create({
                title: 'Test',
                description: 'Desc',
                area: 'wellbeing',
            });
        });

        expect(createIntention).toHaveBeenCalled();
        expect(listIntentions).toHaveBeenCalled();
    });
});
