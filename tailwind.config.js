/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#8DA399", // Sage Green
        "background-light": "#F5F5F0", // Warm Beige
        "background-dark": "#1A1A1A", // Soft Charcoal
        "ai-text": "#4A6658", // Darker Sage
        "user-text": "#2C3E50", // Dark Blue/Grey
        "meta-text": "#9CA3AF",
        "accent": "#D4A373", // Soft Earthy Orange
      },
      fontFamily: {
        serif: ['PlayfairDisplayRegular'],
        sans: ['LatoRegular'],
      },
    },
  },
  plugins: [],
}