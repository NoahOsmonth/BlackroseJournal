# Task 001: Fix web theme toggle + persistence

## Problem
Switching themes (Light/Dark/System) from Settings fails on web with:

- `Unable to manually set color scheme without using darkMode: class`

As a result, the user preference does not apply or persist reliably.

## Impact
- Theme toggle is broken on web
- Preference persistence is unreliable
- Console error noise makes debugging harder

## Proposed Fix
- Configure Tailwind to use class-based dark mode so NativeWind can manually override the color scheme.
- Verify NativeWind theme toggling works for `light`, `dark`, and `system`.
- Ensure the persisted preference flow is correct and robust (avoid leaving UI state out of sync if a setter throws).

## Acceptance Criteria
- No runtime errors when switching theme on web (Settings > Light/Dark/System).
- Theme changes visibly apply immediately (e.g., `bg-background-*` and `dark:*` classes respond).
- Selected preference persists across reloads (AsyncStorage).
- System option respects OS appearance changes where supported.
- Automated regression tests cover:
  - loading a saved preference
  - saving a new preference
  - calling NativeWind's theme setter with the expected value

## References
- NativeWind dark mode guide:
  - https://www.nativewind.dev/docs/core-concepts/dark-mode
- NativeWind `useColorScheme()` API:
  - https://www.nativewind.dev/docs/api/use-color-scheme
- Tailwind manual dark mode toggling:
  - https://tailwindcss.com/docs/dark-mode#toggling-dark-mode-manually

## Subtasks
1. Update `tailwind.config.js`:
   - Add `darkMode: 'class'` at the top level of the config.
2. Verify theme persistence / hydration:
   - `hooks/useThemeSettings.ts` loads `user-theme-preference` and applies it via NativeWind.
   - If setter errors are still possible, ensure state is rolled back or updated only after successful apply.
3. Verify Settings UI uses the hook correctly:
   - `app/(tabs)/settings.tsx` should reflect the current selection and call the setter.
4. Add tests:
   - Add `__tests__/useThemeSettings.test.ts` (or `__tests__/hooks/useThemeSettings.test.ts` if using subfolders).
   - Mock AsyncStorage + NativeWind `useColorScheme`.

## Verification
### Unit tests
- Targeted:
  - `npm test -- --testPathPattern=useThemeSettings --runInBand`

### Manual (required)
- `npm run web`
- Go to Settings, toggle Light/Dark/System:
  - confirm no console error
  - confirm UI changes
- Reload the page:
  - confirm previously selected theme loads
