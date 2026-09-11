/**
 * NativeWind token table.
 *
 * Every value is either a locked Blackrose hex from `constants/blackrose.ts`
 * (copied literally — this file is loaded by the Tailwind CLI outside the
 * TypeScript path aliases) or a runtime CSS variable set by
 * `AppColorThemeProvider` for the user-selectable accent slots.
 *
 * NativeWind silently drops tokens it cannot resolve, so a missing token shows
 * up as invisible UI rather than an error. `__tests__/tailwind-config.test.ts`
 * guards the table; `__tests__/constants/blackrosePalette.test.ts` guards that
 * it still matches `constants/blackrose.ts`.
 *
 * Plan: docs/plans/blackrose-design-rewrite.md §2
 */
const colorVar = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
    darkMode: 'class',
    presets: [require("nativewind/preset")],
    content: [
        "./app/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./features/**/*.{ts,tsx}",
        "./hooks/**/*.{ts,tsx}",
        "./constants/**/*.{ts,tsx}"
    ],
    theme: {
        extend: {
            colors: {
                // ---- Blackrose surfaces -------------------------------------------------
                // Backgrounds (runtime vars; seeded from the palette in global.css).
                'background-light': colorVar('background-light'),
                'background-dark': colorVar('background-dark'),
                // Cards / sheets.
                'surface-light': '#FFFDF9',
                'surface-dark': '#151518',
                // Nested surfaces: chat user slip, chips, inset panels.
                'surface-2-light': '#EDE8DF',
                'surface-2-dark': '#1A1A1E',
                // Hairlines: dividers, borders, the chat companion rule.
                'hairline-light': '#E2DCD2',
                'hairline-dark': '#2C2A26',

                // ---- Ink -------------------------------------------------------------
                'text-light': colorVar('text-light'),
                'text-dark': colorVar('text-dark'),
                'text-main-light': colorVar('text-main-light'),
                'text-main-dark': colorVar('text-main-dark'),
                'text-primary-light': colorVar('text-primary-light'),
                'text-primary-dark': colorVar('text-primary-dark'),
                'text-secondary-light': colorVar('text-secondary-light'),
                'text-secondary-dark': colorVar('text-secondary-dark'),
                'subtext-light': colorVar('subtext-light'),
                'subtext-dark': colorVar('subtext-dark'),
                // Explicit secondary-ink aliases (Blackrose `text-2`).
                'ink-2-light': '#6B6560',
                'ink-2-dark': '#8A8580',

                // ---- Accent (bone) ---------------------------------------------------
                'primary': colorVar('primary'),
                'primary-dark': colorVar('primary-dark'),
                // Static bone values for places that need the token, not the theme var.
                'bone-light': '#5C564C',
                'bone-dark': '#C9C2B6',
                // Ink that sits ON a solid bone fill (primary CTAs).
                'on-bone-light': '#FFFDF9',
                'on-bone-dark': '#151518',

                // ---- Semantic --------------------------------------------------------
                'ok-light': '#4F6F52',
                'ok-dark': '#7A9E7E',
                'danger-light': '#9B3A3A',
                'danger-dark': '#C97B7B',
                // Muted rose: persona / mood family (third graph family).
                'rose-muted-light': '#8A5F68',
                'rose-muted-dark': '#C4A0A6',

                // ---- Chat ------------------------------------------------------------
                'user-text': colorVar('user-text'),
                'user-text-dark': colorVar('user-text-dark'),
                'accent-blue': colorVar('accent-blue'),
                'ai-text': colorVar('ai-text'),

                // ---- Dividers / legacy surface aliases -------------------------------
                'divider-light': '#E2DCD2',
                'divider-dark': '#2C2A26',
                'card-dark': '#151518',
                'secondary-dark': '#1A1A1E',

                // ---- Free-model badge (quiet sage, not a rainbow chip) ---------------
                'accent-green': '#4F6F52',
                'accent-green-dark': '#7A9E7E',
                'accent-yellow': '#8A6A2F',

                // ---- Status banners (finish-background pill) -------------------------
                'status-running-bg-light': '#EDE8DF',
                'status-running-bg-dark': '#1A1A1E',
                'status-running-text-light': '#6B6560',
                'status-running-text-dark': '#8A8580',
                'status-running-dot': '#8A6A2F',
                'status-done-bg-light': '#E4EAE2',
                'status-done-bg-dark': '#1B241C',
                'status-done-text-light': '#4F6F52',
                'status-done-text-dark': '#7A9E7E',
                'status-done-dot': '#7A9E7E',

                // ---- Agent tool timeline (MaterialIcons take hex, not className) -----
                'tool-ok': '#4F6F52',
                'tool-ok-dark': '#7A9E7E',
                'tool-error': '#9B3A3A',
                'tool-error-dark': '#C97B7B',
                'tool-warn': '#8A6A2F',
                'tool-warn-dark': '#C4A0A6',
                'tool-idle': '#6B6560',
                'tool-idle-dark': '#8A8580',

                // ---- Memory graph: three families, two shades each -------------------
                'graph-bone': '#C9C2B6',
                'graph-bone-deep-dark': '#A79E8F',
                'graph-bone-light': '#5C564C',
                'graph-bone-deep-light': '#7A7266',
                'graph-sage': '#7A9E7E',
                'graph-sage-deep-dark': '#5F8065',
                'graph-sage-light': '#4F6F52',
                'graph-sage-deep-light': '#3D5741',
                'graph-rose': '#C4A0A6',
                'graph-rose-deep-dark': '#A4808A',
                'graph-rose-light': '#8A5F68',
                'graph-rose-deep-light': '#6E474F',
            },
            fontFamily: {
                sans: ['PlusJakartaSansRegular', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                'sans-medium': ['PlusJakartaSansMedium', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                'sans-semibold': ['PlusJakartaSansSemiBold', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                'sans-bold': ['PlusJakartaSansBold', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                serif: ['PlayfairDisplayRegular', 'Playfair Display', 'Georgia', 'serif'],
                'serif-bold': ['PlayfairDisplayBold', 'Playfair Display', 'Georgia', 'serif'],
            },
            borderRadius: {
                // 12 controls, 16 cards, 28 sheets (plan §2).
                control: '12px',
                card: '16px',
                sheet: '28px',
            },
            boxShadow: {
                'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
                'nav': '0 -1px 3px rgba(0, 0, 0, 0.05)',
            },
        },
    },
    plugins: [],
};
