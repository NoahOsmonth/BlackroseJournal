import { getOrCreateMemoryNamespace, resetMemoryNamespaceAdapter, setMemoryNamespaceAdapter } from '@/services/memory/memoryNamespace';
import { StorageAdapter } from '@/services/journal/journalStorage.types';

function createMockStorage(): StorageAdapter & { data: Record<string, string> } {
    const data: Record<string, string> = {};
    return {
        data,
        getItem: jest.fn(async (key: string) => data[key] || null),
        setItem: jest.fn(async (key: string, value: string) => {
            data[key] = value;
        }),
        removeItem: jest.fn(async (key: string) => {
            delete data[key];
        }),
    };
}

describe('memoryNamespace', () => {
    afterEach(() => {
        resetMemoryNamespaceAdapter();
    });

    it('creates and persists a namespace', async () => {
        const storage = createMockStorage();
        setMemoryNamespaceAdapter(storage);

        const first = await getOrCreateMemoryNamespace();
        const second = await getOrCreateMemoryNamespace();

        expect(first).toBe(second);
        expect(storage.setItem).toHaveBeenCalled();
    });

    it('migrates legacy supermemory container tag', async () => {
        const storage = createMockStorage();
        storage.data['@supermemory_container_tag'] = 'legacy_tag';
        setMemoryNamespaceAdapter(storage);

        const namespace = await getOrCreateMemoryNamespace();

        expect(namespace).toBe('legacy_tag');
        expect(storage.setItem).toHaveBeenCalledWith('@memory_namespace', 'legacy_tag');
    });
});
