# Implementation Plan - Settings & Navigation Polish

## Phase 1: Theme Engine & Settings UI
This phase establishes the robust theming system (Light/Dark/System) and the UI to control it.

- [x] Task: Implement Theme Service & Persistence
    - [x] Create `useThemeSettings` hook (or update existing theme logic) to manage 'light' | 'dark' | 'system' state.
    - [x] Implement persistence using `AsyncStorage` to save user preference.
    - [x] Ensure application initially loads with the correct theme (preventing flash of wrong theme).
- [x] Task: Update Root Layout for Theme Support
    - [x] Ensure `_layout.tsx` and `NativeWind` configuration correctly subscribe to the theme state.
    - [x] Verify dynamic switching works without reload.
- [x] Task: Build Settings Screen UI (Theme Section)
    - [x] Update `app/(tabs)/settings.tsx` to include the Theme Selector.
    - [x] Implement UI for switching between Light, Dark, and System.
- [x] Task: Conductor - User Manual Verification 'Theme Engine & Settings UI' (Protocol in workflow.md)

## Phase 2: Data Management Features
This phase adds the requested data control features to the Settings screen.

- [x] Task: Extend Journal Storage Service
    - [x] Add `clearAllEntries()` method to `services/journalStorage.ts`.
    - [x] Add `getAllEntriesForExport()` method to `services/journalStorage.ts` (returns formatted JSON/String).
- [x] Task: Implement Data Settings UI
    - [x] Add "Data Management" section to `settings.tsx`.
    - [x] Implement "Clear Data" button with a native Alert confirmation dialog.
    - [x] Implement "Export Data" button using React Native's `Share` or Clipboard API.
- [x] Task: Conductor - User Manual Verification 'Data Management Features' (Protocol in workflow.md)

## Phase 3: Bottom Navigation Redesign
This phase updates the main navigation bar to match the requested "rounded sheet" aesthetic.

- [~] Task: Refactor Bottom Navigation Styles
    - [ ] Modify the tab bar container styles (likely in `app/(tabs)/_layout.tsx` or `components/journal/BottomNav.tsx`).
    - [ ] Apply **rounded top-left and top-right corners** (border-radius).
    - [ ] Remove bottom floating margins if present, ensuring it sits on the bottom edge.
    - [ ] Adjust padding to account for the device Safe Area (Home Indicator).
    - [ ] Verify visual consistency in both Light and Dark modes.
- [ ] Task: Conductor - User Manual Verification 'Bottom Navigation Redesign' (Protocol in workflow.md)
