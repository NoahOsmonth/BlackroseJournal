# Implementation Plan - Fix UI Dark Mode

## Goal
Make text visible in dark mode by ensuring Tailwind classes in `components/` are generated.

## Workflow
1. Update `tailwind.config.js` to include `./components/**/*.{js,jsx,ts,tsx}` in the `content` array.
2. Verify the configuration change.

## Quality Gate
- `tailwind.config.js` must contain the correct path to components.
