import path from "path";

describe("babel config", () => {
    it("uses NativeWind JSX runtime and plugins", () => {
        const babelConfigPath = path.join(process.cwd(), "babel.config.js");
        const buildConfig = jest.requireActual(babelConfigPath) as (
            api: { cache: (value: boolean) => void }
        ) => {
            presets?: unknown[];
            plugins?: unknown[];
        };

        const config = buildConfig({ cache: () => undefined });
        const presets = config.presets ?? [];
        const plugins = config.plugins ?? [];

        const expoPreset = presets.find(
            (preset) => Array.isArray(preset) && preset[0] === "babel-preset-expo"
        ) as [string, Record<string, unknown>] | undefined;

        expect(expoPreset).toBeDefined();
        const presetOptions = expoPreset?.[1] ?? {};
        expect(presetOptions).toHaveProperty("jsxImportSource", "nativewind");

        const hasNativewindPreset = presets.some(
            (preset) =>
                preset === "nativewind/babel" ||
                (Array.isArray(preset) && preset[0] === "nativewind/babel")
        );
        const hasNativewindPlugin = plugins.some(
            (plugin) =>
                plugin === "nativewind/babel" ||
                (Array.isArray(plugin) && plugin[0] === "nativewind/babel")
        );

        expect(hasNativewindPreset || hasNativewindPlugin).toBe(true);
        expect(plugins).not.toContain("react-native-css-interop/dist/babel-plugin");
        expect(plugins[plugins.length - 1]).toBe(
            "react-native-reanimated/plugin"
        );
    });
});
