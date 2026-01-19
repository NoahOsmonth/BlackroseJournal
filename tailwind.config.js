/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary colors from design
        primary: "#E91E63",
        "primary-dark": "#C2185B",
        // Background colors
        "background-light": "#F5F5F5",
        "background-dark": "#121212",
        // Surface colors
        "surface-light": "#FFFFFF",
        "surface-dark": "#1E1E1E",
        // Text main colors (from today.html)
        "text-light": "#1C1C1E",
        "text-dark": "#E5E5E7",
        "text-main-light": "#333333",
        "text-main-dark": "#E0E0E0",
        // Text secondary colors
        "subtext-light": "#8E8E93",
        "subtext-dark": "#8E8E93",
        "text-secondary-light": "#757575",
        "text-secondary-dark": "#A0A0A0",
        // Border colors
        "divider-light": "#E5E5EA",
        "divider-dark": "#2C2C2E",
        "border-light": "#E0E0E0",
        "border-dark": "#333333",
        // Legacy colors for chat
        "ai-text": "#4A6658",
        "user-text": "#2C3E50",
        "meta-text": "#9CA3AF",
        "accent": "#D4A373",
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
        sans: ['LatoRegular'],
        display: ['Nunito', 'Inter'],
        body: ['Nunito', 'Inter'],
        nunito: ['Nunito'],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        'xl': "1rem",
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'nav': '0 -1px 3px rgba(0, 0, 0, 0.05)',
        'fab': '0 4px 12px rgba(233, 30, 99, 0.4)',
      },
    },
  },
  plugins: [],
}