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

        // NativeWind v4 with Expo only needs jsxImportSource: "nativewind" in
        // babel-preset-expo. The standalone "nativewind/babel" preset is an
        // alternative setup, not a complement, and including both can double-
        // transform JSX/CSS.
        expect(hasNativewindPreset).toBe(false);
        expect(plugins).not.toContain("react-native-css-interop/dist/babel-plugin");
        expect(plugins[plugins.length - 1]).toBe(
            "react-native-reanimated/plugin"
        );
    });
});
