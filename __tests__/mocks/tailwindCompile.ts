/**
 * Compile a component's real Tailwind class names the way the app's runtime does,
 * so a test can assert geometry that `props.style` cannot show: NativeWind leaves
 * `className` as a plain string in this jest environment and resolves it from
 * generated CSS at runtime, so every className in a rendered tree has
 * `style: undefined`.
 *
 * `inlineRem` is the reason this exists at all. NativeWind compiles rem-based
 * utilities against `inlineRem = 14` on native (this repo does not override it in
 * `metro.config.js`), so on device `h-11` is 38.5pt, `h-12` is 42pt and `gap-4` is
 * 14pt — while the web build, where 1rem is 16px, looks correct. Only arbitrary
 * px values (`h-[44px]`) mean the same thing on both platforms, which is why the
 * touch-target controls use them.
 *
 * Paths are repo-relative and resolved against the jest working directory
 * (the repo root); `npm test` runs from there.
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const { cssToReactNativeRuntime } = require('react-native-css-interop/dist/css-to-rn/index.js');
const tailwindConfig = require('../../tailwind.config.js');
/* eslint-enable @typescript-eslint/no-require-imports */

export const NATIVE_INLINE_REM = 14;

/** Declarations are mostly numbers, but not all: `flex-1` sets `flexBasis: '0%'`. */
export type CompiledBox = Record<string, number | string>;

interface CompiledRule {
    n: { d: unknown[][] }[];
}

function isBox(value: unknown): value is CompiledBox {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Every class name used by a source file, compiled to native numbers. */
export async function compileTailwind(
    relativeSource: string
): Promise<Record<string, CompiledBox>> {
    const { css } = await postcss([
        tailwindcss({ ...tailwindConfig, content: [relativeSource] }),
    ]).process('@tailwind utilities;', { from: undefined });

    const runtime = cssToReactNativeRuntime(css, { inlineRem: NATIVE_INLINE_REM }) as {
        rules?: Record<string, CompiledRule>;
    };

    const compiled: Record<string, CompiledBox> = {};
    for (const [className, rule] of Object.entries(runtime.rules ?? {})) {
        compiled[className] = Object.assign(
            {},
            ...rule.n.flatMap((node) => node.d.flat(2)).filter(isBox)
        );
    }
    return compiled;
}

/**
 * Merge the resting-state declarations of a rendered `className` string.
 * Variant utilities (`active:`, `dark:`) are skipped — they do not size the box.
 */
export function mergeBox(compiled: Record<string, CompiledBox>, className: string): CompiledBox {
    const merged: CompiledBox = {};
    for (const token of className.split(/\s+/)) {
        if (!token || token.includes(':')) continue;
        Object.assign(merged, compiled[token]);
    }
    return merged;
}
