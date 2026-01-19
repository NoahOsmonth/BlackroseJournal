describe('setupStagewiseToolbar (native)', () => {
    it('no-ops without throwing', async () => {
        const { setupStagewiseToolbar } = require('../services/stagewiseToolbar');
        await expect(setupStagewiseToolbar()).resolves.toBeUndefined();
    });
});

describe('setupStagewiseToolbar (web)', () => {
    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('initializes toolbar once in development', async () => {
        jest.resetModules();

        const initToolbar = jest.fn();
        const { setupStagewiseToolbar } = require('../services/stagewiseToolbar.web');
        const loadToolbar = async () => ({ initToolbar });
        await setupStagewiseToolbar('development', loadToolbar);
        await setupStagewiseToolbar('development', loadToolbar);

        expect(initToolbar).toHaveBeenCalledTimes(1);
    });

    it('skips initialization outside development', async () => {
        jest.resetModules();

        const initToolbar = jest.fn();
        const { setupStagewiseToolbar } = require('../services/stagewiseToolbar.web');
        const loadToolbar = jest.fn(async () => ({ initToolbar }));
        await setupStagewiseToolbar('production', loadToolbar);

        expect(initToolbar).not.toHaveBeenCalled();
        expect(loadToolbar).not.toHaveBeenCalled();
    });
});
