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
                'primary': '#FF9F0A',
                'primary-dark': '#FF8C00',
                'persona-rose': '#E91E63',
                'persona-teal': '#2DD4BF',
                // Main text
                'text-light': '#111827',
                'text-dark': '#F9FAFB',
                'text-main-light': '#111827',
                'text-main-dark': '#F9FAFB',
                // User input text
                'user-text': '#7C2D12',
                'user-text-dark': '#FDBA74',
                // AI / accent text
                'accent-blue': '#3B82F6',
                'ai-text': '#38BDF8',
                // Semantic text variants
                'text-primary-light': '#111827',
                'text-primary-dark': '#F9FAFB',
                'text-secondary-light': '#6B7280',
                'text-secondary-dark': '#9CA3AF',
                'subtext-light': '#6B7280',
                'subtext-dark': '#9CA3AF',
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
