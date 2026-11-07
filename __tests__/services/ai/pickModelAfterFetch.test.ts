import { pickModelAfterFetch, CustomAiModel } from '@/services/ai/customModels';

function model(id: string): CustomAiModel {
    return {
        id,
        name: id,
        ownedBy: 'test',
        created: 0,
        contextWindow: 128000,
        contextWindowSource: 'fallback',
    };
}

const CATALOGUE = [model('aihorde/526Mix-Animated'), model('auto/best-chat')];

describe('pickModelAfterFetch', () => {
    it('keeps the chosen AI when the refreshed list still has it', () => {
        expect(pickModelAfterFetch(CATALOGUE, 'auto/best-chat')).toBe('auto/best-chat');
    });

    it('keeps a chosen AI that the refreshed list left out', () => {
        // Regression for DEF-030: a service address can list a narrower
        // catalogue than it actually serves, so a refresh must never quietly
        // throw away the AI the writer picked.
        expect(pickModelAfterFetch(CATALOGUE, 'global:hy4free')).toBe('global:hy4free');
    });

    it('falls back to the first option only when nothing was chosen', () => {
        expect(pickModelAfterFetch(CATALOGUE, null)).toBe('aihorde/526Mix-Animated');
    });

    it('uses the starter AI when the writer has not chosen yet', () => {
        expect(pickModelAfterFetch(CATALOGUE, null, 'auto/best-chat')).toBe('auto/best-chat');
    });

    it('has nothing to offer when the list is empty and nothing was chosen', () => {
        expect(pickModelAfterFetch([], null)).toBeNull();
    });
});
