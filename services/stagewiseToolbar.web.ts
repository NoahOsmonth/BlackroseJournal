const stagewiseConfig = {
    plugins: [],
};

type ToolbarModule = {
    initToolbar: (config: typeof stagewiseConfig) => void;
};

type ToolbarLoader = () => Promise<ToolbarModule>;

const defaultToolbarLoader: ToolbarLoader = async () => {
    return (await import('@21st-extension/toolbar/dist/index.es.js')) as ToolbarModule;
};

let hasInitialized = false;

export const setupStagewiseToolbar = async (
    environment: string | undefined = process.env.NODE_ENV,
    loadToolbar: ToolbarLoader = defaultToolbarLoader
): Promise<void> => {
    if (hasInitialized || environment !== 'development') {
        return;
    }

    hasInitialized = true;
    const { initToolbar } = await loadToolbar();
    initToolbar(stagewiseConfig);
};
