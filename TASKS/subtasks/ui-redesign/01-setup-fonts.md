# 01. Install and Configure Fonts

meta:
  id: ui-redesign-01
  feature: ui-redesign
  priority: P2
  depends_on: []
  tags: [implementation, setup]

status: complete
completed: 2026-01-18T12:00:00Z

objective:
- Replace 'Inter' with 'Playfair Display' (headers) and 'Lato' (body).

deliverables:
- Updated `package.json` with new font packages.
- Updated `app/_layout.tsx` to load new fonts.
- Updated `tailwind.config.js` to map font families.

steps:
- Install `@expo-google-fonts/playfair-display` and `@expo-google-fonts/lato`.
- Modify `app/_layout.tsx` to import and load the new fonts.
- Modify `tailwind.config.js` to set `fontFamily`:
  - `serif`: ['PlayfairDisplayRegular']
  - `sans`: ['LatoRegular']
- Remove 'Inter' font setup if no longer needed.

tests:
- Unit: Verify fonts load in `_layout.tsx`.
- Manual: Check if text renders with new fonts.

acceptance_criteria:
- App builds without errors.
- Text elements use Playfair Display and Lato.

validation:
- Run `npx expo start` and visually verify fonts.
