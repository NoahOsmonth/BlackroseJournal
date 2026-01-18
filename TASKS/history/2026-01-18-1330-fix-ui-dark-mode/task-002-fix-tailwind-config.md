# Task: Fix Tailwind Config Content Path

## Problem
The `components/` directory is missing from `tailwind.config.js` content array. This causes Tailwind classes used in components (like `dark:text-slate-200`) to be ignored, resulting in dark text on dark background.

## Proposed Fix
1. Edit `tailwind.config.js`.
2. Add `"./components/**/*.{js,jsx,ts,tsx}"` to the `content` array.

## Verification
- Read `tailwind.config.js` and confirm the path is present.
