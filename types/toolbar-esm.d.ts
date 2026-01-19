declare module '@21st-extension/toolbar/dist/index.es.js' {
    export type StagewiseConfig = {
        plugins: unknown[];
    };

    export function initToolbar(config: StagewiseConfig): void;
}
