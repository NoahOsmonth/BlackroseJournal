# Task 009: Settings Screen (Theme/Export/About/Privacy)

## Problem
The Settings screen needs to match the spec: theme selection (Light/Dark/Auto), and options for notifications, export, about, and privacy.

## Impact
- Enables personalization (theme) and basic product completeness

## Proposed Fix
- Implement Settings UI in `app/(tabs)/settings.tsx`.
- Reuse existing theme hooks/services (e.g., `hooks/useThemeSettings.ts`).
- Provide basic Export Journal behavior or a clear stub with UI.

## Acceptance Criteria
- Settings screen reachable from:
  - Settings tab
  - Header menu icon
- Theme selection supports Light/Dark/Auto and persists.
- Notifications item exists (may be stub).
- Export Journal item exists:
  - Either functional export (JSON) OR stubbed with clear messaging.
- About and Privacy Policy items exist.

## References
- Spec: Core User Flows section 10

## Subtasks
1. Implement Settings list UI using existing theme tokens.
2. Wire theme selection to persisted setting.
3. Add Export Journal stub/implementation.
4. Add About and Privacy screens or modals (lightweight).
5. Add tests for theme selection UI.

## Verification
### Unit/Component Tests
- Extend `__tests__/screens/SettingsScreen.test.tsx` as needed.
- Targeted run:
  - `npm test -- --testPathPattern=SettingsScreen --runInBand`

### Manual
- Toggle theme and confirm app updates.
- Validate navigation from header menu.

