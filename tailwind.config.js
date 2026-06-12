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
                // Backgrounds
                'background-light': '#F2F2F7',
                'background-dark': '#000000',
                // Surfaces (cards, modals, nav)
                'surface-light': '#FFFFFF',
                'surface-dark': '#1C1C1E',
                'card-dark': '#1C1C1E',
                // Primary accent
                'primary': colorVar('primary'),
                'primary-dark': colorVar('primary-dark'),
                'persona-rose': '#E91E63',
                'persona-teal': '#2DD4BF',
                'memory-episodic': '#A370F7',
                'memory-semantic': '#38BDF8',
                'memory-profile': '#FB7185',
                'memory-procedural': '#34D399',
                'memory-note': '#FBBF24',
                'memory-working': '#F472B6',
                // Main text
                'text-light': colorVar('text-light'),
                'text-dark': colorVar('text-dark'),
                'text-main-light': colorVar('text-main-light'),
                'text-main-dark': colorVar('text-main-dark'),
                // User input text
                'user-text': colorVar('user-text'),
                'user-text-dark': colorVar('user-text-dark'),
                // AI / accent text
                'accent-blue': colorVar('accent-blue'),
                // Accent placeholders (WS8 refines) — defined so badges aren't invisible
                'accent-green': '#34C759',
                'accent-green-dark': '#32D74B',
                'accent-yellow': '#FFD60A',
                'ai-text': colorVar('ai-text'),
                // Semantic text variants
                'text-primary-light': colorVar('text-primary-light'),
                'text-primary-dark': colorVar('text-primary-dark'),
                'text-secondary-light': colorVar('text-secondary-light'),
                'text-secondary-dark': colorVar('text-secondary-dark'),
                'subtext-light': colorVar('subtext-light'),
                'subtext-dark': colorVar('subtext-dark'),
                // Dividers / borders
                'divider-light': '#E5E5EA',
                'divider-dark': '#2C2C2E',
                // Secondary surface (history drafts badge, etc.)
                'secondary-dark': '#1C1C1E',
            },
            boxShadow: {
                'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
                'nav': '0 -1px 3px rgba(0, 0, 0, 0.05)',
            },
        },
    },
    plugins: [],
};
