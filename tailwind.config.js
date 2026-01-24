/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  darkMode: 'class',
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary colors from design
        primary: "#FF9F0A",
        "primary-dark": "#FF8C00",
        // Background colors
        "background-light": "#F2F2F7",
        "background-dark": "#000000",
        // Surface colors
        "surface-light": "#FFFFFF",
        "surface-dark": "#1C1C1E",
        "secondary-dark": "#2C2C2E",
        "card-dark": "#161618",
        // Text main colors (from today.html)
        "text-light": "#111827",
        "text-dark": "#F9FAFB",
        "text-main-light": "#111827",
        "text-main-dark": "#F9FAFB",
        // Text primary colors (from insights.html)
        "text-primary-light": "#111827",
        "text-primary-dark": "#F9FAFB",
        // Text secondary colors
        "subtext-light": "#6B7280",
        "subtext-dark": "#98989D",
        "text-secondary-light": "#6B7280",
        "text-secondary-dark": "#98989D",
        // Border colors
        "divider-light": "#E5E7EB",
        "divider-dark": "#2C2C2E",
        "border-light": "#E5E7EB",
        "border-dark": "#27272A",
        // Legacy colors for chat
        "ai-text": "#4A90E2",
        "user-text": "#2C3E50",
        "meta-text": "#9CA3AF",
        "accent": "#32D74B",
        "accent-orange": "#FF9500",
        "accent-green": "#32D74B",
        "accent-blue": "#4A90E2",
        "accent-yellow": "#FCD34D",
        // Additional colors from design
        "gray-100": "#F3F4F6",
        "gray-200": "#E5E7EB",
        "gray-600": "#4B5563",
        "gray-700": "#374151",
        "gray-300": "#9CA3AF",
        "blue-200": "#BFDBFE",
        "blue-300": "#93C5FD",
        "yellow-300": "#FCD34D",
      },
      fontFamily: {
        serif: ['PlayfairDisplayRegular'],
        sans: ['PlusJakartaSansRegular'],
        display: ['PlusJakartaSansSemiBold'],
        body: ['PlusJakartaSansRegular'],
        jakarta: ['PlusJakartaSansRegular'],
        inter: ['Inter'],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        'xl': "1rem",
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'nav': '0 -1px 3px rgba(0, 0, 0, 0.05)',
        'fab': '0 4px 12px rgba(255, 159, 10, 0.35)',
      },
    },
  },
  plugins: [],
}
