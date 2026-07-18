import { MEMORY_ATOMS_PAGE_SIZE } from '@/components/memory/MemoryHubScreen';

describe('memory list pagination constant', () => {
    it('pages memories in a small batch so the hub is not an infinite wall of cards', () => {
        expect(MEMORY_ATOMS_PAGE_SIZE).toBeGreaterThanOrEqual(5);
        expect(MEMORY_ATOMS_PAGE_SIZE).toBeLessThanOrEqual(12);
    });
});
