/**
 * Tests for services/workers/taskRegistry.ts and the public
 * surface exported by services/workers/index.ts.
 *
 * Mocks `expo-task-manager` and `expo-background-fetch` so we can
 * control availability and observe registration calls. The
 * `registered` flag is module-scoped, so `jest.resetModules()` is
 * used in `beforeEach` to give every test a fresh registry.
 */
jest.mock('expo-task-manager', () => ({
    isAvailableAsync: jest.fn(),
    defineTask: jest.fn(),
}));

jest.mock('expo-background-fetch', () => ({
    BackgroundFetchResult: {
        NewData: 'newData',
        Failed: 'failed',
    },
    registerTaskAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
}));

jest.mock('../../../services/ai/directConfig', () => ({
    getDirectConfig: () => ({
        apiKey: 'sk-test',
        apiBaseUrl: 'https://nano-gpt.com/api/v1',
        model: 'moonshotai/kimi-k2.5:thinking',
        flashModel: 'moonshotai/kimi-k2.5',
    }),
}));

// Suppress the intentional console.info logs from the registry so the
// test output stays clean.
let infoSpy: jest.SpyInstance;
beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
});
afterEach(() => {
    infoSpy.mockRestore();
});

describe('taskRegistry — registerAllWorkers', () => {
    let isAvailableAsync: jest.Mock;
    let defineTask: jest.Mock;
    let registerTaskAsync: jest.Mock;
    let registerAllWorkers: () => Promise<void>;

    beforeEach(() => {
        jest.resetModules();
        const taskManager = jest.requireMock('expo-task-manager') as {
            isAvailableAsync: jest.Mock;
            defineTask: jest.Mock;
        };
        const backgroundFetch = jest.requireMock('expo-background-fetch') as {
            registerTaskAsync: jest.Mock;
        };
        isAvailableAsync = taskManager.isAvailableAsync;
        defineTask = taskManager.defineTask;
        registerTaskAsync = backgroundFetch.registerTaskAsync;
        isAvailableAsync.mockReset();
        defineTask.mockReset();
        registerTaskAsync.mockReset();
        // Re-require the module under test AFTER resetModules so the
        // module-scope `registered` flag starts as `false`.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        ({ registerAllWorkers } = require('../../../services/workers') as {
            registerAllWorkers: () => Promise<void>;
        });
    });

    it('1. is idempotent — calling twice does not double-register and does not throw', async () => {
        isAvailableAsync.mockResolvedValue(true);

        await registerAllWorkers();
        await expect(registerAllWorkers()).resolves.toBeUndefined();

        expect(registerTaskAsync).toHaveBeenCalledTimes(1);
        expect(registerTaskAsync).toHaveBeenCalledWith(
            'blackrosejournal.local-ai-maintenance',
            { minimumInterval: 60 * 15 }
        );
    });

    it('2. is a no-op when TaskManager.isAvailableAsync() returns false', async () => {
        isAvailableAsync.mockResolvedValue(false);

        await registerAllWorkers();

        expect(isAvailableAsync).toHaveBeenCalledTimes(1);
        expect(registerTaskAsync).not.toHaveBeenCalled();
    });

    it('3. defines and registers the local AI maintenance worker', async () => {
        isAvailableAsync.mockResolvedValue(true);

        await registerAllWorkers();

        expect(defineTask).toHaveBeenCalledWith(
            'blackrosejournal.local-ai-maintenance',
            expect.any(Function)
        );
        expect(isAvailableAsync).toHaveBeenCalledTimes(1);
        expect(registerTaskAsync).toHaveBeenCalledTimes(1);
    });
});

describe('workers/index — public surface', () => {
    it('4. WORKER_TASK_NAMES exposes the local AI maintenance worker', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { WORKER_TASK_NAMES } = require('../../../services/workers') as {
            WORKER_TASK_NAMES: Record<string, string>;
        };

        expect(WORKER_TASK_NAMES.LOCAL_AI_MAINTENANCE)
            .toBe('blackrosejournal.local-ai-maintenance');
    });

    it('5. re-exports registerAllWorkers and WORKER_TASK_NAMES from the barrel', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const barrel = require('../../../services/workers') as Record<string, unknown>;

        expect(typeof barrel.registerAllWorkers).toBe('function');
        expect(barrel.WORKER_TASK_NAMES).toBeDefined();
        expect(typeof barrel.WORKER_TASK_NAMES).toBe('object');
    });
});
