# Plan: Fix theme toggle + eliminate warnings

## Goal
1) Fix the Settings theme selector so switching between Light/Dark/System works on **web** (and continues to work on native) without errors.
2) Eliminate **all** warnings from `npm run lint` and `npm test`.

## Primary Symptoms (Current)
- Console error on web when changing theme:
	- `Unable to manually set color scheme without using darkMode: class`
- Theme switching does not apply/persist.
- `expo lint` currently reports warnings (even when errors = 0).

## Key References
- Nativewind dark mode guide (manual selection requires `darkMode: "class"`):
	- https://www.nativewind.dev/docs/core-concepts/dark-mode
- Nativewind `useColorScheme()` API:
	- https://www.nativewind.dev/docs/api/use-color-scheme
- Tailwind dark mode configuration / manual toggling:
	- https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually

## Likely Root Cause
The repo uses NativeWind's `setColorScheme` to manually toggle themes, but `tailwind.config.js` does not configure `darkMode: "class"`. NativeWind blocks manual theme overrides unless Tailwind dark mode is class-based.

## Scope
- Theme toggle/persistence:
	- `tailwind.config.js`
	- `hooks/useThemeSettings.ts`
	- `app/(tabs)/settings.tsx`
	- `app/_layout.tsx` (startup/theme hydration)
- Warnings cleanup:
	- any files reported by `expo lint` / Jest during this run

## Quality Gate
```bash
npm run lint
npm test -- --runInBand
npm run check:design
```

## Testing Expectations
- Add/extend tests to cover the theme preference hook:
	- loads saved preference
	- persists changes
	- calls NativeWind color scheme setter
- If any warnings cannot be removed without disabling important rules, document the rationale in `PROGRESS.md` and keep the related story `passes=false`.

## Definition of Done
- Web theme switching (Light/Dark/System) works with no runtime errors.
- `npm run lint` reports **0 errors, 0 warnings**.
- `npm test -- --runInBand` passes and emits **no** unexpected warnings/errors to the console.
- Design/UI file-size limits still respected (per `AGENTS.md`).
